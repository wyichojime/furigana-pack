import io
import os
import tempfile
import unittest

from furigana_pack import CompiledFormatError, from_compiled, from_compiled_file, from_compiled_stream

from .repo_paths import compiled

HEAD = '{"format":"furigana-pack-compiled","version":1,"source":"t","groupCount":1}'
GROUP = '{"matchText":"漢字","priority":0,"order":0,"forms":[{"segments":[[0,2,"かんじ"]]}]}'


class LoaderTest(unittest.TestCase):
    def test_rejects_unknown_format(self):
        with self.assertRaises(CompiledFormatError):
            from_compiled(['{"format":"other","version":1}'])

    def test_rejects_unknown_version(self):
        with self.assertRaises(CompiledFormatError):
            from_compiled(['{"format":"furigana-pack-compiled","version":2}'])

    def test_rejects_version_as_string(self):
        with self.assertRaises(CompiledFormatError):
            from_compiled(['{"format":"furigana-pack-compiled","version":"1"}'])

    def test_rejects_garbled_or_empty(self):
        for lines in ([], [""], ["{not json"], ["[1,2]"]):
            with self.assertRaises(CompiledFormatError, msg=repr(lines)):
                from_compiled(lines)

    def test_rejects_truncated_file(self):
        head = HEAD.replace('"groupCount":1', '"groupCount":2')
        with self.assertRaisesRegex(CompiledFormatError, "途中で切れています"):
            from_compiled([head, GROUP])

    def test_loads_from_stream(self):
        m = from_compiled_stream(io.StringIO(HEAD + "\n" + GROUP + "\n"))
        self.assertEqual(len(m.groups), 1)

    def test_strips_bom_in_stream(self):
        m = from_compiled_stream(io.StringIO("﻿" + HEAD + "\n" + GROUP + "\n"))
        self.assertEqual(len(m.groups), 1)

    def test_loads_file_with_bom(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "x.json")
            with open(p, "wb") as f:
                f.write(("﻿" + HEAD + "\n" + GROUP + "\n").encode("utf-8"))
            self.assertEqual(len(from_compiled_file(p).groups), 1)

    def test_loads_binary_stream(self):
        data = ("﻿" + HEAD + "\n" + GROUP + "\n").encode("utf-8")
        self.assertEqual(len(from_compiled_stream(io.BytesIO(data)).groups), 1)

    def test_matcher_is_hashable(self):
        self.assertIsInstance(hash(from_compiled([HEAD, GROUP])), int)

    def test_builds_index_on_load(self):
        m = from_compiled_file(compiled("ruby-pack.json"))
        seen = [False] * len(m.groups)
        for code, lst in m.by_char.items():
            for i, gi in enumerate(lst):
                if i > 0:
                    self.assertGreater(gi, lst[i - 1])
                self.assertFalse(seen[gi])
                seen[gi] = True
                self.assertIn(code, m.units[gi])
        for gi, s in enumerate(seen):
            self.assertTrue(s or len(m.groups[gi].match_text) == 0)


if __name__ == "__main__":
    unittest.main()
