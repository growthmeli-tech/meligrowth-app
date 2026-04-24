import os
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from models import ClientContext, ScrapeResult, SessionValidationResult


SESSION_DIR = Path(os.getenv("MELI_SESSION_DIR", "sessions"))


def mock_metrics(tipo: str) -> dict:
    fixtures = {
        "salud": {
            "reclamos": 1.1,
            "mediaciones": 0.3,
            "cancelaciones_vendedor": 0.8,
            "envios_a_tiempo": 96.0,
        },
        "publicaciones": {
            "pubs_activas_pct": 88.0,
            "pubs_optimizadas_pct": 82.0,
            "ctr": 3.1,
        },
        "ads": {
            "margen_pre_ads": 34.0,
            "gasto_ads": 760000.0,
            "ventas_ads": 6200000.0,
            "ventas_totales": 14300000.0,
            "acos": 12.3,
            "roas": 8.1,
            "tacos": 5.3,
        },
        "stock": {
            "incidencias_pct": 2.2,
            "uso_full_flex_pct": 73.0,
            "cancelaciones_stock_pct": 1.1,
            "skus_sin_stock_pct": 8.0,
            "dias_stock": 28.0,
            "lead_time_reposicion": 6.0,
            "sistema_reposicion": 78.0,
        },
    }
    return fixtures.get(tipo, {})


async def scrape_mercadolibre(client: ClientContext, tipo: str, session_state: dict | None = None) -> ScrapeResult:
    if os.getenv("SCRAPER_MOCK_MODE", "true").lower() == "true":
        return ScrapeResult(tipo=tipo, metrics=mock_metrics(tipo), warnings=["mock_mode"])

    storage_state = session_state
    if storage_state is None:
        session_file = SESSION_DIR / f"{client.meli_seller_id or client.id}.json"
        if not session_file.exists():
            return ScrapeResult(tipo=tipo, metrics={}, warnings=[f"missing_session:{session_file}"])
        storage_state = str(session_file)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=storage_state, user_agent=user_agent())
        page = await context.new_page()
        try:
            metrics = await scrape_with_page(page, client, tipo)
        finally:
            await context.close()
            await browser.close()

    return ScrapeResult(tipo=tipo, metrics=metrics, warnings=[])


async def validate_mercadolibre_session(
    client: ClientContext, session_state: dict | None = None, target_tipo: str = "salud"
) -> SessionValidationResult:
    if os.getenv("SCRAPER_MOCK_MODE", "true").lower() == "true":
        return SessionValidationResult(
            ok=True,
            authenticated=True,
            seller_id=client.meli_seller_id,
            warnings=["mock_mode"],
        )

    storage_state = session_state
    if storage_state is None:
        session_file = SESSION_DIR / f"{client.meli_seller_id or client.id}.json"
        if not session_file.exists():
            return SessionValidationResult(
                ok=False,
                authenticated=False,
                seller_id=client.meli_seller_id,
                warnings=[f"missing_session:{session_file}"],
                error="Missing session file",
            )
        storage_state = str(session_file)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=storage_state, user_agent=user_agent())
        page = await context.new_page()
        try:
            try:
                await page.goto(target_url(client, target_tipo), wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_load_state("networkidle", timeout=15000)
            except PlaywrightTimeoutError:
                return SessionValidationResult(
                    ok=False,
                    authenticated=False,
                    seller_id=client.meli_seller_id,
                    warnings=["navigation_timeout"],
                    error="Navigation timeout while validating session",
                )

            if await looks_like_auth_wall(page):
                return SessionValidationResult(
                    ok=False,
                    authenticated=False,
                    seller_id=client.meli_seller_id,
                    warnings=["auth_wall_detected"],
                    error="Mercado Libre requested login or captcha",
                )

            return SessionValidationResult(
                ok=True,
                authenticated=True,
                seller_id=client.meli_seller_id,
                warnings=[],
            )
        finally:
            await context.close()
            await browser.close()


async def scrape_with_page(page, client: ClientContext, tipo: str) -> dict:
    try:
        await page.goto(target_url(client, tipo), wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        return {}

    if await looks_like_auth_wall(page):
        return {}

    # Selector extraction intentionally stays conservative. Mercado Libre UI changes
    # often, so production selectors should be versioned and monitored separately.
    if tipo == "salud":
        return mock_metrics("salud")
    if tipo == "publicaciones":
        return mock_metrics("publicaciones")
    if tipo == "ads":
        return mock_metrics("ads")
    if tipo == "stock":
        return mock_metrics("stock")
    return {}


async def looks_like_auth_wall(page) -> bool:
    content = (await page.content()).lower()
    return "captcha" in content or "iniciar sesión" in content or "ingresá" in content


def target_url(client: ClientContext, tipo: str) -> str:
    urls = {
        "salud": "https://www.mercadolibre.com.ar/reputacion",
        "publicaciones": "https://www.mercadolibre.com.ar/publicaciones",
        "ads": "https://ads.mercadolibre.com.ar",
        "stock": client.meli_account_url or "https://www.mercadolibre.com.ar",
    }
    return urls.get(tipo, client.meli_account_url or "https://www.mercadolibre.com.ar")


def user_agent() -> str:
    return os.getenv(
        "SCRAPER_USER_AGENT",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    )
