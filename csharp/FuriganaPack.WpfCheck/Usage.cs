namespace FuriganaPack.WpfCheck
{
    internal static class Usage
    {
        internal static string Run(string path, string text)
        {
            var ruby = Annotator.FromCompiledFile(path);
            var ranges = ruby.Ranges(text);
            return ranges.Count + ruby.ToHtml(text) + ruby.ToAozora(text);
        }
    }
}
