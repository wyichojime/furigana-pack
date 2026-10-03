# SPDX-License-Identifier: MIT
# Copyright (c) 2026 wyichojime (furigana-pack)
"""照合器を 1 回だけ準備し、本文に振り仮名を付ける（JS 版 createAnnotator と同じ出力）"""
from __future__ import annotations

import os
import re
from typing import Callable, List, Optional, Union

from .loader import from_compiled_file
from .matcher import match_ranges
from .models import Matcher, RubyRange


# 青空文庫形式の振り仮名の記法（｜親文字《読み》、漢字《読み》）と、親文字・読みに入ると記法が壊れる文字
_AOZORA_RUBY = re.compile("[｜|][^｜|《》\r\n]*《[^《》\r\n]*》|《[^《》\r\n]*》")
_AOZORA_SPECIAL = re.compile("[｜|《》\r\n]")


def _is_kanji_cp(c: int) -> bool:
    # RUBY-021 と同じ漢字（コードポイントで判定。U+20000–U+3FFFF と、JS 版にそろえて片方だけの上位サロゲート）
    return (
        0x4E00 <= c <= 0x9FFF
        or 0x3400 <= c <= 0x4DBF
        or 0xF900 <= c <= 0xFAFF
        or 0x3005 <= c <= 0x3007
        or c == 0x30F6
        or 0x20000 <= c <= 0x3FFFF
        or 0xD840 <= c <= 0xD8BF
    )


def _aozora_ruby_mask(text: str) -> Optional[bytearray]:
    """本文で既に振り仮名の付いた箇所（｜親文字《読み》の全体、漢字《読み》は直前に続く漢字と《読み》）の印。無ければ None"""
    mask = None
    for m in _AOZORA_RUBY.finditer(text):
        start = m.start()
        if m.group()[0] == "《":
            while start > 0 and _is_kanji_cp(ord(text[start - 1])):
                start -= 1
        if mask is None:
            mask = bytearray(len(text))
        mask[start : m.end()] = b"\x01" * (m.end() - start)
    return mask


def _escape_html(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")


class Annotator:
    def __init__(self, matcher: Matcher):
        self._matcher = matcher

    @staticmethod
    def from_compiled_file(path: Union[str, "os.PathLike[str]"]) -> "Annotator":
        return Annotator(from_compiled_file(path))

    def ranges(self, text: str) -> List[RubyRange]:
        """振り仮名の位置と読み（コードポイントの位置、start の昇順）"""
        return match_ranges(self._matcher, text)

    def to_html(self, text: str) -> str:
        """<ruby>漢字<rt>かんじ</rt></ruby> の HTML（本文の HTML 特殊文字はエスケープ）"""
        return self._render(text, _escape_html, lambda b, r: f"<ruby>{_escape_html(b)}<rt>{_escape_html(r)}</rt></ruby>")

    def to_aozora(self, text: str) -> str:
        """青空文庫形式（｜漢字《かんじ》）。記法が壊れないよう、親文字・読みに ｜ | 《 》 改行を含む語と、
        本文で既に振り仮名の付いた箇所（｜親文字《読み》・漢字《読み》）には付けない"""
        mask = _aozora_ruby_mask(text)
        return self._render(
            text,
            lambda s: s,
            lambda b, r: f"｜{b}《{r}》",
            lambda r: bool(
                _AOZORA_SPECIAL.search(r.reading)
                or _AOZORA_SPECIAL.search(text[r.start : r.end])
                or (mask is not None and 1 in mask[r.start : r.end])
            ),
        )

    def _render(
        self,
        text: str,
        plain: Callable[[str], str],
        ruby: Callable[[str, str], str],
        skip: Optional[Callable[[RubyRange], bool]] = None,
    ) -> str:
        # 位置はコードポイント。片方だけのサロゲートを含む辞書（実際のパックにはない）でだけ、
        # 広げた範囲が次の範囲を飲み込むことがあり、その場合は次の範囲を飛ばす
        out = []
        pos = 0
        for r in self.ranges(text):
            # 重なる・空の・本文の外の範囲は付けない（Matcher.create に不正な照合単位を渡された場合に備える）
            if r.start < pos or r.end <= r.start or r.end > len(text):
                continue
            if skip is not None and skip(r):
                continue
            out.append(plain(text[pos : r.start]))
            out.append(ruby(text[r.start : r.end], r.reading))
            pos = r.end
        out.append(plain(text[pos:]))
        return "".join(out)
