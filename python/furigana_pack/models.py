# SPDX-License-Identifier: MIT
# Copyright (c) 2026 wyichojime (furigana-pack)
"""振り仮名の照合に使う型（JS 版 src/core/types.ts、C# 版 Types.cs と同じ形）"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Sequence, Tuple


@dataclass(frozen=True)
class RubyRange:
    """本文に付ける振り仮名。start・end はコードポイントの位置（end は含まない）"""

    start: int
    end: int
    reading: str


@dataclass(frozen=True)
class Segment:
    """照合形の中で振り仮名を付ける区間（UTF-16 の位置）"""

    offset: int
    length: int
    reading: str


@dataclass(frozen=True)
class MatchForm:
    """照合単位の中の 1 形。before は "" か kanji・hira・kata・alnum（RUBY-027）"""

    segments: Tuple[Segment, ...]
    particle: bool = False
    standalone: bool = False
    left_standalone: bool = False
    before: str = ""


@dataclass(frozen=True)
class MatchGroup:
    """照合単位（同じ照合形・同じ priority の形をまとめたもの）。match_text は全角半角を畳んだ後のもの"""

    match_text: str
    priority: int
    order: int
    forms: Tuple[MatchForm, ...]


def utf16(s: str) -> bytes:
    """UTF-16LE のバイト列（片方だけのサロゲートもそのまま 1 コード単位にする）"""
    return s.encode("utf-16-le", "surrogatepass")


def utf16_units(s: str) -> Tuple[int, ...]:
    b = utf16(s)
    return tuple(int.from_bytes(b[i : i + 2], "little") for i in range(0, len(b), 2))


@dataclass(frozen=True, eq=False)
class Matcher:
    """照合器。groups は照合の順。Matcher.create でだけ作る（照合の索引と照合用の前処理を必ずそろえるため）"""

    groups: Tuple[MatchGroup, ...]
    units: Tuple[Tuple[int, ...], ...] = field(repr=False)
    data: Tuple[bytes, ...] = field(repr=False)
    needs_context: Tuple[bool, ...] = field(repr=False)
    by_char: Dict[int, Tuple[int, ...]] = field(repr=False)

    @staticmethod
    def create(groups: Sequence[MatchGroup]) -> "Matcher":
        groups = tuple(groups)
        units = tuple(utf16_units(g.match_text) for g in groups)
        return Matcher(
            groups=groups,
            units=units,
            data=tuple(utf16(g.match_text) for g in groups),
            needs_context=tuple(
                any(f.particle or f.standalone or f.left_standalone or f.before for f in g.forms) for g in groups
            ),
            by_char=build_index(units),
        )


def build_index(units: Sequence[Tuple[int, ...]]) -> Dict[int, Tuple[int, ...]]:
    """照合の索引（JS 版 indexMatcherGroups の移植）: 照合単位ごとに、照合形の中で（辞書全体で）最も出現の
    少ないコード単位を 1 つ選び、コード単位 → その単位を選んだ照合単位の番号（昇順）を引けるようにする。
    同じ出現数なら照合形の中で先の単位を選ぶ。照合形が空の照合単位は入れない。"""
    freq = [0] * 65536
    for u in units:
        for c in u:
            freq[c] += 1
    lists: Dict[int, list] = {}
    for gi, u in enumerate(units):
        best = -1
        for c in u:
            if best < 0 or freq[c] < freq[best]:
                best = c
        if best >= 0:
            lists.setdefault(best, []).append(gi)
    return {c: tuple(lst) for c, lst in lists.items()}
