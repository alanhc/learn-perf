// Section 08 — Flame Graph
// Data is a flame-graph-style nested structure with sample counts.
// Based on the matrix-v1 case study.
const FLAME_DATA = {
  name: "[all]",
  value: 1000,
  children: [{
    name: "_start",
    value: 998,
    children: [{
      name: "__libc_start_main",
      value: 998,
      children: [{
        name: "main",
        value: 998,
        children: [
          { name: "load_matrix", value: 6, children: [
            { name: "fread", value: 5, children: [
              { name: "__GI__IO_fread", value: 5, children: [
                { name: "read", value: 4, children: [] },
              ]},
            ]},
          ]},
          { name: "mult", value: 990, children: [
            { name: "imul (b[k][j])", value: 720, children: [] },
            { name: "add (loop)", value: 180, children: [] },
            { name: "cmp / jne", value: 70, children: [] },
            { name: "mov a[i][k]", value: 20, children: [] },
          ]},
          { name: "memset", value: 2, children: [] },
        ],
      }],
    }],
  }],
};

// Hash function name to a flame color (red→yellow palette)
function flameColor(name, hash) {
  const hue = 35 + (hash % 25);   // amber/orange range
  const sat = 70 + (hash % 25);
  const light = 50 + (hash % 15);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function flattenFlame(node, depth = 0, x = 0, total, rows = []) {
  if (!rows[depth]) rows[depth] = [];
  const width = node.value / total;
  rows[depth].push({ name: node.name, value: node.value, x, width, depth });
  let cx = x;
  for (const c of node.children || []) {
    flattenFlame(c, depth + 1, cx, total, rows);
    cx += c.value / total;
  }
  return rows;
}

function FlameGraphSection({ t, showAnnotations }) {
  const [hovered, setHovered] = useState(null);
  const [zoomedNode, setZoomedNode] = useState(null);
  const total = FLAME_DATA.value;
  const rows = useMemo(() => flattenFlame(FLAME_DATA, 0, 0, total), [total]);
  // Reverse so deepest is at top (typical flamegraph orientation: root at bottom)
  const displayRows = [...rows].reverse();

  const containerW = 1100;
  const rowH = 24;

  return (
    <Section id="flamegraph" label="Flame Graph" num="08"
      eyebrow={t.fg.eyebrow}
      title={t.fg.title}
      lede={t.fg.lede}
    >
      <Card title="Flame Graph — matrix-v1 cycle 取樣">
        <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: 16, position: "relative" }}>
          <div style={{ width: "100%", overflow: "hidden" }}>
            {displayRows.map((row, ri) => (
              <div key={ri} className="flame-row" style={{ position: "relative", height: rowH, marginBottom: 1 }}>
                {row.map((cell, ci) => {
                  const left = cell.x * 100;
                  const width = cell.width * 100;
                  const hash = strHash(cell.name);
                  const color = flameColor(cell.name, hash);
                  const pct = (cell.value / total) * 100;
                  return (
                    <div
                      key={ci}
                      className="flame-cell"
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        width: `calc(${width}% - 1px)`,
                        background: color,
                      }}
                      onMouseEnter={() => setHovered({ ...cell, pct })}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setZoomedNode(cell)}
                    >
                      {width > 4 && cell.name}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* x-axis */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-mute)" }}>
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280, padding: 14, background: "var(--bg-input)", borderRadius: 8, fontFamily: "var(--mono)", fontSize: 13 }}>
            {hovered ? (
              <>
                <div style={{ color: "var(--accent)", fontWeight: 600 }}>{hovered.name}</div>
                <div style={{ color: "var(--text-dim)", marginTop: 6, fontSize: 12 }}>
                  samples: <span style={{ color: "var(--text)" }}>{hovered.value}</span> &nbsp;|&nbsp;
                  pct: <span style={{ color: "var(--text)" }}>{hovered.pct.toFixed(2)}%</span> &nbsp;|&nbsp;
                  depth: <span style={{ color: "var(--text)" }}>{hovered.depth}</span>
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-mute)" }}>{t.fg.hover} →</div>
            )}
          </div>
        </div>

        <Annot show={showAnnotations}>
          最寬的塔頂 = 最熱的程式碼。在 matrix-v1 中，<code>imul (b[k][j])</code> 佔了 72% — 立刻指出
          矩陣 B 的不連續記憶體存取就是瓶頸所在，再對應到第 6 章的 cache 視覺化即可理解原因。
        </Annot>
      </Card>

      <div style={{ height: 24 }} />

      <div className="grid-3">
        <Card title="如何產生" dot={false} style={{ borderTop: "3px solid var(--cool)" }}>
          <pre style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
{`# 1. 取樣
$ sudo perf record -g \\
    --call-graph lbr ./prog

# 2. 用 stackcollapse + flamegraph
$ perf script | \\
    stackcollapse-perf.pl | \\
    flamegraph.pl > flame.svg`}
          </pre>
        </Card>
        <Card title="閱讀技巧" dot={false} style={{ borderTop: "3px solid var(--accent)" }}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.8 }}>
            <li>橫軸 = 樣本佔比 (非時間)</li>
            <li>縱軸 = 呼叫深度，根在底部</li>
            <li>同前綴自動合併</li>
            <li>顏色僅為視覺區分，無語義</li>
          </ul>
        </Card>
        <Card title="變體" dot={false} style={{ borderTop: "3px solid var(--violet)" }}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.8 }}>
            <li><strong>Icicle</strong> — 倒過來，根在頂</li>
            <li><strong>Differential</strong> — 兩次取樣相減</li>
            <li><strong>Off-CPU</strong> — 看 blocking / IO 而非 CPU</li>
          </ul>
        </Card>
      </div>
    </Section>
  );
}

window.FlameGraphSection = FlameGraphSection;
