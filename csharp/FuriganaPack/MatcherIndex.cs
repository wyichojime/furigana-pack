// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wyichojime (furigana-pack)

#nullable enable

using System.Collections.Generic;

namespace FuriganaPack;

/// <summary>
/// 照合の索引: 照合単位ごとに、照合形の中で（辞書全体で）最も出現の少ない文字を 1 つ選び、
/// 文字（UTF-16 コード単位）→ その文字を選んだ照合単位の番号（照合の順＝昇順）を引けるようにする。
/// 同じ出現数なら照合形の中で先の文字を選ぶ（JS 版と同じ）。照合形が空の照合単位は入れない。
/// </summary>
public static class MatcherIndex
{
    public static Dictionary<char, int[]> Build(IReadOnlyList<MatchGroup> groups)
    {
        var freq = new int[65536];
        foreach (var g in groups)
            foreach (char c in g.MatchText) freq[c]++;
        var pick = new int[groups.Count];
        var sizes = new int[65536];
        for (int gi = 0; gi < groups.Count; gi++)
        {
            int best = -1;
            foreach (char c in groups[gi].MatchText)
                if (best < 0 || freq[c] < freq[best]) best = c;
            pick[gi] = best;
            if (best >= 0) sizes[best]++;
        }
        var lists = new int[65536][];
        var byChar = new Dictionary<char, int[]>();
        for (int c = 0; c < 65536; c++)
        {
            if (sizes[c] == 0) continue;
            lists[c] = new int[sizes[c]];
            byChar[(char)c] = lists[c];
            sizes[c] = 0; // ここからは書き込み位置として使う
        }
        for (int gi = 0; gi < groups.Count; gi++)
        {
            int c = pick[gi];
            if (c < 0) continue;
            lists[c][sizes[c]++] = gi;
        }
        return byChar;
    }
}
