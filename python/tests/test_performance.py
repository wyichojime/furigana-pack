import time
import unittest

from furigana_pack import from_compiled_file, match_ranges

from .repo_paths import compiled


class PerformanceTest(unittest.TestCase):
    def test_one_sentence_average_under_5ms(self):
        m = from_compiled_file(compiled("ruby-pack.json"))
        s = "その時、彼は箱の中を見た。"
        for _ in range(20):
            match_ranges(m, s)
        t = time.perf_counter()
        for _ in range(100):
            match_ranges(m, s)
        avg_ms = (time.perf_counter() - t) * 1000 / 100
        self.assertLess(avg_ms, 5, f"平均 {avg_ms:.3f}ms")


if __name__ == "__main__":
    unittest.main()
