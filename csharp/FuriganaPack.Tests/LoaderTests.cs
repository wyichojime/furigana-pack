using Xunit;

namespace FuriganaPack.Tests;

public class LoaderTests
{
    [Fact]
    public void RejectsUnknownFormat() =>
        Assert.Throws<FormatException>(() => CompiledLoader.FromCompiled(new[] { "{\"format\":\"other\",\"version\":1}" }));

    [Fact]
    public void RejectsUnknownVersion() =>
        Assert.Throws<FormatException>(() => CompiledLoader.FromCompiled(new[] { "{\"format\":\"furigana-pack-compiled\",\"version\":2}" }));

    [Fact]
    public void RejectsEmpty() => Assert.Throws<FormatException>(() => CompiledLoader.FromCompiled(Array.Empty<string>()));

    [Fact]
    public void RejectsGarbledHeader() =>
        Assert.Throws<FormatException>(() => CompiledLoader.FromCompiled(new[] { "not json" }));

    [Fact]
    public void RejectsEmptyHeaderLine() =>
        Assert.Throws<FormatException>(() => CompiledLoader.FromCompiled(new[] { "" }));

    [Fact]
    public void RejectsVersionAsString() =>
        Assert.Throws<FormatException>(() => CompiledLoader.FromCompiled(new[] { "{\"format\":\"furigana-pack-compiled\",\"version\":\"1\"}" }));

    [Fact]
    public void RejectsFormatAsNumber() =>
        Assert.Throws<FormatException>(() => CompiledLoader.FromCompiled(new[] { "{\"format\":1,\"version\":1}" }));

    [Fact]
    public void RejectsTruncatedFile()
    {
        var lines = new[]
        {
            "{\"format\":\"furigana-pack-compiled\",\"version\":1,\"groupCount\":2}",
            "{\"matchText\":\"漢字\",\"priority\":0,\"order\":0,\"forms\":[{\"segments\":[[0,2,\"かんじ\"]]}]}",
        };
        var e = Assert.Throws<FormatException>(() => CompiledLoader.FromCompiled(lines));
        Assert.Contains("途中で切れています", e.Message);
    }

    [Fact]
    public void LoadsFromTextReader()
    {
        var text = "{\"format\":\"furigana-pack-compiled\",\"version\":1,\"groupCount\":1}\n" +
                   "{\"matchText\":\"漢字\",\"priority\":0,\"order\":0,\"forms\":[{\"segments\":[[0,2,\"かんじ\"]]}]}\n";
        var m = CompiledLoader.FromCompiled(new StringReader(text));
        Assert.Single(m.Groups);
        var r = Assert.Single(RubyMatcher.MatchRanges(m, "漢字"));
        Assert.Equal(new RubyRange(0, 2, "かんじ"), r);
    }

    [Fact]
    public void BuildsIndexOnLoad()
    {
        var m = CompiledLoader.FromCompiledFile(RepoPaths.Compiled("ruby-pack.json"));
        Assert.NotNull(m.ByChar);
        var seen = new bool[m.Groups.Count];
        foreach (var (c, list) in m.ByChar!)
        {
            for (int i = 0; i < list.Length; i++)
            {
                if (i > 0) Assert.True(list[i] > list[i - 1]);
                Assert.False(seen[list[i]]);
                seen[list[i]] = true;
                Assert.Contains(c, m.Groups[list[i]].MatchText);
            }
        }
        for (int gi = 0; gi < seen.Length; gi++) Assert.True(seen[gi] || m.Groups[gi].MatchText.Length == 0);
    }
}
