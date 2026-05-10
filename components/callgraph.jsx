// Section 07 — Call Graph (caller vs callee)
// Data based on textprocessor1 example from sysprog/linux-perf
const CG_DATA = {
  caller: {
    name: "_start",
    pct: 100,
    children: [{
      name: "__libc_start_main",
      pct: 99.9,
      children: [{
        name: "main",
        pct: 99.0,
        children: [
          { name: "string_map_add", pct: 46.74, children: [
            { name: "strcmp@plt", pct: 30.57, children: [
              { name: "__strcmp_avx2", pct: 30.07, children: [] },
            ]},
            { name: "string_list_append", pct: 4.5, children: [] },
          ]},
          { name: "string_list_append", pct: 11.97, children: [
            { name: "__strdup", pct: 10.57, children: [
              { name: "malloc / _int_malloc", pct: 9.85, children: [] },
            ]},
          ]},
          { name: "qsort", pct: 14.2, children: [
            { name: "msort_with_tmp", pct: 13.5, children: [
              { name: "str_ptr_compare", pct: 8.1, children: [
                { name: "__strcmp_avx2", pct: 6.5, children: [] },
              ]},
            ]},
          ]},
          { name: "fputs", pct: 8.4, children: [] },
          { name: "fgets", pct: 6.3, children: [] },
        ],
      }],
    }],
  },
  callee: {
    name: "__strcmp_avx2",
    pct: 31.07,
    children: [
      { name: "← strcmp@plt", pct: 20.20, children: [
        { name: "← string_map_add", pct: 20.20, children: [
          { name: "← main", pct: 20.20, children: [
            { name: "← __libc_start_main", pct: 20.20, children: [
              { name: "← _start", pct: 20.20, children: [] },
            ]},
          ]},
        ]},
      ]},
      { name: "← str_ptr_compare", pct: 8.1, children: [
        { name: "← msort_with_tmp", pct: 8.1, children: [
          { name: "← qsort", pct: 8.1, children: [
            { name: "← main", pct: 8.1, children: [] },
          ]},
        ]},
      ]},
    ],
  },
};

function CGNode({ node, depth = 0, defaultOpen = true, maxPct }) {
  const [open, setOpen] = useState(depth < 2 || defaultOpen);
  const hasChildren = node.children && node.children.length;
  const barW = (node.pct / maxPct) * 240;

  return (
    <div>
      <div className="tree-node" onClick={() => hasChildren && setOpen(o => !o)}>
        <span className="tree-caret" style={{ visibility: hasChildren ? "visible" : "hidden" }}>
          {open ? "▾" : "▸"}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-mute)", width: 56, textAlign: "right", flexShrink: 0 }}>
          {node.pct.toFixed(2)}%
        </span>
        <div className="tree-bar" style={{ width: Math.max(2, barW), background: pctColor(node.pct, maxPct) }} />
        <span style={{ color: "var(--text)" }}>{node.name}</span>
      </div>
      {open && hasChildren && (
        <div className="tree-children">
          {node.children.map((c, i) => (
            <CGNode key={i} node={c} depth={depth + 1} maxPct={maxPct} />
          ))}
        </div>
      )}
    </div>
  );
}

function pctColor(pct, max) {
  const ratio = pct / max;
  if (ratio > 0.5) return "var(--hot)";
  if (ratio > 0.2) return "var(--accent)";
  if (ratio > 0.05) return "var(--cool)";
  return "var(--text-mute)";
}

function CallGraphSection({ t, showAnnotations }) {
  const [view, setView] = useState("caller"); // caller | callee
  const [method, setMethod] = useState("fp");

  const data = CG_DATA[view];
  const methodInfo = {
    fp: { label: "fp (frame pointer)", desc: "走訪每個 stack frame；需編譯時加 -fno-omit-frame-pointer。額外負擔低。", file: "635 KB" },
    dwarf: { label: "dwarf", desc: "用除錯資訊解析 frame；inline 函式也能列出。檔案最大、額外負擔最高。", file: "45 MB" },
    lbr: { label: "lbr (Last Branch Record)", desc: "用 CPU 內建分支記錄暫存器；額外負擔低，但 stack 太深會截斷。", file: "940 KB" },
  }[method];

  return (
    <Section id="callgraph" label="Call Graph" num="07"
      eyebrow={t.cg.eyebrow}
      title={t.cg.title}
      lede={t.cg.lede}
    >
      <div className="grid-2">
        <Card title="Stack Trace 數據解讀方式">
          <div style={{ display: "flex", gap: 0, marginBottom: 18, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
            <button
              className={clsx("tab", view === "caller" && "active")}
              onClick={() => setView("caller")}
              style={{ flex: 1, borderBottom: 0, padding: "12px 14px", textAlign: "center" }}
            >
              ↓ {t.cg.caller}<div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2, textTransform: "none", letterSpacing: 0 }}>由上而下 · 看模組吃多少時間</div>
            </button>
            <button
              className={clsx("tab", view === "callee" && "active")}
              onClick={() => setView("callee")}
              style={{ flex: 1, borderBottom: 0, padding: "12px 14px", textAlign: "center" }}
            >
              ↑ {t.cg.callee}<div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2, textTransform: "none", letterSpacing: 0 }}>由下而上 · 看為何被呼叫</div>
            </button>
          </div>

          <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px", maxHeight: 480, overflowY: "auto" }}>
            <CGNode node={data} maxPct={data.pct} />
          </div>

          <p style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 14, lineHeight: 1.7 }}>
            {view === "caller"
              ? "從 _start 一路展開往下。同前綴的 stack trace 自動聚合，比例顯示「該節點之下花了多少時間」。"
              : "從熱點 __strcmp_avx2 反推呼叫鏈。可看到 31% 的 strcmp 中，有 20% 來自 string_map_add 的線性搜尋。"}
          </p>
        </Card>

        <Card title="記錄 Stack Trace 的三種方法">
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {["fp", "dwarf", "lbr"].map(m => (
              <button key={m} className={clsx("btn", method === m && "primary")} onClick={() => setMethod(m)}>
                {m}
              </button>
            ))}
          </div>
          <div style={{ background: "var(--bg-input)", padding: 16, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>
              --call-graph {method}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
              {methodInfo.desc}
            </div>
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="stat-num warm">{methodInfo.file}</div>
              <div className="stat-label">callgraph.{method}.perf.data 大小</div>
            </div>
          </div>

          <div style={{ borderTop: "1px dashed var(--line)", marginTop: 18, paddingTop: 14, fontSize: 12, color: "var(--text-mute)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--text)" }}>關鍵編譯選項：</strong><br />
            • <code>-fno-omit-frame-pointer</code> — fp 模式必備<br />
            • <code>-fno-optimize-sibling-calls</code> — 避免 sibling call 讓 stack trace 看起來怪怪的<br />
            • <code>-fno-inline</code> — 不想要 inline 把呼叫關係吃掉時用 (但會傷效能)
          </div>

          <Annot show={showAnnotations}>
            如果熱點在 strcmp / strcpy 這類 libc 函式，看 caller-based 沒用 (因為散落各處)；切到 callee-based 才會把所有路徑聚到該函式之下。
          </Annot>
        </Card>
      </div>

      <div style={{ height: 24 }} />

      <Card title="Caller-based vs Callee-based — 何時用哪個？">
        <div className="grid-2">
          <div style={{ borderLeft: "3px solid var(--cool)", paddingLeft: 16 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--cool)", marginBottom: 6 }}>↓ Caller-based</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-dim)" }}>
              適合：能切成獨立模組的程式 (例如 3D 渲染管線：vertex → primitive → raster → fragment)。
              從佔比最高的模組開始最佳化，整體上限受該模組原本佔比限制。
            </div>
          </div>
          <div style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 16 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)", marginBottom: 6 }}>↑ Callee-based</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-dim)" }}>
              適合：熱點落在已優化過的基礎函式 (libc 字串、容器查找)。
              基礎函式本身難以優化，但呼叫者可能用錯資料結構 — 從呼叫鏈往上找出可改的演算法。
            </div>
          </div>
        </div>
      </Card>
    </Section>
  );
}

window.CallGraphSection = CallGraphSection;
