# SPDX-License-Identifier: MIT
# Copyright (c) 2026 wyichojime (furigana-pack)
"""解釈済みの形（data/compiled/*.json）を読む。1 行目は見出し、2 行目以降は照合の順の照合単位"""
from __future__ import annotations

import json
import os
from typing import IO, Iterable, Union

from .models import Matcher, MatchForm, MatchGroup, Segment, utf16

FORMAT = "furigana-pack-compiled"
VERSION = 1


class CompiledFormatError(ValueError):
    """解釈済みの形として読めない（見出しが違う・壊れている・途中で切れている）"""


def _is_int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _read_head(line: str) -> dict:
    try:
        head = json.loads(line)
    except ValueError as e:
        raise CompiledFormatError(f"見出しを読めません: {e}") from None
    if not isinstance(head, dict):
        raise CompiledFormatError("見出しが JSON のオブジェクトではありません")
    if head.get("format") != FORMAT:
        raise CompiledFormatError(f"解釈済みの形ではありません（format が {FORMAT} でない）")
    if not _is_int(head.get("version")) or head["version"] != VERSION:
        raise CompiledFormatError(f"対応していない版です（version {VERSION} だけを読めます）")
    if "groupCount" in head and not _is_int(head["groupCount"]):
        raise CompiledFormatError("見出しの groupCount が数ではありません")
    return head


_BEFORE_KINDS = ("kanji", "hira", "kata", "alnum")


def _is_int32(v) -> bool:
    return _is_int(v) and -(2**31) <= v < 2**31


def _read_group(line: str, where: str) -> MatchGroup:
    """照合単位の 1 行を読む。型とルビ区間の範囲（照合形の中に収まる）を確かめ、合わなければ CompiledFormatError
    （改ざん・破損したデータで本文の外を指す振り仮名を返さないため。JS 版 matcherFromCompiled と同じ決まり）"""

    def bad(what: str) -> CompiledFormatError:
        return CompiledFormatError(f"解釈済みの形が不正です: {where}の{what}")

    try:
        g = json.loads(line)
    except ValueError:
        raise bad("行が JSON として読めません") from None
    if not isinstance(g, dict):
        raise bad("行が JSON のオブジェクトではありません")
    match_text = g.get("matchText")
    if not isinstance(match_text, str):
        raise bad("matchText が文字列ではありません")
    priority, order = g.get("priority"), g.get("order")
    if not _is_int32(priority) or not _is_int32(order):
        raise bad("priority・order が整数ではありません")
    forms_raw = g.get("forms")
    if not isinstance(forms_raw, list) or not forms_raw:
        raise bad("forms が空か配列ではありません")
    units = len(utf16(match_text)) // 2  # ルビ区間は UTF-16 の位置
    forms = []
    for f in forms_raw:
        if not isinstance(f, dict) or not isinstance(f.get("segments"), list):
            raise bad("形が壊れています")
        segments = []
        for seg in f["segments"]:
            if not isinstance(seg, list) or len(seg) != 3:
                raise bad("ルビ区間が [offset, length, reading] ではありません")
            offset, length, reading = seg
            if not _is_int32(offset) or not _is_int32(length) or offset < 0 or length < 1 or offset + length > units:
                raise bad("ルビ区間が照合形の外を指しています")
            if not isinstance(reading, str) or not reading:
                raise bad("ルビ区間の読みが空か文字列ではありません")
            segments.append(Segment(offset, length, reading))
        for key in ("particle", "standalone", "leftStandalone"):
            if key in f and not isinstance(f[key], bool):
                raise bad(f"{key} が真偽値ではありません")
        if "before" in f and f["before"] not in _BEFORE_KINDS:
            raise bad("before が kanji・hira・kata・alnum のどれでもありません")
        forms.append(
            MatchForm(
                segments=tuple(segments),
                particle=f.get("particle") is True,
                standalone=f.get("standalone") is True,
                left_standalone=f.get("leftStandalone") is True,
                before=f.get("before", ""),
            )
        )
    return MatchGroup(match_text, priority, order, tuple(forms))


def from_compiled(lines: Iterable[str]) -> Matcher:
    """行の並び（1 行目は見出し）から照合器を作る。照合の索引も作る"""
    head = None
    groups = []
    for line_no, line in enumerate(lines, 1):
        if isinstance(line, (bytes, bytearray)):
            line = bytes(line).decode("utf-8")
        if head is None:
            line = line.lstrip("﻿")
        line = line.rstrip("\r\n")
        if head is None:
            head = _read_head(line)
            continue
        if line:
            groups.append(_read_group(line, f"{line_no} 行目"))
    if head is None:
        raise CompiledFormatError("解釈済みの形が空です")
    if "groupCount" in head and head["groupCount"] != len(groups):
        raise CompiledFormatError(f"照合単位が {head['groupCount']} 件のはずが {len(groups)} 件です（途中で切れています）")
    return Matcher.create(groups)


def from_compiled_stream(f: IO[str]) -> Matcher:
    """テキストまたはバイナリのストリーム（埋め込みのデータなど）から読む"""
    return from_compiled(f)


def from_compiled_file(path: Union[str, "os.PathLike[str]"]) -> Matcher:
    with open(path, encoding="utf-8-sig") as f:
        return from_compiled_stream(f)
