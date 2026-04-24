from pydantic import BaseModel


class RunJobRequest(BaseModel):
    job_id: str


class SessionValidationRequest(BaseModel):
    client_id: str
    target_tipo: str = "salud"


class ScrapeResult(BaseModel):
    tipo: str
    metrics: dict
    warnings: list[str] = []


class ClientContext(BaseModel):
    id: str
    name: str
    meli_seller_id: str | None = None
    meli_account_url: str | None = None


class SessionValidationResult(BaseModel):
    ok: bool
    authenticated: bool
    seller_id: str | None = None
    warnings: list[str] = []
    error: str | None = None
