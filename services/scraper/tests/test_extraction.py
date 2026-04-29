"""Async extraction + parser tests with mocked Playwright pages."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from scrapers.mercadolibre import (
    extract_ads,
    extract_publicaciones,
    extract_salud,
    extract_stock,
    parse_ar_number,
    scrape_with_page,
)
from models import ClientContext


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("1.234,56", 1234.56),
        ("96%", 96.0),
        ("0,3%", 0.3),
        ("  ", None),
        (None, None),
        ("760.000", 760000.0),
        ("3,1", 3.1),
        ("12.34", 12.34),
        ("$ 1.500,25", 1500.25),
    ],
)
def test_parse_ar_number_argentine_format(raw, expected):
    assert parse_ar_number(raw) == expected


def _mock_locator_chain(body_text: str):
    """Minimal Playwright-like locator mock for extract_* helpers."""

    def make_loc(selector: str):
        loc = MagicMock()
        if selector == "body":
            loc.inner_text = AsyncMock(return_value=body_text)
            loc.count = AsyncMock(return_value=1)
            loc.first = loc
            return loc
        # data-testid and xpath ancestors — empty
        loc.count = AsyncMock(return_value=0)
        loc.first = MagicMock(count=AsyncMock(return_value=0))
        return loc

    return make_loc


@pytest.mark.asyncio
async def test_extract_salud_valid_body_snippet():
    body_text = (
        "Mi reputación\n"
        "Reclamos\n"
        "1,2 %\n"
        "Mediaciones\n"
        "0,3 %\n"
        "Cancelaciones del vendedor\n"
        "0,8 %\n"
        "Envíos a tiempo\n"
        "96 %\n"
    )
    page = MagicMock()
    page.locator = MagicMock(side_effect=_mock_locator_chain(body_text))
    page.get_by_text = MagicMock(
        return_value=MagicMock(
            first=MagicMock(count=AsyncMock(return_value=0)),
        )
    )

    out = await extract_salud(page)
    assert out["reclamos"] == pytest.approx(1.2)
    assert out["mediaciones"] == pytest.approx(0.3)
    assert out["cancelaciones_vendedor"] == pytest.approx(0.8)
    assert out["envios_a_tiempo"] == pytest.approx(96.0)


@pytest.mark.asyncio
async def test_extract_salud_missing_field_returns_none():
    body_text = "Reclamos\n1 %\nMediaciones\n"
    page = MagicMock()
    page.locator = MagicMock(side_effect=_mock_locator_chain(body_text))
    page.get_by_text = MagicMock(
        return_value=MagicMock(first=MagicMock(count=AsyncMock(return_value=0)))
    )

    out = await extract_salud(page)
    assert out["reclamos"] == pytest.approx(1.0)
    assert out["mediaciones"] is None


@pytest.mark.asyncio
async def test_extract_publicaciones_ctr():
    body_text = (
        "Resumen\npublicaciones activas\n88 %\nOptimización\n82 %\nCTR\n3,1 %\n"
    )
    page = MagicMock()
    page.locator = MagicMock(side_effect=_mock_locator_chain(body_text))
    page.get_by_text = MagicMock(
        return_value=MagicMock(first=MagicMock(count=AsyncMock(return_value=0)))
    )

    out = await extract_publicaciones(page)
    assert out["pubs_activas_pct"] == pytest.approx(88.0)
    assert out["pubs_optimizadas_pct"] == pytest.approx(82.0)
    assert out["ctr"] == pytest.approx(3.1)


@pytest.mark.asyncio
async def test_extract_ads_roas_acos():
    body_text = "ACOS\n12,3 %\nROAS\n8,1\nTACOS\n5,3\n"
    page = MagicMock()
    page.locator = MagicMock(side_effect=_mock_locator_chain(body_text))
    page.get_by_text = MagicMock(
        return_value=MagicMock(first=MagicMock(count=AsyncMock(return_value=0)))
    )

    out = await extract_ads(page)
    assert out["acos"] == pytest.approx(12.3)
    assert out["roas"] == pytest.approx(8.1)
    assert out["tacos"] == pytest.approx(5.3)


@pytest.mark.asyncio
async def test_extract_stock_lead_time():
    body_text = "Lead time\n6\nsistema de reposición\n78 %\n"
    page = MagicMock()
    page.locator = MagicMock(side_effect=_mock_locator_chain(body_text))
    page.get_by_text = MagicMock(
        return_value=MagicMock(first=MagicMock(count=AsyncMock(return_value=0)))
    )

    out = await extract_stock(page)
    assert out["lead_time_reposicion"] == pytest.approx(6.0)
    assert out["sistema_reposicion"] == pytest.approx(78.0)


@pytest.mark.asyncio
async def test_auth_wall_mid_session_warning():
    page = AsyncMock()
    page.goto = AsyncMock()
    page.wait_for_load_state = AsyncMock()
    client = ClientContext(id="x", name="n", meli_seller_id=None, meli_account_url=None)

    with patch.dict(os.environ, {"SCRAPER_DEBUG_HTML": "false"}, clear=False):
        with patch(
            "scrapers.mercadolibre.looks_like_auth_wall",
            new=AsyncMock(side_effect=[False, True]),
        ):
            metrics, warns = await scrape_with_page(page, client, "salud")

    assert metrics == {}
    assert warns == ["auth_wall_mid_session"]


@pytest.mark.asyncio
async def test_empty_body_returns_null_fields():
    page = MagicMock()
    empty = MagicMock()
    empty.inner_text = AsyncMock(return_value="")
    empty.count = AsyncMock(return_value=1)
    empty.first = empty
    page.locator = MagicMock(return_value=empty)
    page.get_by_text = MagicMock(
        return_value=MagicMock(first=MagicMock(count=AsyncMock(return_value=0)))
    )

    out = await extract_salud(page)
    assert all(out[k] is None for k in out)
