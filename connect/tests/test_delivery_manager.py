"""Tests for DeliveryManager — parsing, factories and fan-out."""

import asyncio
from unittest.mock import AsyncMock, patch

from delivery import (
    AirPlayDelivery,
    ChromecastDelivery,
    DeliveryManager,
    SonosDelivery,
)


# ── _parse ────────────────────────────────────────────────────────────────────


def test_parse_empty_returns_no_deliveries():
    assert DeliveryManager("").deliveries == []
    assert DeliveryManager("   ").deliveries == []


def test_parse_single_sonos():
    m = DeliveryManager("sonos:Küche")
    assert len(m.deliveries) == 1
    assert isinstance(m.deliveries[0], SonosDelivery)
    assert m.deliveries[0].target == "Küche"


def test_parse_single_airplay():
    m = DeliveryManager("airplay:HomePod")
    assert isinstance(m.deliveries[0], AirPlayDelivery)
    assert m.deliveries[0].target == "HomePod"


def test_parse_single_chromecast():
    m = DeliveryManager("chromecast:LivingRoom TV")
    assert isinstance(m.deliveries[0], ChromecastDelivery)
    assert m.deliveries[0].target == "LivingRoom TV"


def test_parse_mixed_all_three_types():
    m = DeliveryManager("sonos:Küche,airplay:HomePod,chromecast:TV")
    assert len(m.deliveries) == 3
    assert isinstance(m.deliveries[0], SonosDelivery)
    assert isinstance(m.deliveries[1], AirPlayDelivery)
    assert isinstance(m.deliveries[2], ChromecastDelivery)


def test_parse_skips_unknown_type():
    m = DeliveryManager("sonos:Küche,bluetooth:Speaker")
    assert len(m.deliveries) == 1
    assert isinstance(m.deliveries[0], SonosDelivery)


def test_parse_skips_malformed_entry():
    m = DeliveryManager("sonos:Küche,no-colon-here,airplay:HomePod")
    assert len(m.deliveries) == 2
    assert isinstance(m.deliveries[0], SonosDelivery)
    assert isinstance(m.deliveries[1], AirPlayDelivery)


def test_parse_trims_whitespace_and_lowercases_type():
    m = DeliveryManager(" SONOS : Küche , Chromecast : TV ")
    assert len(m.deliveries) == 2
    assert m.deliveries[0].target == "Küche"
    assert m.deliveries[1].target == "TV"


# ── from_deliveries / list_targets ────────────────────────────────────────────


def test_from_deliveries_creates_manager_without_parsing():
    s = SonosDelivery("Küche")
    a = AirPlayDelivery("HomePod")
    c = ChromecastDelivery("TV")
    m = DeliveryManager.from_deliveries([s, a, c])
    assert m.deliveries == [s, a, c]


def test_list_targets_reports_type_and_name():
    m = DeliveryManager.from_deliveries(
        [SonosDelivery("Küche"), AirPlayDelivery("HomePod"), ChromecastDelivery("TV")]
    )
    assert m.list_targets() == [
        {"type": "sonos", "name": "Küche"},
        {"type": "airplay", "name": "HomePod"},
        {"type": "chromecast", "name": "TV"},
    ]


# ── play / stop fan-out ───────────────────────────────────────────────────────


def test_manager_play_calls_every_delivery():
    a = AirPlayDelivery("HomePod")
    c = ChromecastDelivery("TV")
    a.play = AsyncMock()
    c.play = AsyncMock()
    m = DeliveryManager.from_deliveries([a, c])

    asyncio.run(m.play("http://stream", "Title"))

    a.play.assert_awaited_once_with("http://stream", "Title")
    c.play.assert_awaited_once_with("http://stream", "Title")


def test_manager_stop_swallows_exceptions():
    a = AirPlayDelivery("HomePod")
    c = ChromecastDelivery("TV")
    a.stop = AsyncMock(side_effect=RuntimeError("boom"))
    c.stop = AsyncMock()
    m = DeliveryManager.from_deliveries([a, c])

    asyncio.run(m.stop())

    a.stop.assert_awaited_once()
    c.stop.assert_awaited_once()


def test_manager_play_single_sonos_skips_grouping():
    s = SonosDelivery("Küche")
    s.play = AsyncMock()
    m = DeliveryManager.from_deliveries([s])

    with patch.object(m, "_play_grouped_sonos", new=AsyncMock()) as grouped:
        asyncio.run(m.play("http://stream"))

    grouped.assert_not_awaited()
    s.play.assert_awaited_once()


def test_manager_play_multiple_sonos_uses_grouping():
    s1 = SonosDelivery("Küche")
    s2 = SonosDelivery("Wohnzimmer")
    s1.play = AsyncMock()
    s2.play = AsyncMock()
    m = DeliveryManager.from_deliveries([s1, s2])

    with patch.object(m, "_play_grouped_sonos", new=AsyncMock()) as grouped:
        asyncio.run(m.play("http://stream", "T"))

    grouped.assert_awaited_once()
