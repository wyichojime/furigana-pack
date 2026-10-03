using System.Diagnostics;
using Xunit;

namespace FuriganaPack.Tests;

public class PerformanceTests
{
    [Fact]
    public void OneSentence_AverageUnder2ms()
    {
        var m = CompiledLoader.FromCompiledFile(RepoPaths.Compiled("ruby-pack.json"));
        const string s = "その時、彼は箱の中を見た。";
        for (int i = 0; i < 20; i++) RubyMatcher.MatchRanges(m, s);
        var sw = Stopwatch.StartNew();
        for (int i = 0; i < 100; i++) RubyMatcher.MatchRanges(m, s);
        Assert.True(sw.Elapsed.TotalMilliseconds / 100 < 2, $"平均 {sw.Elapsed.TotalMilliseconds / 100:F3}ms");
    }
}
