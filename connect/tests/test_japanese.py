"""Tests for furigana/romaji conversion (lyrics/japanese.py) and the
/lyrics/furigana, /lyrics/furigana-fragment, /lyrics/romaji,
/lyrics/romaji-tokens, /lyrics/tokens endpoints that expose it."""

from lyrics import japanese


# ── has_kana / has_japanese ─────────────────────────────────────────────────


def test_has_kana_true_for_hiragana_and_katakana():
    assert japanese.has_kana("すき")
    assert japanese.has_kana("スキ")


def test_has_kana_false_for_kanji_only():
    assert not japanese.has_kana("音楽")


def test_has_japanese_true_for_kanji_only():
    assert japanese.has_japanese("音楽")


def test_has_japanese_false_for_non_japanese():
    assert not japanese.has_kana("hello")
    assert not japanese.has_japanese("hello 123")


# ── convert_furigana ─────────────────────────────────────────────────────────


def test_convert_furigana_wraps_only_the_kanji_core():
    # "食べる" -> reading "たべる"; only the "食"/"た" core should be
    # wrapped, with the shared trailing kana "べる" left as plain text.
    result = japanese.convert_furigana("食べる")
    assert result == "<ruby>食<rp>(</rp><rt>た</rt><rp>)</rp></ruby>べる"


def test_convert_furigana_leaves_non_japanese_untouched():
    assert japanese.convert_furigana("Hello World") == "Hello World"


def test_convert_furigana_leaves_already_kana_untouched():
    assert japanese.convert_furigana("すきです") == "すきです"


def test_convert_furigana_preserves_newlines():
    result = japanese.convert_furigana("音楽\n好き")
    assert result == (
        "<ruby>音楽<rp>(</rp><rt>おんがく</rt><rp>)</rp></ruby>"
        "\n"
        "<ruby>好<rp>(</rp><rt>す</rt><rp>)</rp></ruby>き"
    )


def test_convert_furigana_fragment_requires_japanese_not_just_kana():
    assert japanese.convert_furigana_fragment("音楽") != "音楽"
    assert japanese.convert_furigana_fragment("hello") == "hello"
    assert japanese.convert_furigana_fragment("") == ""


# ── convert_romaji ───────────────────────────────────────────────────────────


def test_convert_romaji_basic():
    assert japanese.convert_romaji("好きな音楽") == "suki na ongaku"


def test_convert_romaji_returns_empty_without_kana():
    assert japanese.convert_romaji("音楽") == ""
    assert japanese.convert_romaji("hello") == ""


def test_convert_romaji_collapses_newlines_to_single_space():
    result = japanese.convert_romaji("すき\nです")
    assert "\n" not in result
    assert result == "suki desu"


# ── parse_lyrics_text_tokens ─────────────────────────────────────────────────


def test_parse_lyrics_text_tokens_boundaries_cover_the_whole_string():
    text = "食べる音楽"
    tokens = japanese.parse_lyrics_text_tokens(text)
    assert "".join(t["text"] for t in tokens) == text
    assert tokens[0]["startChar"] == 0
    assert tokens[-1]["endChar"] == len(text)


def test_parse_lyrics_text_tokens_empty_without_japanese():
    assert japanese.parse_lyrics_text_tokens("hello") == []
    assert japanese.parse_lyrics_text_tokens("") == []


# ── convert_romaji_tokens ────────────────────────────────────────────────────


def test_convert_romaji_tokens_romanizes_japanese_tokens_only():
    tokens = japanese.convert_romaji_tokens("好きmusic")
    by_text = {t["text"]: t["romaji"] for t in tokens}
    assert by_text["好き"] == "suki"
    assert by_text["music"] == "music"


def test_convert_romaji_tokens_empty_without_kana():
    assert japanese.convert_romaji_tokens("音楽") == []


# ── routes ────────────────────────────────────────────────────────────────────


def test_furigana_route(client):
    r = client.post("/lyrics/furigana", json={"text": "食べる"})
    assert r.status_code == 200
    assert r.json() == "<ruby>食<rp>(</rp><rt>た</rt><rp>)</rp></ruby>べる"


def test_furigana_fragment_route(client):
    r = client.post("/lyrics/furigana-fragment", json={"text": "hello"})
    assert r.status_code == 200
    assert r.json() == "hello"


def test_romaji_route(client):
    r = client.post("/lyrics/romaji", json={"text": "好きな音楽"})
    assert r.status_code == 200
    assert r.json() == "suki na ongaku"


def test_tokens_route(client):
    r = client.post("/lyrics/tokens", json={"text": "音楽"})
    assert r.status_code == 200
    assert r.json() == [{"endChar": 2, "startChar": 0, "text": "音楽"}]


def test_romaji_tokens_route(client):
    r = client.post("/lyrics/romaji-tokens", json={"text": "好き"})
    assert r.status_code == 200
    assert r.json() == [
        {"endChar": 2, "romaji": "suki", "startChar": 0, "text": "好き"}
    ]
