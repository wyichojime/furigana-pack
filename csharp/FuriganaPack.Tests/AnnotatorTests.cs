using Xunit;

namespace FuriganaPack.Tests;

public class AnnotatorTests
{
    private static readonly string[] Lines =
    {
        "{\"format\":\"furigana-pack-compiled\",\"version\":1,\"source\":\"test\",\"groupCount\":3}",
        "{\"matchText\":\"漢字\",\"priority\":0,\"order\":0,\"forms\":[{\"segments\":[[0,2,\"かんじ\"]]}]}",
        "{\"matchText\":\"慮る\",\"priority\":0,\"order\":1,\"forms\":[{\"segments\":[[0,1,\"おもんぱか\"]],\"leftStandalone\":true}]}",
        "{\"matchText\":\"中\",\"priority\":0,\"order\":2,\"forms\":[{\"segments\":[[0,1,\"ちゅう\"]],\"before\":\"kata\"}]}",
    };

    private static Annotator Make() => new(CompiledLoader.FromCompiled(Lines));

    [Fact]
    public void ToHtml_EscapesAndAddsRuby() =>
        Assert.Equal(
            "&lt;b&gt;<ruby>漢字<rt>かんじ</rt></ruby>&lt;/b&gt;&amp;&quot;<ruby>慮<rt>おもんぱか</rt></ruby>る&#39;",
            Make().ToHtml("<b>漢字</b>&\"慮る'"));

    [Fact]
    public void ToAozora_UsesFullWidthBar() =>
        Assert.Equal("｜漢字《かんじ》を｜慮《おもんぱか》る。メンテナンス｜中《ちゅう》。", Make().ToAozora("漢字を慮る。メンテナンス中。"));

    [Fact]
    public void NoRuby_ReturnsTextAsIs()
    {
        Assert.Equal("かな", Make().ToAozora("かな"));
        Assert.Equal("a&lt;b", Make().ToHtml("a<b"));
        Assert.Empty(Make().Ranges(""));
    }
    [Fact]
    public void Render_SkipsRangesOutsideText()
    {
        // Matcher.Create には検証前の照合単位も渡せる。本文の外を指す区間は付けずに、例外も出さない
        var bad = new MatchGroup
        {
            MatchText = "漢",
            Forms = new[] { new MatchForm { Segments = new[] { new Segment(-5, 100, "x") } } },
        };
        var ruby = new Annotator(Matcher.Create(new[] { bad }));
        Assert.Equal("あ漢い", ruby.ToAozora("あ漢い"));
        Assert.Equal("&lt;漢", ruby.ToHtml("<漢"));
    }
}
