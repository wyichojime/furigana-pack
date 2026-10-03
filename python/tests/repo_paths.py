"""furigana-pack リポジトリの場所（このファイルから package.json をさかのぼって探す）"""
import json
from pathlib import Path


def _find_root() -> Path:
    for d in Path(__file__).resolve().parents:
        pkg = d / "package.json"
        if pkg.is_file() and json.loads(pkg.read_text(encoding="utf-8")).get("name") == "furigana-pack":
            return d
    raise RuntimeError("furigana-pack の package.json が見つかりません")


ROOT = _find_root()


def conformance(name: str) -> Path:
    return ROOT / "tests" / "conformance" / name


def compiled(pack: str) -> Path:
    return ROOT / "data" / "compiled" / pack
