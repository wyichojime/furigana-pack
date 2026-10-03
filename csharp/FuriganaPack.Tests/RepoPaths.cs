namespace FuriganaPack.Tests;

/// <summary>furigana-pack リポジトリの場所（テストの実行場所から package.json をさかのぼって探す）</summary>
internal static class RepoPaths
{
    public static readonly string Root = FindRoot();
    public static string Conformance(string name) => Path.Combine(Root, "tests", "conformance", name);
    public static string Compiled(string pack) => Path.Combine(Root, "data", "compiled", pack);

    private static string FindRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var pkg = Path.Combine(dir.FullName, "package.json");
            if (File.Exists(pkg) && File.ReadAllText(pkg).Contains("\"name\": \"furigana-pack\"")) return dir.FullName;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("furigana-pack の package.json が見つかりません");
    }
}
