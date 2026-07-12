"""japanese.py — furigana/romaji conversion for Japanese lyrics.

Port of src/main/features/core/lyrics/furigana.ts (Electron main process,
kuroshiro + kuroshiro-analyzer-kuromoji) for the web/Docker build, which has
no main process to run those IPC handlers.

Uses pykakasi instead of kuromoji — pure Python, no MeCab/native dependency
to complicate the cross-platform PyInstaller build (same reasoning as Genius
being left out of lyrics/__init__.py). Its dictionary-based segmentation is
less accurate than kuromoji's statistical model for ambiguous word
boundaries, but the output format matches what the frontend expects: the
shared parser (lyric-conversion.ts) looks for literal
<ruby>base<rp>(</rp><rt>reading</rt><rp>)</rp></ruby> HTML.
"""

import re
from typing import Any

import pykakasi

_HIRAGANA = "\u3040-\u309F"
_KATAKANA = "\u30A0-\u30FF"
_KANJI = "\u4E00-\u9FFF"

_KANA_RE = re.compile(f"[{_HIRAGANA}{_KATAKANA}]")
_JAPANESE_RE = re.compile(f"[{_HIRAGANA}{_KATAKANA}{_KANJI}]")
_KANJI_RE = re.compile(f"[{_KANJI}]")

_kakasi: pykakasi.kakasi | None = None


def _get_kakasi() -> pykakasi.kakasi:
    global _kakasi
    if _kakasi is None:
        _kakasi = pykakasi.kakasi()
    return _kakasi


def has_kana(text: str) -> bool:
    return bool(_KANA_RE.search(text))


def has_japanese(text: str) -> bool:
    return bool(_JAPANESE_RE.search(text))


def _tokenize(text: str) -> list[dict[str, Any]]:
    """Tokenize `text` into pykakasi's {orig, hira, hepburn, ...} dicts.

    pykakasi.kakasi().convert() silently duplicates trailing segments once a
    newline is embedded in the input (observed with pykakasi 2.3.0), so
    lyrics — which are always multi-line — must be converted line by line
    and stitched back together with explicit newline tokens.
    """
    lines = text.split("\n")
    tokens: list[dict[str, Any]] = []
    for i, line in enumerate(lines):
        if i > 0:
            tokens.append({"hepburn": "\n", "hira": "\n", "orig": "\n"})
        if line:
            tokens.extend(_get_kakasi().convert(line))
    return tokens


def _ruby_core(surface: str, reading: str) -> tuple[str, str, str, str]:
    """Strip the longest common prefix/suffix `surface` and `reading` share
    (typically trailing okurigana), leaving only the kanji-bearing core to
    annotate — e.g. "食べる"/"たべる" -> core "食"/"た", suffix "べる", so
    the result reads "食[た]べる" instead of ruby over the whole word.
    """
    max_prefix = min(len(surface), len(reading))
    i = 0
    while i < max_prefix and surface[i] == reading[i]:
        i += 1

    max_suffix = min(len(surface), len(reading)) - i
    j = 0
    while j < max_suffix and surface[len(surface) - 1 - j] == reading[len(reading) - 1 - j]:
        j += 1

    prefix = surface[:i]
    suffix = surface[len(surface) - j :] if j else ""
    core_surface = surface[i : len(surface) - j] if j else surface[i:]
    core_reading = reading[i : len(reading) - j] if j else reading[i:]
    return prefix, core_surface, core_reading, suffix


def _furigana_for_token(orig: str, hira: str) -> str:
    if not orig or orig == hira or not _KANJI_RE.search(orig):
        return orig

    prefix, core_surface, core_reading, suffix = _ruby_core(orig, hira)
    if not core_surface or not _KANJI_RE.search(core_surface):
        return orig

    return f"{prefix}<ruby>{core_surface}<rp>(</rp><rt>{core_reading}</rt><rp>)</rp></ruby>{suffix}"


def convert_furigana(text: str) -> str:
    if not has_kana(text):
        return text
    return "".join(_furigana_for_token(t["orig"], t["hira"]) for t in _tokenize(text))


def convert_furigana_fragment(text: str) -> str:
    if not text or not has_japanese(text):
        return text
    return "".join(_furigana_for_token(t["orig"], t["hira"]) for t in _tokenize(text))


def convert_romaji(text: str) -> str:
    if not has_kana(text):
        return ""
    joined = " ".join(t["hepburn"] for t in _tokenize(text) if t["orig"])
    return re.sub(r"\s+", " ", joined).strip()


def parse_lyrics_text_tokens(text: str) -> list[dict[str, Any]]:
    if not text or not has_japanese(text):
        return []

    tokens = []
    cursor = 0
    for t in _tokenize(text):
        surface = t["orig"]
        start = cursor
        cursor += len(surface)
        tokens.append({"endChar": cursor, "startChar": start, "text": surface})
    return tokens


def convert_romaji_tokens(text: str) -> list[dict[str, Any]]:
    if not has_kana(text):
        return []

    tokens = []
    cursor = 0
    for t in _tokenize(text):
        surface = t["orig"]
        start = cursor
        cursor += len(surface)
        romaji = t["hepburn"] if has_japanese(surface) else surface
        tokens.append(
            {"endChar": cursor, "romaji": romaji, "startChar": start, "text": surface}
        )
    return tokens
