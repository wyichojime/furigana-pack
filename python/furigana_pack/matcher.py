# SPDX-License-Identifier: MIT
# Copyright (c) 2026 wyichojime (furigana-pack)
"""準備した照合器で本文に振り仮名を付ける（JS 版 matchRanges と同じ結果。RUBY-015・021・022・023・025・027）。
照合は UTF-16 のコード単位で行う（位置・漢字の判定・サロゲートの扱いを JS 版とそろえるため）。"""
from __future__ import annotations

from typing import List, Tuple

from .models import Matcher, RubyRange, utf16, utf16_units

# RUBY-025: 全角の英数字・記号（！〜～）を半角に、全角スペースを半角スペースに（文字数は変わらない）
_FOLD = {c: c - 0xFEE0 for c in range(0xFF01, 0xFF5F)}
_FOLD[0x3000] = 0x20

# RUBY-023: 「+助詞」の語の直後に来てよい助詞（JS 版と同じ並び）
_PARTICLES = tuple(
    utf16(p)
    for p in (
        "が", "の", "を", "に", "へ", "と", "で", "や", "は", "も", "か", "よ", "な", "ぞ",
        "から", "まで", "より", "だけ", "しか", "ほど", "など", "くらい", "ぐらい", "ばかり", "さえ",
        "でも", "こそ", "って", "だ", "です", "じゃ",
    )
)


def _is_kanji(c: int) -> bool:
    # RUBY-021: 漢字（UTF-16 コード単位で判定。U+20000–U+3FFFF は上位サロゲートで判定）
    return (
        0x4E00 <= c <= 0x9FFF
        or 0x3400 <= c <= 0x4DBF
        or 0xF900 <= c <= 0xFAFF
        or 0x3005 <= c <= 0x3007
        or c == 0x30F6
        or 0xD840 <= c <= 0xD8BF
    )


def _kanji_before(u, idx: int) -> bool:
    if idx <= 0:
        return False
    c = u[idx - 1]
    if 0xDC00 <= c <= 0xDFFF and idx >= 2:
        return _is_kanji(u[idx - 2])
    return _is_kanji(c)


def _kind_before(u, idx: int, occupied: bytearray) -> str:
    # RUBY-027: 直前の文字の種類。漢字はほかの登録語の範囲に入っている（占有済みの）ときだけ kanji
    if idx <= 0:
        return ""
    if _kanji_before(u, idx):
        return "kanji" if occupied[idx - 1] else ""
    c = u[idx - 1]
    if 0x3041 <= c <= 0x3096:
        return "hira"
    if 0x30A1 <= c <= 0x30FA or c == 0x30FC:
        return "kata"
    if 0x30 <= c <= 0x39 or 0x41 <= c <= 0x5A or 0x61 <= c <= 0x7A:
        return "alnum"
    return ""


def match_ranges_utf16(matcher: Matcher, text: str) -> List[Tuple[int, int, str]]:
    """振り仮名を UTF-16 の位置の (start, end, reading) で返す（start の昇順）"""
    if not text or not matcher.groups:
        return []
    folded = text.translate(_FOLD)
    data = utf16(folded)
    u = utf16_units(folded)
    n = len(u)
    # 本文のコード単位ごとの出現位置（昇順）
    positions = {}
    for i, c in enumerate(u):
        lst = positions.get(c)
        if lst is None:
            positions[c] = [i]
        else:
            lst.append(i)
    occupied = bytearray(n)
    visual: List[Tuple[int, int, str]] = []
    groups = matcher.groups

    # 短い本文: 本文に現れる文字から引いた候補が全体の 1/4 未満なら、候補だけを照合の順にたどる
    order = None
    by_char = matcher.by_char
    lists = [by_char[c] for c in positions if c in by_char]
    if sum(len(lst) for lst in lists) * 4 < len(groups):
        order = sorted(gi for lst in lists for gi in lst)
    if order is None:
        order = range(len(groups))

    for gi in order:
        mt = matcher.units[gi]
        length = len(mt)
        if length == 0:
            continue
        anchor = 0
        anchor_count = -1
        anchor_list = None
        for i, c in enumerate(mt):
            lst = positions.get(c)
            count = len(lst) if lst else 0
            if anchor_count < 0 or count < anchor_count:
                anchor, anchor_count, anchor_list = i, count, lst
                if count == 0:
                    break
        if anchor_count == 0:
            continue
        mb = matcher.data[gi]
        forms = groups[gi].forms
        needs = matcher.needs_context[gi]
        next_start = 0
        for p in anchor_list:
            idx = p - anchor
            if idx < next_start:
                continue
            if idx + length > n:
                break
            if not data.startswith(mb, 2 * idx):
                continue
            end = idx + length
            candidates = forms
            if needs:
                left_kind = _kind_before(u, idx, occupied)
                left_ok = not _kanji_before(u, idx) and left_kind != "kata" and left_kind != "alnum"
                kanji_after = end < n and _is_kanji(u[end])
                standalone_ok = left_ok and not kanji_after
                particle_ok = any(data.startswith(pt, 2 * end) for pt in _PARTICLES)
                right_ok = not kanji_after
                candidates = [
                    f
                    for f in forms
                    if (not f.standalone or standalone_ok)
                    and (not f.left_standalone or left_ok)
                    and (not f.particle or particle_ok)
                    and (not f.before or (f.before == left_kind and right_ok))
                ]
                if not candidates:
                    continue
                # RUBY-023/027: 条件付きの形が満たされたら、条件なしの形より優先する
                if any(f.particle or f.before for f in candidates):
                    candidates = [f for f in candidates if f.particle or f.before]
            if not any(occupied[idx:end]):
                occupied[idx:end] = b"\x01" * length
                # RUBY-022: 候補のルビ区間が食い違う（読みが割れる）ときはルビを付けない
                segments = candidates[0].segments
                if all(f.segments == segments for f in candidates):
                    for s in segments:
                        visual.append((idx + s.offset, idx + s.offset + s.length, s.reading))
            next_start = end
    visual.sort(key=lambda r: r[0])  # 安定な並べ替え（JS 版と同じ）
    return visual


def match_ranges(matcher: Matcher, text: str) -> List[RubyRange]:
    """振り仮名をコードポイントの位置の RubyRange で返す（text[r.start:r.end] が対象）。
    始まりはその位置を含む文字の位置、終わりは文字の途中なら文字の終わりに広げる"""
    ranges = match_ranges_utf16(matcher, text)
    if not ranges:
        return []
    cp_of_unit = []  # UTF-16 の位置 → それを含む文字のコードポイントの位置
    tail = []  # その位置がサロゲートペアの 2 つ目か
    for i, ch in enumerate(text):
        cp_of_unit.append(i)
        tail.append(False)
        if ord(ch) > 0xFFFF:
            cp_of_unit.append(i)
            tail.append(True)
    n = len(cp_of_unit)

    def start_cp(pos: int) -> int:
        return len(text) if pos >= n else cp_of_unit[pos]

    def end_cp(pos: int) -> int:
        if pos >= n:
            return len(text)
        return cp_of_unit[pos] + 1 if tail[pos] else cp_of_unit[pos]

    # 本文の外を指す範囲（Matcher.create に不正な照合単位を渡された場合だけ出る）は変換できないので返さない
    return [RubyRange(start_cp(s), end_cp(e), r) for s, e, r in ranges if 0 <= s <= e <= n]
