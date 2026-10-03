// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wyichojime (furigana-pack)

#nullable enable

using System.Collections.Generic;

namespace FuriganaPack;

/// <summary>本文に付ける振り仮名（UTF-16 の添字。End は含まない）</summary>
public readonly record struct RubyRange(int Start, int End, string Reading);

/// <summary>照合形の中で振り仮名を付ける区間</summary>
public sealed record Segment(int Offset, int Length, string Reading);

/// <summary>照合単位の中の 1 形。Before は "" か kanji・hira・kata・alnum（RUBY-027）</summary>
public sealed class MatchForm
{
    public required Segment[] Segments { get; init; }
    public bool Particle { get; init; }
    public bool Standalone { get; init; }
    public bool LeftStandalone { get; init; }
    public string Before { get; init; } = "";
}

/// <summary>照合単位（同じ照合形・同じ priority の形をまとめたもの）。MatchText は全角半角を畳んだ後のもの</summary>
public sealed class MatchGroup
{
    public required string MatchText { get; init; }
    public int Priority { get; init; }
    public int Order { get; init; }
    public required MatchForm[] Forms { get; init; }
}

/// <summary>照合器。Groups は照合の順。ByChar は照合の索引（無くても照合できる）</summary>
public sealed class Matcher
{
    public IReadOnlyList<MatchGroup> Groups { get; }
    public IReadOnlyDictionary<char, int[]>? ByChar { get; }

    private Matcher(IReadOnlyList<MatchGroup> groups, IReadOnlyDictionary<char, int[]> byChar)
    {
        Groups = groups;
        ByChar = byChar;
    }

    /// <summary>照合単位（照合の順）から照合器を作る。索引は必ずここで作るので Groups と食い違わない</summary>
    public static Matcher Create(IReadOnlyList<MatchGroup> groups) => new(groups, MatcherIndex.Build(groups));
}
