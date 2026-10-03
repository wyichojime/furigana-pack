// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wyichojime (furigana-pack)

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace FuriganaPack;

/// <summary>
/// 準備した照合器で本文に振り仮名を付ける（JS 版 matchRanges と同じ結果。RUBY-015・021・022・023・025・027）。
/// 結果は Start の昇順。
/// </summary>
public static class RubyMatcher
{
    // RUBY-023: 「+助詞」の語の直後に来てよい助詞（JS 版と同じ並び）
    private static readonly string[] Particles =
    {
        "が", "の", "を", "に", "へ", "と", "で", "や", "は", "も", "か", "よ", "な", "ぞ",
        "から", "まで", "より", "だけ", "しか", "ほど", "など", "くらい", "ぐらい", "ばかり", "さえ",
        "でも", "こそ", "って", "だ", "です", "じゃ",
    };

    // 呼び出し元のスレッドごとに約 512KB のバッファを保持し続ける（UI スレッドなら問題ない）
    // 呼び出しごとに約 512KB（大きなオブジェクトの領域）を確保しないよう、スレッドごとに使い回す
    [ThreadStatic] private static int[]? _charStart;
    [ThreadStatic] private static int[]? _fillCursor;

    public static IReadOnlyList<RubyRange> MatchRanges(Matcher matcher, string text)
    {
        if (string.IsNullOrEmpty(text) || matcher.Groups.Count == 0) return Array.Empty<RubyRange>();
        text = FoldWidth(text);
        var groups = matcher.Groups;
        int textLength = text.Length;

        // 本文の文字ごとの出現位置の索引（JS 版と同じ）
        var charStart = _charStart ??= new int[65537];
        Array.Clear(charStart); // 前回の値を消す（fillCursor は Array.Copy で全体が上書きされる）
        foreach (char ch in text) charStart[ch + 1]++;
        for (int c = 0; c < 65536; c++) charStart[c + 1] += charStart[c];
        var charPositions = new int[textLength];
        var fillCursor = _fillCursor ??= new int[65536];
        Array.Copy(charStart, fillCursor, 65536);
        for (int i = 0; i < textLength; i++) charPositions[fillCursor[text[i]]++] = i;

        var occupied = new bool[textLength];
        var visual = new List<RubyRange>();

        // 短い本文: 本文に現れる文字から引いた候補が全体の 1/4 未満なら、候補だけを照合の順にたどる
        int[]? visit = null;
        if (matcher.ByChar is { } byChar)
        {
            var lists = new List<int[]>();
            long total = 0;
            for (int i = 0; i < textLength; i++)
            {
                char c = text[i];
                if (charPositions[charStart[c]] == i && byChar.TryGetValue(c, out var list))
                {
                    lists.Add(list);
                    total += list.Length;
                }
            }
            if (total * 4 < groups.Count)
            {
                visit = new int[total];
                int at = 0;
                foreach (var list in lists)
                {
                    Array.Copy(list, 0, visit, at, list.Length);
                    at += list.Length;
                }
                Array.Sort(visit);
            }
        }

        int visitCount = visit?.Length ?? groups.Count;
        for (int gi = 0; gi < visitCount; gi++)
        {
            var group = groups[visit != null ? visit[gi] : gi];
            string matchText = group.MatchText;
            var forms = group.Forms;
            bool needsContext = false;
            foreach (var f in forms)
                if (f.Particle || f.Standalone || f.LeftStandalone || f.Before.Length > 0) { needsContext = true; break; }
            int matchLength = matchText.Length;
            if (matchLength == 0) continue;
            int anchor = 0;
            int anchorCount = int.MaxValue;
            for (int i = 0; i < matchLength; i++)
            {
                char code = matchText[i];
                int count = charStart[code + 1] - charStart[code];
                if (count < anchorCount)
                {
                    anchor = i;
                    anchorCount = count;
                    if (count == 0) break;
                }
            }
            if (anchorCount == 0) continue;
            char anchorCode = matchText[anchor];
            int candidateEnd = charStart[anchorCode + 1];
            int nextStart = 0;
            for (int j = charStart[anchorCode]; j < candidateEnd; j++)
            {
                int idx = charPositions[j] - anchor;
                if (idx < nextStart) continue;
                if (idx + matchLength > textLength) break;
                if (string.CompareOrdinal(text, idx, matchText, 0, matchLength) != 0) continue;
                int occupiedEnd = idx + matchLength;
                IReadOnlyList<MatchForm> candidates = forms;
                if (needsContext)
                {
                    string leftKind = KindBefore(text, idx, occupied);
                    bool leftOk = !KanjiBefore(text, idx) && leftKind != "kata" && leftKind != "alnum";
                    bool standaloneOk = leftOk && !KanjiAfter(text, occupiedEnd);
                    bool particleOk = ParticleAfter(text, occupiedEnd);
                    bool rightOk = !KanjiAfter(text, occupiedEnd);
                    var filtered = new List<MatchForm>();
                    foreach (var f in forms)
                    {
                        if ((!f.Standalone || standaloneOk) &&
                            (!f.LeftStandalone || leftOk) &&
                            (!f.Particle || particleOk) &&
                            (f.Before.Length == 0 || (f.Before == leftKind && rightOk)))
                            filtered.Add(f);
                    }
                    if (filtered.Count == 0) continue;
                    // RUBY-023/027: 条件付きの形が満たされたら、条件なしの形より優先する
                    if (filtered.Exists(f => f.Particle || f.Before.Length > 0))
                        filtered = filtered.FindAll(f => f.Particle || f.Before.Length > 0);
                    candidates = filtered;
                }
                bool overlaps = false;
                for (int i = idx; i < occupiedEnd; i++)
                    if (occupied[i]) { overlaps = true; break; }
                if (!overlaps)
                {
                    for (int i = idx; i < occupiedEnd; i++) occupied[i] = true;
                    // RUBY-022: 候補のルビ区間が食い違う（読みが割れる）ときはルビを付けない
                    var segments = candidates[0].Segments;
                    bool same = true;
                    for (int k = 1; k < candidates.Count; k++)
                        if (!SameSegments(candidates[k].Segments, segments)) { same = false; break; }
                    if (same)
                        foreach (var seg in segments)
                            visual.Add(new RubyRange(idx + seg.Offset, idx + seg.Offset + seg.Length, seg.Reading));
                }
                nextStart = occupiedEnd;
            }
        }
        // JS の Array.prototype.sort と同じく安定な並べ替え（OrderBy は安定）
        return visual.OrderBy(r => r.Start).ToList();
    }

    /// <summary>RUBY-025: 全角の英数字・記号（！〜～）を半角に、全角スペースを半角スペースに（文字数は変わらない）</summary>
    private static string FoldWidth(string s)
    {
        var chars = s.ToCharArray();
        for (int i = 0; i < chars.Length; i++)
        {
            char c = chars[i];
            if (c >= '！' && c <= '～') chars[i] = (char)(c - 0xfee0);
            else if (c == '　') chars[i] = ' ';
        }
        return new string(chars);
    }

    // RUBY-021: 漢字（UTF-16 コード単位で判定。U+20000–U+3FFFF は上位サロゲートで判定）
    internal static bool IsKanji(char c) =>
        (c >= 0x4e00 && c <= 0x9fff) ||
        (c >= 0x3400 && c <= 0x4dbf) ||
        (c >= 0xf900 && c <= 0xfaff) ||
        (c >= 0x3005 && c <= 0x3007) ||
        c == 0x30f6 ||
        (c >= 0xd840 && c <= 0xd8bf);

    private static bool KanjiBefore(string text, int idx)
    {
        if (idx <= 0) return false;
        char c = text[idx - 1];
        if (c >= 0xdc00 && c <= 0xdfff && idx >= 2) return IsKanji(text[idx - 2]);
        return IsKanji(c);
    }

    private static bool KanjiAfter(string text, int end) => end < text.Length && IsKanji(text[end]);

    // RUBY-027: 直前の文字の種類。漢字はほかの登録語の範囲に入っている（占有済みの）ときだけ kanji
    private static string KindBefore(string text, int idx, bool[] occupied)
    {
        if (idx <= 0) return "";
        if (KanjiBefore(text, idx)) return occupied[idx - 1] ? "kanji" : "";
        char c = text[idx - 1];
        if (c >= 0x3041 && c <= 0x3096) return "hira";
        if ((c >= 0x30a1 && c <= 0x30fa) || c == 0x30fc) return "kata";
        if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) return "alnum";
        return "";
    }

    private static bool ParticleAfter(string text, int end)
    {
        var rest = text.AsSpan(end);
        foreach (var p in Particles)
            if (rest.StartsWith(p, StringComparison.Ordinal)) return true;
        return false;
    }

    private static bool SameSegments(Segment[] a, Segment[] b)
    {
        if (a.Length != b.Length) return false;
        for (int i = 0; i < a.Length; i++)
            if (a[i].Offset != b[i].Offset || a[i].Length != b[i].Length || a[i].Reading != b[i].Reading) return false;
        return true;
    }
}
