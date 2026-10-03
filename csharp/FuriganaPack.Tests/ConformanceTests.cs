using System.Text.Json;
using Xunit;

namespace FuriganaPack.Tests;

public class ConformanceTests
{
    private static string Tuples(IEnumerable<RubyRange> ranges) =>
        JsonSerializer.Serialize(ranges.Select(r => new object[] { r.Start, r.End, r.Reading }));

    private static string Expected(JsonElement expected) =>
        JsonSerializer.Serialize(expected.EnumerateArray().Select(t => new object[] { t[0].GetInt32(), t[1].GetInt32(), CompiledLoader.Str(t[2]) }));

    [Fact]
    public void CompiledCases_AllMatchExpected()
    {
        int count = 0;
        foreach (var line in File.ReadLines(RepoPaths.Conformance("compiled-cases.jsonl")))
        {
            if (line.Length == 0) continue;
            using var doc = JsonDocument.Parse(line);
            var c = doc.RootElement;
            var compiled = c.GetProperty("compiled").EnumerateArray().Select(e => CompiledLoader.Str(e)).ToList();
            var actual = RubyMatcher.MatchRanges(CompiledLoader.FromCompiled(compiled), CompiledLoader.Str(c.GetProperty("text")));
            Assert.True(Expected(c.GetProperty("expected")) == Tuples(actual), c.GetProperty("id").GetString());
            count++;
        }
        Assert.Equal(4204, count);
    }

    [Fact]
    public void CompiledRenderCases_ToAozoraAndToHtmlMatchExpected()
    {
        int count = 0;
        foreach (var line in File.ReadLines(RepoPaths.Conformance("compiled-render-cases.jsonl")))
        {
            if (line.Length == 0) continue;
            using var doc = JsonDocument.Parse(line);
            var c = doc.RootElement;
            var id = c.GetProperty("id").GetString();
            var ruby = new Annotator(CompiledLoader.FromCompiled(c.GetProperty("compiled").EnumerateArray().Select(e => CompiledLoader.Str(e)).ToList()));
            var text = CompiledLoader.Str(c.GetProperty("text"));
            Assert.True(CompiledLoader.Str(c.GetProperty("aozora")) == ruby.ToAozora(text), id + " (aozora)");
            Assert.True(CompiledLoader.Str(c.GetProperty("html")) == ruby.ToHtml(text), id + " (html)");
            count++;
        }
        Assert.True(count > 0);
    }

    [Fact]
    public void CompiledInvalid_AllRejected()
    {
        int count = 0;
        foreach (var line in File.ReadLines(RepoPaths.Conformance("compiled-invalid.jsonl")))
        {
            if (line.Length == 0) continue;
            using var doc = JsonDocument.Parse(line);
            var c = doc.RootElement;
            var lines = c.GetProperty("lines").EnumerateArray().Select(e => CompiledLoader.Str(e)).ToList();
            var id = c.GetProperty("id").GetString();
            var e = Record.Exception(() => CompiledLoader.FromCompiled(lines));
            Assert.True(e is FormatException, $"{id}: {e?.GetType().Name ?? "例外なし"}");
            count++;
        }
        Assert.True(count > 0);
    }

    [Fact]
    public void Corpus_AllMatchExpected()
    {
        var matchers = new Dictionary<string, Matcher>();
        int count = 0;
        foreach (var line in File.ReadLines(RepoPaths.Conformance("corpus.jsonl")))
        {
            if (line.Length == 0) continue;
            using var doc = JsonDocument.Parse(line);
            var c = doc.RootElement;
            var pack = c.GetProperty("dictRef").GetString()!;
            if (!matchers.TryGetValue(pack, out var m))
            {
                m = CompiledLoader.FromCompiledFile(RepoPaths.Compiled(pack));
                matchers[pack] = m;
            }
            var actual = RubyMatcher.MatchRanges(m, CompiledLoader.Str(c.GetProperty("text")));
            Assert.True(Expected(c.GetProperty("expected")) == Tuples(actual), c.GetProperty("id").GetString());
            count++;
        }
        Assert.Equal(115, count);
        Assert.Equal(1, matchers.Count);
    }
}
