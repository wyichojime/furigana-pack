import json
import unittest

from furigana_pack import Annotator, CompiledFormatError, RubyRange, from_compiled, from_compiled_file, match_ranges_utf16

from .repo_paths import compiled, conformance


def _rows(name):
    with open(conformance(name), encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def _utf16_to_cp(text, pos):
    """UTF-16 の位置をコードポイントの位置へ（期待値の変換用。文字の途中は来ない前提で確かめる）"""
    units = 0
    for i, ch in enumerate(text):
        if units == pos:
            return i
        units += 2 if ord(ch) > 0xFFFF else 1
        if units > pos:
            raise AssertionError(f"UTF-16 の位置 {pos} が文字の途中です")
    if units == pos:
        return len(text)
    raise AssertionError(f"UTF-16 の位置 {pos} が本文の外です")


class ConformanceTest(unittest.TestCase):
    def test_compiled_cases_all_match(self):
        count = 0
        for c in _rows("compiled-cases.jsonl"):
            m = from_compiled(c["compiled"])
            actual = [list(t) for t in match_ranges_utf16(m, c["text"])]
            self.assertEqual(actual, c["expected"], c["id"])
            count += 1
        self.assertEqual(count, 4204)

    def test_compiled_render_cases_to_aozora_and_to_html(self):
        count = 0
        for c in _rows("compiled-render-cases.jsonl"):
            ruby = Annotator(from_compiled(c["compiled"]))
            self.assertEqual(ruby.to_aozora(c["text"]), c["aozora"], c["id"])
            self.assertEqual(ruby.to_html(c["text"]), c["html"], c["id"])
            count += 1
        self.assertGreater(count, 0)

    def test_compiled_invalid_all_rejected(self):
        count = 0
        for c in _rows("compiled-invalid.jsonl"):
            with self.assertRaises(CompiledFormatError, msg=c["id"]):
                from_compiled(c["lines"])
            count += 1
        self.assertGreater(count, 0)

    def test_corpus_all_match_utf16_and_codepoints(self):
        matchers = {}
        count = 0
        for c in _rows("corpus.jsonl"):
            pack = c["dictRef"]
            if pack not in matchers:
                matchers[pack] = from_compiled_file(compiled(pack))
            m = matchers[pack]
            text = c["text"]
            self.assertEqual([list(t) for t in match_ranges_utf16(m, text)], c["expected"], c["id"])
            expected_cp = [RubyRange(_utf16_to_cp(text, s), _utf16_to_cp(text, e), r) for s, e, r in c["expected"]]
            self.assertEqual(Annotator(m).ranges(text), expected_cp, c["id"])
            count += 1
        self.assertEqual(count, 115)
        self.assertEqual(len(matchers), 1)


if __name__ == "__main__":
    unittest.main()
