import os
import json
from datetime import datetime, timezone
from fastapi import FastAPI, Header, HTTPException
from supabase import create_client
from models import ClientContext, RunJobRequest, SessionValidationRequest
from security import decrypt_session_payload
from scrapers.mercadolibre import scrape_mercadolibre, validate_mercadolibre_session

app = FastAPI(title="MeliGrowth Scraper Service")


def assert_secret(secret: str | None):
    expected = os.getenv("SCRAPER_SERVICE_SECRET")
    if expected and secret != expected:
        raise HTTPException(status_code=401, detail="Invalid scraper secret")


def supabase_client():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Missing Supabase service configuration")
    return create_client(url, key)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_client_context(supabase, client_id: str) -> ClientContext:
    client_response = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    client_row = client_response.data
    if not client_row:
        raise HTTPException(status_code=404, detail="Client not found")

    return ClientContext(
        id=client_row["id"],
        name=client_row["name"],
        meli_seller_id=client_row.get("meli_seller_id"),
        meli_account_url=client_row.get("meli_account_url"),
    )


def load_context_for_job(supabase, job: dict) -> ClientContext:
    """
    - Legacy: scraping_jobs.client_id -> clients
    - V2: scraping_jobs.ml_account_id -> ml_accounts (+ seller_id, meli_account_url)
    """
    ml_account_id = job.get("ml_account_id")
    if ml_account_id:
        acc_response = (
            supabase.table("ml_accounts")
            .select("id, seller_id, meli_account_url, account_name")
            .eq("id", ml_account_id)
            .single()
            .execute()
        )
        row = acc_response.data
        if not row:
            raise HTTPException(status_code=404, detail="ml_account not found for scraping job")
        return ClientContext(
            id=str(row["id"]),
            name=row.get("account_name") or "ML Account",
            meli_seller_id=str(row["seller_id"]) if row.get("seller_id") else None,
            meli_account_url=row.get("meli_account_url"),
        )

    client_id = job.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="Job missing client_id and ml_account_id")
    return load_client_context(supabase, str(client_id))


def load_session_payload_for_job(supabase, job: dict) -> dict | None:
    """Session en Storage: v2 usa {ml_account_id}/session.json; legacy meli_sessions por client_id."""
    ml_account_id = job.get("ml_account_id")
    if ml_account_id:
        path = f"{ml_account_id}/session.json"
        download_response = supabase.storage.from_("meli-sessions").download(path)
    else:
        client_id = job.get("client_id")
        if not client_id:
            return None
        session_response = (
            supabase.table("meli_sessions")
            .select("storage_path")
            .eq("client_id", str(client_id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        session_rows = session_response.data or []
        if not session_rows:
            return None
        storage_path = session_rows[0].get("storage_path")
        if not storage_path:
            return None
        download_response = supabase.storage.from_("meli-sessions").download(storage_path)

    if not download_response:
        return None

    if isinstance(download_response, bytes):
        content = download_response.decode("utf-8")
    elif hasattr(download_response, "decode"):
        content = download_response.decode("utf-8")
    else:
        content = str(download_response)
    return decrypt_session_payload(content)


def load_latest_session_state(supabase, client_id: str) -> dict | None:
    session_response = (
        supabase.table("meli_sessions")
        .select("storage_path")
        .eq("client_id", client_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    session_rows = session_response.data or []
    if not session_rows:
        return None

    storage_path = session_rows[0].get("storage_path")
    if not storage_path:
        return None

    download_response = supabase.storage.from_("meli-sessions").download(storage_path)
    if not download_response:
        return None

    if isinstance(download_response, bytes):
        content = download_response.decode("utf-8")
    elif hasattr(download_response, "decode"):
        content = download_response.decode("utf-8")
    else:
        content = str(download_response)
    return decrypt_session_payload(content)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/session/validate")
async def validate_session(payload: SessionValidationRequest, x_scraper_secret: str | None = Header(default=None)):
    assert_secret(x_scraper_secret)
    supabase = supabase_client()
    client = load_client_context(supabase, payload.client_id)
    session_state = load_latest_session_state(supabase, payload.client_id)
    result = await validate_mercadolibre_session(client, session_state=session_state, target_tipo=payload.target_tipo)
    return result.model_dump()


@app.post("/jobs/run")
async def run_job(payload: RunJobRequest, x_scraper_secret: str | None = Header(default=None)):
    assert_secret(x_scraper_secret)
    supabase = supabase_client()

    job_response = supabase.table("scraping_jobs").select("*").eq("id", payload.job_id).single().execute()
    job = job_response.data
    if not job:
        raise HTTPException(status_code=404, detail="Scraping job not found")

    supabase.table("scraping_jobs").update({
        "estado": "running",
        "started_at": now_iso(),
        "error_msg": None,
    }).eq("id", payload.job_id).execute()

    try:
        client = load_context_for_job(supabase, job)
        session_state = load_session_payload_for_job(supabase, job)
        result = await scrape_mercadolibre(client, job["tipo"], session_state=session_state)

        supabase.table("scraping_jobs").update({
            "estado": "success",
            "resultado_json": result.model_dump(),
            "finished_at": now_iso(),
            "error_msg": None,
        }).eq("id", payload.job_id).execute()

        return {"ok": True, "job_id": payload.job_id, "result": result.model_dump()}
    except Exception as exc:
        supabase.table("scraping_jobs").update({
            "estado": "error",
            "error_msg": str(exc),
            "finished_at": now_iso(),
        }).eq("id", payload.job_id).execute()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
