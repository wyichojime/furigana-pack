import unittest

from furigana_pack import Annotator, Matcher, MatchForm, MatchGroup, RubyRange, Segment, from_compiled

LINES = [
    '{"format":"furigana-pack-compiled","version":1,"source":"test","groupCount":3}',
    '{"matchText":"漢字","priority":0,"order":0,"forms":[{"segments":[[0,2,"かんじ"]]}]}',
    '{"matchText":"慮る","priority":0,"order":1,"forms":[{"segments":[[0,1,"おもんぱか"]],"leftStandalone":true}]}',
    '{"matchText":"中","priority":0,"order":2,"forms":[{"segments":[[0,1,"ちゅう"]],"before":"kata"}]}',
]


def make():
    return Annotator(from_compiled(LINES))


class AnnotatorTest(unittest.TestCase):
    def test_to_html_escapes_and_adds_ruby(self):
        self.assertEqual(
            make().to_html("<b>漢字</b>&\"慮る'"),
            "&lt;b&gt;<ruby>漢字<rt>かんじ</rt></ruby>&lt;/b&gt;&amp;&quot;<ruby>慮<rt>おもんぱか</rt></ruby>る&#39;",
        )

    def test_to_aozora_uses_full_width_bar(self):
        self.assertEqual(make().to_aozora("漢字を慮る。メンテナンス中。"), "｜漢字《かんじ》を｜慮《おもんぱか》る。メンテナンス｜中《ちゅう》。")

    def test_no_ruby_returns_text_as_is(self):
        self.assertEqual(make().to_aozora("かな"), "かな")
        self.assertEqual(make().to_html("a<b"), "a&lt;b")
        self.assertEqual(make().ranges(""), [])

    def test_positions_are_code_points(self):
        # 𠮷（サロゲートペア）の後ろでも、位置はコードポイントで数える
        r = make().ranges("𠮷を漢字で")
        self.assertEqual(r, [RubyRange(2, 4, "かんじ")])
        self.assertEqual("𠮷を漢字で"[2:4], "漢字")


    def test_render_skips_ranges_outside_text(self):
        # Matcher.create には検証前の照合単位も渡せる。本文の外を指す区間は付けずに、例外も出さない
        bad = MatchGroup("漢", 0, 0, (MatchForm(segments=(Segment(-5, 100, "x"),)),))
        ruby = Annotator(Matcher.create([bad]))
        self.assertEqual(ruby.to_aozora("あ漢い"), "あ漢い")
        self.assertEqual(ruby.to_html("<漢"), "&lt;漢")

if __name__ == "__main__":
    unittest.main()
