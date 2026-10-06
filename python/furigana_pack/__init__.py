# SPDX-License-Identifier: MIT
# Copyright (c) 2026 wyichojime (furigana-pack)
"""振り仮名パック（furigana-pack）の Python 版。解釈済みの形（data/compiled/*.json）を読んで振り仮名を付ける"""
from .annotator import Annotator
from .loader import CompiledFormatError, from_compiled, from_compiled_file, from_compiled_stream
from .matcher import match_ranges, match_ranges_utf16
from .models import Matcher, MatchForm, MatchGroup, RubyRange, Segment

__all__ = [
    "Annotator",
    "CompiledFormatError",
    "Matcher",
    "MatchForm",
    "MatchGroup",
    "RubyRange",
    "Segment",
    "from_compiled",
    "from_compiled_file",
    "from_compiled_stream",
    "match_ranges",
    "match_ranges_utf16",
]
