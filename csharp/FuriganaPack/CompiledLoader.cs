// SPDX-License-Identifier: MIT
// Copyright (c) 2026 wyichojime (furigana-pack)

#nullable enable

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace FuriganaPack;

/// <summary>
/// 解釈済みの形（data/compiled/*.json）を読む。1 行目は見出し（format・version を確かめる）、
/// 2 行目以降は照合の順の照合単位。読み込みで照合の索引も作る。
/// </summary>
public static class CompiledLoader
{
    public const string Format = "furigana-pack-compiled";
    public const int Version = 1;

    public static Matcher FromCompiledFile(string path)
    {
        using var reader = new StreamReader(path, new UTF8Encoding(false), true);
        return FromCompiled(reader);
    }

    /// <summary>TextReader（埋め込みリソースのストリームなど）から読む。行は 1 行ずつ読む</summary>
    public static Matcher FromCompiled(TextReader reader) => FromCompiled(ReadAllLines(reader));

    private static IEnumerable<string> ReadAllLines(TextReader reader)
    {
        string? line;
        while ((line = reader.ReadLine()) != null) yield return line;
    }

    public static Matcher FromCompiled(IEnumerable<string> lines)
    {
        var groups = new List<MatchGroup>();
        bool headSeen = false;
        int? expectedCount = null;
        int lineNo = 0;
        foreach (var raw in lines)
        {
            lineNo++;
            // 見出しの BOM と行末の CR は読み飛ばす（JS・Python 版と同じ）
            var line = lineNo == 1 ? raw.TrimStart('\uFEFF') : raw;
            if (line.EndsWith('\r')) line = line[..^1];
            if (!headSeen)
            {
                try
                {
                    using var head = JsonDocument.Parse(line);
                    var root = head.RootElement;
                    if (root.ValueKind != JsonValueKind.Object
                        || !root.TryGetProperty("format", out var f) || f.ValueKind != JsonValueKind.String || f.GetString() != Format)
                        throw new FormatException($"解釈済みの形ではありません（format が {Format} でない）");
                    if (!root.TryGetProperty("version", out var v) || v.ValueKind != JsonValueKind.Number
                        || !v.TryGetInt32(out int ver) || ver != Version)
                        throw new FormatException($"対応していない版です（version {Version} だけを読めます）");
                    if (root.TryGetProperty("groupCount", out var gc))
                    {
                        if (gc.ValueKind != JsonValueKind.Number || !gc.TryGetInt32(out int n))
                            throw new FormatException("解釈済みの形の見出しが壊れています（groupCount）");
                        expectedCount = n;
                    }
                }
                catch (JsonException e)
                {
                    throw new FormatException("解釈済みの形の見出しが読めません", e);
                }
                headSeen = true;
                continue;
            }
            if (line.Length == 0) continue;
            try
            {
                using var doc = JsonDocument.Parse(line);
                groups.Add(ReadGroup(doc.RootElement, $"{lineNo} 行目"));
            }
            catch (JsonException e)
            {
                throw new FormatException($"解釈済みの形の {lineNo} 行目が JSON として読めません", e);
            }
        }
        if (!headSeen) throw new FormatException("解釈済みの形が空です");
        if (expectedCount is int want && want != groups.Count)
            throw new FormatException($"解釈済みの形が途中で切れています（見出しは {want} 件、読めたのは {groups.Count} 件）");
        return Matcher.Create(groups);
    }

    /// <summary>
    /// JSON の文字列を読む。JS 版は対になっていない半端なサロゲート（上位だけ・下位だけ）も文字列に持てるが、
    /// System.Text.Json の GetString は例外になるため、その場合は生の JSON から自前で戻す。
    /// </summary>
    internal static string Str(JsonElement e)
    {
        // 実際のパック（data/compiled）には半端なサロゲートが無く、この退避は通らない（読み込みの費用は増えない）。
        // 通るのは半端なサロゲートを含むテスト用データだけ。
        try { return e.GetString()!; }
        catch (InvalidOperationException) { return Unescape(e.GetRawText()); }
    }

    private static string Unescape(string raw)
    {
        var sb = new StringBuilder(raw.Length);
        for (int i = 1; i < raw.Length - 1; i++)
        {
            char c = raw[i];
            if (c != '\\') { sb.Append(c); continue; }
            char n = raw[++i];
            switch (n)
            {
                case 'b': sb.Append('\b'); break;
                case 'f': sb.Append('\f'); break;
                case 'n': sb.Append('\n'); break;
                case 'r': sb.Append('\r'); break;
                case 't': sb.Append('\t'); break;
                case 'u': sb.Append((char)Convert.ToInt32(raw.Substring(i + 1, 4), 16)); i += 4; break;
                default: sb.Append(n); break; // " \ /
            }
        }
        return sb.ToString();
    }

    private static readonly string[] BeforeKinds = { "kanji", "hira", "kata", "alnum" };

    /// <summary>
    /// 照合単位の 1 行を読む。型とルビ区間の範囲（照合形の中に収まる）を確かめ、合わなければ FormatException
    /// （改ざん・破損したデータで本文の外を指す振り仮名を返さないため。JS 版 matcherFromCompiled と同じ決まり）
    /// </summary>
    private static MatchGroup ReadGroup(JsonElement g, string where)
    {
        FormatException Bad(string what) => new($"解釈済みの形が不正です: {where}の{what}");
        if (g.ValueKind != JsonValueKind.Object) throw Bad("行が JSON のオブジェクトではありません");
        if (!g.TryGetProperty("matchText", out var mt) || mt.ValueKind != JsonValueKind.String)
            throw Bad("matchText が文字列ではありません");
        string matchText = Str(mt);
        if (!TryInt(g, "priority", out int priority) || !TryInt(g, "order", out int order))
            throw Bad("priority・order が整数ではありません");
        if (!g.TryGetProperty("forms", out var fs) || fs.ValueKind != JsonValueKind.Array || fs.GetArrayLength() == 0)
            throw Bad("forms が空か配列ではありません");
        var forms = new List<MatchForm>();
        foreach (var f in fs.EnumerateArray())
        {
            if (f.ValueKind != JsonValueKind.Object || !f.TryGetProperty("segments", out var ss) || ss.ValueKind != JsonValueKind.Array)
                throw Bad("形が壊れています");
            var segments = new List<Segment>();
            foreach (var s in ss.EnumerateArray())
            {
                if (s.ValueKind != JsonValueKind.Array || s.GetArrayLength() != 3)
                    throw Bad("ルビ区間が [offset, length, reading] ではありません");
                if (s[0].ValueKind != JsonValueKind.Number || !s[0].TryGetInt32(out int offset)
                    || s[1].ValueKind != JsonValueKind.Number || !s[1].TryGetInt32(out int length)
                    || offset < 0 || length < 1 || (long)offset + length > matchText.Length)
                    throw Bad("ルビ区間が照合形の外を指しています");
                string reading = s[2].ValueKind == JsonValueKind.String ? Str(s[2]) : "";
                if (reading.Length == 0) throw Bad("ルビ区間の読みが空か文字列ではありません");
                segments.Add(new Segment(offset, length, reading));
            }
            string before = "";
            if (f.TryGetProperty("before", out var b))
            {
                before = b.ValueKind == JsonValueKind.String ? Str(b) : "";
                if (Array.IndexOf(BeforeKinds, before) < 0) throw Bad("before が kanji・hira・kata・alnum のどれでもありません");
            }
            forms.Add(new MatchForm
            {
                Segments = segments.ToArray(),
                Particle = Flag(f, "particle"),
                Standalone = Flag(f, "standalone"),
                LeftStandalone = Flag(f, "leftStandalone"),
                Before = before,
            });
        }
        return new MatchGroup { MatchText = matchText, Priority = priority, Order = order, Forms = forms.ToArray() };

        bool Flag(JsonElement f, string name)
        {
            if (!f.TryGetProperty(name, out var v)) return false;
            if (v.ValueKind == JsonValueKind.True) return true;
            if (v.ValueKind == JsonValueKind.False) return false;
            throw Bad($"{name} が真偽値ではありません");
        }
    }

    private static bool TryInt(JsonElement g, string name, out int value)
    {
        value = 0;
        return g.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out value);
    }
}
