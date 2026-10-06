// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wyichojime (furigana-pack)

#nullable enable

using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace FuriganaPack;

/// <summary>照合器を 1 回だけ準備し、本文に振り仮名を付ける</summary>
public sealed class Annotator
{
    private readonly Matcher _matcher;

    public Annotator(Matcher matcher) => _matcher = matcher;

    public static Annotator FromCompiledFile(string path) => new(CompiledLoader.FromCompiledFile(path));

    /// <summary>振り仮名の位置と読み（UTF-16 の添字、Start の昇順）</summary>
    public IReadOnlyList<RubyRange> Ranges(string text) => RubyMatcher.MatchRanges(_matcher, text);

    /// <summary>&lt;ruby&gt;漢字&lt;rt&gt;かんじ&lt;/rt&gt;&lt;/ruby&gt; の HTML（本文の HTML 特殊文字はエスケープ）</summary>
    public string ToHtml(string text) =>
        Render(text, EscapeHtml, (b, r) => $"<ruby>{EscapeHtml(b)}<rt>{EscapeHtml(r)}</rt></ruby>");

    /// <summary>
    /// 青空文庫形式（｜漢字《かんじ》）。記法が壊れないよう、親文字・読みに ｜ | 《 》 改行を含む語と、
    /// 本文で既に振り仮名の付いた箇所（｜親文字《読み》・漢字《読み》）には付けない
    /// </summary>
    public string ToAozora(string text)
    {
        var mask = AozoraRubyMask(text);
        return Render(text, s => s, (b, r) => $"｜{b}《{r}》",
            r => r.Reading.AsSpan().IndexOfAny(AozoraSpecial) >= 0
                 || text.AsSpan(r.Start, r.End - r.Start).IndexOfAny(AozoraSpecial) >= 0
                 || (mask != null && Array.IndexOf(mask, true, r.Start, r.End - r.Start) >= 0));
    }

    // 青空文庫形式の振り仮名の記法（｜親文字《読み》、漢字《読み》）と、親文字・読みに入ると記法が壊れる文字
    private static readonly Regex AozoraRuby =
        new("[｜|][^｜|《》\r\n]*《[^《》\r\n]*》|《[^《》\r\n]*》", RegexOptions.CultureInvariant);
    private const string AozoraSpecial = "｜|《》\r\n";

    /// <summary>本文で既に振り仮名の付いた箇所（｜親文字《読み》の全体、漢字《読み》は直前に続く漢字と《読み》）の印。無ければ null</summary>
    private static bool[]? AozoraRubyMask(string text)
    {
        bool[]? mask = null;
        for (var m = AozoraRuby.Match(text); m.Success; m = m.NextMatch())
        {
            int start = m.Index;
            if (m.Value[0] == '《')
            {
                while (start > 0)
                {
                    char c = text[start - 1];
                    if (c >= 0xdc00 && c <= 0xdfff && start >= 2 && RubyMatcher.IsKanji(text[start - 2])) start -= 2;
                    else if (RubyMatcher.IsKanji(c)) start -= 1;
                    else break;
                }
            }
            mask ??= new bool[text.Length];
            Array.Fill(mask, true, start, m.Index + m.Length - start);
        }
        return mask;
    }

    private string Render(string text, Func<string, string> plain, Func<string, string, string> ruby, Func<RubyRange, bool>? skip = null)
    {
        var sb = new StringBuilder();
        int pos = 0;
        foreach (var r in Ranges(text))
        {
            // 重なる・空の・本文の外の範囲は付けない（Matcher.Create に不正な照合単位を渡された場合に備える）
            if (r.Start < pos || r.End <= r.Start || r.End > text.Length) continue;
            if (skip != null && skip(r)) continue;
            sb.Append(plain(text[pos..r.Start])).Append(ruby(text[r.Start..r.End], r.Reading));
            pos = r.End;
        }
        return sb.Append(plain(text[pos..])).ToString();
    }

    private static string EscapeHtml(string s) =>
        s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");
}
