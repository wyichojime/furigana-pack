// 解釈済みの形（data/compiled/*.json と tests/conformance/compiled-cases.jsonl）の行の作り方。
// 1 行目は見出し、2 行目以降は照合の順の照合単位（偽の条件は書かない）。
export function groupToLine(g) {
  return JSON.stringify({
    matchText: g.matchText,
    priority: g.priority,
    order: g.order,
    forms: g.forms.map((f) => ({
      segments: f.segments.map((s) => [s.offset, s.length, s.reading]),
      ...(f.particle ? { particle: true } : {}),
      ...(f.standalone ? { standalone: true } : {}),
      ...(f.leftStandalone ? { leftStandalone: true } : {}),
      ...(f.before ? { before: f.before } : {}),
    })),
  });
}

export function toCompiledLines(head, groups) {
  return [JSON.stringify(head), ...groups.map(groupToLine)];
}
