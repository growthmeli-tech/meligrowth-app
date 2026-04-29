"""SCRAPER_MOCK_MODE behaviour."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models import ClientContext
from scrapers import mercadolibre


@pytest.mark.asyncio
async def test_mock_mode_returns_fixture_without_browser(monkeypatch):
    monkeypatch.setenv("SCRAPER_MOCK_MODE", "true")
    ctx = ClientContext(id="c1", name="Test", meli_seller_id=None, meli_account_url=None)

    with patch.object(mercadolibre, "async_playwright") as ap:
        result = await mercadolibre.scrape_mercadolibre(ctx, "salud", session_state={"cookies": []})

    ap.assert_not_called()
    assert "mock_mode" in result.warnings
    assert result.metrics.get("reclamos") == 1.1


@pytest.mark.asyncio
async def test_live_mode_invokes_scrape_with_page(monkeypatch):
    monkeypatch.setenv("SCRAPER_MOCK_MODE", "false")
    ctx = ClientContext(id="c1", name="Test", meli_seller_id=None, meli_account_url=None)

    fake_pw = MagicMock()
    fake_browser = AsyncMock()
    fake_context = AsyncMock()
    fake_page = AsyncMock()

    fake_pw.chromium.launch = AsyncMock(return_value=fake_browser)
    fake_browser.new_context = AsyncMock(return_value=fake_context)
    fake_browser.close = AsyncMock()
    fake_context.new_page = AsyncMock(return_value=fake_page)
    fake_context.close = AsyncMock()

    async_cm = MagicMock()
    async_cm.__aenter__ = AsyncMock(return_value=fake_pw)
    async_cm.__aexit__ = AsyncMock(return_value=None)

    session_state = {"cookies": [], "origins": []}

    with patch.object(mercadolibre, "async_playwright", return_value=async_cm):
        with patch.object(
            mercadolibre,
            "scrape_with_page",
            new=AsyncMock(return_value=({"reclamos": 9.9}, ["from_test"])),
        ) as swp:
            result = await mercadolibre.scrape_mercadolibre(ctx, "salud", session_state=session_state)

    swp.assert_called_once()
    assert result.metrics["reclamos"] == 9.9
    assert result.warnings == ["from_test"]
    fake_browser.close.assert_awaited()
    fake_context.close.assert_awaited()
