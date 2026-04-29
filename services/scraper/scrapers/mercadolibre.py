import logging
import os
import re
from pathlib import Path

from playwright.async_api import TimeoutError as PlaywrightTimeoutError, async_playwright

from models import ClientContext, ScrapeResult, SessionValidationResult

logger = logging.getLogger(__name__)

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


def parse_ar_number(raw: str | None) -> float | None:
    """
    Parse numbers that may use Argentine formatting: '.' thousands, ',' decimals.
    Strips currency symbols and whitespace; handles trailing %.
    """
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    s = re.sub(r"[\$\u00a0\u202f\s]", "", s)
    if s.endswith("%"):
        s = s[:-1].strip()
    if not s:
        return None
    try:
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            parts = s.split(",")
            if len(parts[-1]) <= 2 and len(parts) == 2:
                s = parts[0].replace(".", "") + "." + parts[1]
            else:
                s = s.replace(",", ".")
        elif s.count(".") > 1:
            s = s.replace(".", "")
        elif "." in s:
            parts = s.split(".")
            if len(parts) == 2 and len(parts[1]) == 3 and parts[0].isdigit():
                s = parts[0] + parts[1]
        return float(s)
    except ValueError:
        return None


_AR_NUMBER_RE = re.compile(
    r"(?:^|[^\d])(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)(?:\s*%)?",
    re.MULTILINE,
)


def _first_numeric_fragment(text: str | None) -> str | None:
    if not text:
        return None
    m = _AR_NUMBER_RE.search(text)
    if not m:
        return None
    frag = m.group(1)
    if text[m.start() : m.end()].strip().endswith("%"):
        return frag + "%"
    return frag


async def _maybe_dump_debug_html(page, tipo: str) -> None:
    if os.getenv("SCRAPER_DEBUG_HTML", "").lower() != "true":
        return
    try:
        html = await page.content()
        out = Path(f"/tmp/debug_{tipo}.html")
        out.write_text(html, encoding="utf-8")
        logger.info("wrote debug HTML to %s", out)
    except Exception as exc:
        logger.warning("SCRAPER_DEBUG_HTML dump failed: %s", exc)


async def _inner_text_safe(locator) -> str | None:
    try:
        if await locator.count() == 0:
            return None
        t = await locator.first.inner_text()
        return t if t else None
    except Exception as exc:
        logger.debug("inner_text_safe: %s", exc)
        return None


async def _extract_near_label(
    page,
    field_name: str,
    label_regexes: list[str],
    selector_attempt: str,
) -> float | None:
    """
    Try table/row/list patterns near visible label text.
    # TODO: verify selector — validate against live /reputacion, /publicaciones, ads hub, stock hub HTML.
    """
    for label_re in label_regexes:
        try:
            hit = page.get_by_text(re.compile(label_re, re.I)).first
            if await hit.count() == 0:
                continue
            row = hit.locator("xpath=ancestor::tr[1]")
            if await row.count():
                txt = await _inner_text_safe(row)
                val = parse_ar_number(_first_numeric_fragment(txt))
                if val is not None:
                    return val
            container = hit.locator("xpath=ancestor::*[self::li or self::div][1]")
            if await container.count():
                txt = await _inner_text_safe(container)
                val = parse_ar_number(_first_numeric_fragment(txt))
                if val is not None:
                    return val
        except Exception as exc:
            logger.warning(
                "extract field=%s selector=%s label=%s error=%s",
                field_name,
                selector_attempt,
                label_re,
                exc,
            )
    return None


async def _snippet_after_needles(page, field_name: str, needles: list[str]) -> float | None:
    """Last resort: find plain-text needle in body (case-insensitive), parse first number in following snippet."""
    try:
        body = await page.locator("body").inner_text()
    except Exception as exc:
        logger.warning("extract field=%s body_text failed: %s", field_name, exc)
        return None
    if not body:
        return None
    lower = body.lower()
    for needle in needles:
        try:
            found = re.search(re.escape(needle.lower()), lower)
            if not found:
                continue
            start = found.start()
            snippet = body[start : start + 280]
            frag = _first_numeric_fragment(snippet)
            val = parse_ar_number(frag)
            if val is not None:
                return val
        except Exception as exc:
            logger.warning("extract field=%s needle=%s error=%s", field_name, needle, exc)
    return None


async def _extract_testid_optional(page, field_name: str, test_ids: list[str]) -> float | None:
    for tid in test_ids:
        try:
            loc = page.locator(f'[data-testid="{tid}"]')
            if await loc.count() == 0:
                continue
            txt = await _inner_text_safe(loc)
            val = parse_ar_number(txt) or parse_ar_number(_first_numeric_fragment(txt))
            if val is not None:
                return val
        except Exception as exc:
            logger.warning("extract field=%s data-testid=%s error=%s", field_name, tid, exc)
    return None


SALUD_FALLBACK_NEEDLES: dict[str, list[str]] = {
    "reclamos": ["reclamos"],
    "mediaciones": ["mediaciones"],
    "cancelaciones_vendedor": ["cancelaciones del vendedor", "cancelaciones"],
    "envios_a_tiempo": ["envíos a tiempo", "envios a tiempo", "envíos en fecha"],
}


async def extract_salud(page) -> dict:
    """https://www.mercadolibre.com.ar/reputacion — reclamos, mediaciones, cancelaciones, envíos."""
    out: dict = {}

    fields = [
        (
            "reclamos",
            [r"reclamo[s]?"],
            # TODO: verify selector — UNVERIFIED against live DOM
            ["reputation-claims", "claims-value", "andes-reputation-claims"],
        ),
        (
            "mediaciones",
            [r"mediaci[oó]n(es)?"],
            ["reputation-mediations", "mediations-value"],
        ),
        (
            "cancelaciones_vendedor",
            [r"cancelaciones\s+del\s+vendedor", r"cancelaci[oó]n(es)?\s+.*vendedor"],
            ["seller-cancellations"],
        ),
        (
            "envios_a_tiempo",
            [r"env[ií]os?\s+a\s+tiempo", r"env[ií]os?\s+en\s+fecha"],
            ["on-time-shipments", "shipments-ontime"],
        ),
    ]

    for key, label_res, testids in fields:
        try:
            v = await _extract_testid_optional(page, key, testids)
            if v is None:
                v = await _extract_near_label(page, key, label_res, "ancestor-row-or-li")
            if v is None:
                v = await _snippet_after_needles(page, key, SALUD_FALLBACK_NEEDLES[key])
            if v is not None:
                out[key] = v
            else:
                out[key] = None
                logger.warning("extract field=%s no value (salud)", key)
        except Exception as exc:
            logger.warning("extract field=%s failed: %s", key, exc)
            out[key] = None

    return out


PUB_FALLBACK_NEEDLES: dict[str, list[str]] = {
    "pubs_activas_pct": ["publicaciones activas", "activas"],
    "pubs_optimizadas_pct": ["optimizadas", "optimización"],
    "ctr": ["ctr", "clics", "impresiones"],
}


async def extract_publicaciones(page) -> dict:
    """https://www.mercadolibre.com.ar/publicaciones — activas %, optimizadas %, CTR."""
    out: dict = {}

    pairs = [
        ("pubs_activas_pct", [r"publicaciones?\s+activas", r"activas"], ["listings-active-pct"]),
        ("pubs_optimizadas_pct", [r"optimizadas?", r"optimizaci[oó]n"], ["listings-optimized-pct"]),
        ("ctr", [r"\bctr\b", r"tasas?\s+de\s+clics?", r"clics?\s+/\s+impresiones?"], ["listings-ctr"]),
    ]

    for key, label_res, testids in pairs:
        try:
            v = await _extract_testid_optional(page, key, testids)
            if v is None:
                v = await _extract_near_label(page, key, label_res, "ancestor-row-or-li")
            if v is None:
                v = await _snippet_after_needles(page, key, PUB_FALLBACK_NEEDLES[key])
            out[key] = v if v is not None else None
            if v is None:
                logger.warning("extract field=%s no value (publicaciones)", key)
        except Exception as exc:
            logger.warning("extract field=%s failed: %s", key, exc)
            out[key] = None

    return out


ADS_FALLBACK_NEEDLES: dict[str, list[str]] = {
    "margen_pre_ads": ["margen", "margen bruto"],
    "gasto_ads": ["gasto", "inversión", "inversion"],
    "ventas_ads": ["ventas ads", "ventas atribuidas"],
    "ventas_totales": ["ventas totales"],
    "acos": ["acos"],
    "roas": ["roas"],
    "tacos": ["tacos"],
}


async def extract_ads(page) -> dict:
    """https://ads.mercadolibre.com.ar — PADS summary metrics."""
    out: dict = {}

    spec = [
        ("margen_pre_ads", [r"margen\s+(?:pre\s*)?(?:ads|publicidad)?", r"margen\s+bruto"], ["ads-margin"]),
        ("gasto_ads", [r"gasto\s+(?:en\s+)?(?:ads|publicidad)?", r"inversi[oó]n"], ["ads-spend", "spend-value"]),
        ("ventas_ads", [r"ventas?\s+(?:atribuidas\s+)?(?:a\s+)?(?:ads|publicidad)?"], ["ads-sales"]),
        ("ventas_totales", [r"ventas?\s+totales"], ["total-sales"]),
        ("acos", [r"\bacos\b"], ["acos-value"]),
        ("roas", [r"\broas\b"], ["roas-value"]),
        ("tacos", [r"\btacos\b"], ["tacos-value"]),
    ]

    for key, label_res, testids in spec:
        try:
            v = await _extract_testid_optional(page, key, testids)
            if v is None:
                v = await _extract_near_label(page, key, label_res, "ancestor-row-or-li")
            if v is None:
                v = await _snippet_after_needles(page, key, ADS_FALLBACK_NEEDLES[key])
            out[key] = v if v is not None else None
            if v is None:
                logger.warning("extract field=%s no value (ads)", key)
        except Exception as exc:
            logger.warning("extract field=%s failed: %s", key, exc)
            out[key] = None

    return out


STOCK_FALLBACK_NEEDLES: dict[str, list[str]] = {
    "incidencias_pct": ["incidencias"],
    "uso_full_flex_pct": ["full flex", "full-flex"],
    "cancelaciones_stock_pct": ["cancelaciones", "stock"],
    "skus_sin_stock_pct": ["sin stock", "sku"],
    "dias_stock": ["días de stock", "dias de stock", "cobertura"],
    "lead_time_reposicion": ["lead time", "reposición", "reposicion"],
    "sistema_reposicion": ["sistema de reposición", "sistema de reposicion"],
}


async def extract_stock(page) -> dict:
    """
    Stock / logístico metrics — typically seller hub or inventario views.
    meli_account_url may point at hub home; metrics often under inventario / stock cards.
    """
    out: dict = {}

    spec = [
        ("incidencias_pct", [r"incidencias?", r"problemas?\s+logísticos?"], ["stock-incidents"]),
        ("uso_full_flex_pct", [r"full[\s\-/]*flex", r"full\s+y\s+flex"], ["full-flex-pct"]),
        ("cancelaciones_stock_pct", [r"cancelaciones?\s+.*stock", r"cancelaci[oó]n(es)?\s+logística"], ["cancel-stock"]),
        ("skus_sin_stock_pct", [r"sku[s]?\s+sin\s+stock", r"sin\s+stock"], ["skus-oos-pct"]),
        ("dias_stock", [r"d[ií]as?\s+de\s+stock", r"cobertura"], ["days-stock"]),
        ("lead_time_reposicion", [r"lead\s*time", r"tiempo\s+de\s+reposici[oó]n"], ["lead-time"]),
        ("sistema_reposicion", [r"sistema\s+de\s+reposici[oó]n", r"reposici[oó]n\s+automática"], ["repo-system"]),
    ]

    for key, label_res, testids in spec:
        try:
            v = await _extract_testid_optional(page, key, testids)
            if v is None:
                v = await _extract_near_label(page, key, label_res, "ancestor-row-or-li")
            if v is None:
                v = await _snippet_after_needles(page, key, STOCK_FALLBACK_NEEDLES[key])
            out[key] = v if v is not None else None
            if v is None:
                logger.warning("extract field=%s no value (stock)", key)
        except Exception as exc:
            logger.warning("extract field=%s failed: %s", key, exc)
            out[key] = None

    return out


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
            metrics, extra_warnings = await scrape_with_page(page, client, tipo)
        finally:
            await context.close()
            await browser.close()

    return ScrapeResult(tipo=tipo, metrics=metrics, warnings=extra_warnings)


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


async def scrape_with_page(page, client: ClientContext, tipo: str) -> tuple[dict, list[str]]:
    warnings: list[str] = []
    try:
        await page.goto(target_url(client, tipo), wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        return {}, []

    if await looks_like_auth_wall(page):
        return {}, []

    await _maybe_dump_debug_html(page, tipo)

    if await looks_like_auth_wall(page):
        return {}, ["auth_wall_mid_session"]

    extractors = {
        "salud": extract_salud,
        "publicaciones": extract_publicaciones,
        "ads": extract_ads,
        "stock": extract_stock,
    }
    fn = extractors.get(tipo)
    if not fn:
        return {}, warnings

    try:
        metrics = await fn(page)
    except Exception:
        logger.exception("extract block failed tipo=%s", tipo)
        return {}, warnings

    if not isinstance(metrics, dict):
        return {}, warnings

    return metrics, warnings


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
