// Rosetta — same operation viewed at different abstraction levels
// Click a layer to highlight the corresponding tokens in every other layer.
function AbstractionRosetta({ animSpeed = 1, showAnnotations = true }) {
  const [focus, setFocus] = useState("source"); // which layer is "speaking"

  // Annotated tokens: layer → array of {text, group?}
  // Same color "group" means same conceptual operation across all layers
  const layers = [
    {
      id: "source", title: "C 原始碼", sub: "你寫的程式",
      color: "#6ee7a4",
      tokens: [
        { t: "for (int k = 0; k < N; k++)", g: "loop" }, { br: true },
        { t: "    ", g: null },
        { t: "c[i][j]", g: "store" },
        { t: " += ", g: "add" },
        { t: "a[i][k]", g: "loadA" },
        { t: " * ", g: "mul" },
        { t: "b[k][j]", g: "loadB" },
        { t: ";", g: null },
      ],
    },
    {
      id: "asm", title: "x86_64 組合語言", sub: "編譯器產生的指令",
      color: "#4dd2ff",
      tokens: [
        { t: ".L2:", g: "loop" }, { br: true },
        { t: "  mov  ", g: null }, { t: "(%rcx,%rax,4)", g: "loadA" }, { t: ", %edx", g: null }, { br: true },
        { t: "  imul ", g: "mul" }, { t: "(%rdx,%rax,4)", g: "loadB" }, { t: ", %edx", g: null }, { br: true },
        { t: "  add  ", g: "add" }, { t: "%edx, ", g: null }, { t: "(%rdi)", g: "store" }, { br: true },
        { t: "  add  $1, %rax", g: "loop" }, { br: true },
        { t: "  cmp  %rsi, %rax", g: "loop" }, { br: true },
        { t: "  jne  .L2", g: "loop" },
      ],
    },
    {
      id: "machine", title: "機器碼 (機器看到的)", sub: "ELF .text 段裡的 byte stream",
      color: "#b794f6",
      tokens: [
        { t: "8B 14 81  ", g: "loadA" },
        { t: "0F AF 17  ", g: "mul" }, { t: "(+", g: "loadB" }, { t: ")", g: null }, { br: true },
        { t: "01 17     ", g: "add" }, { t: "(+", g: "store" }, { t: ")", g: null }, { br: true },
        { t: "48 83 C0 01 ", g: "loop" }, { t: "48 39 F0 ", g: "loop" }, { t: "75 ED", g: "loop" },
      ],
    },
    {
      id: "pipeline", title: "CPU Pipeline (執行時)", sub: "每條指令在哪個階段",
      color: "#ffb627",
      special: "pipeline",
    },
    {
      id: "pmu", title: "PMU 事件 (perf 看到的)", sub: "硬體計數器在每條指令觸發",
      color: "#ff5d6c",
      special: "pmu",
    },
  ];

  const isFocus = (id) => focus === id;

  function renderTokens(layer) {
    if (layer.special === "pipeline") {
      const pipe = [
        { ins: "mov", g: "loadA",  stages: ["IF", "ID", "EX", "MEM", "WB"] },
        { ins: "imul", g: "mul",   stages: ["IF", "ID", "EX", "EX", "EX", "WB"] },
        { ins: "add",  g: "add",   stages: ["IF", "ID", "EX", "WB"] },
        { ins: "add",  g: "loop",  stages: ["IF", "ID", "EX", "WB"] },
        { ins: "cmp",  g: "loop",  stages: ["IF", "ID", "EX", "WB"] },
        { ins: "jne",  g: "loop",  stages: ["IF", "ID", "EX", "WB"] },
      ];
      const stageColors = { IF: "#4dd2ff", ID: "#b794f6", EX: "#ffb627", MEM: "#ff85c1", WB: "#6ee7a4" };
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {pipe.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 56, fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{p.ins}</span>
              {Array.from({ length: i }).map((_, k) => <div key={k} style={{ width: 26, height: 18 }} />)}
              {p.stages.map((s, k) => (
                <div key={k} style={{
                  width: 26, height: 18, borderRadius: 2,
                  background: stageColors[s], color: "#000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
                }}>{s}</div>
              ))}
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--mono)", marginTop: 6 }}>
            imul 多吃 2 個 EX cycle；mov 走 MEM 階段碰 cache
          </div>
        </div>
      );
    }
    if (layer.special === "pmu") {
      const events = [
        { e: "instructions", v: 7, color: "#ffb627" },
        { e: "cpu-cycles", v: 9, color: "#ff5d6c" },
        { e: "L1-dcache-loads", v: 2, color: "#4dd2ff" },
        { e: "L1-dcache-load-misses", v: 1, color: "#ff5d6c", warn: true },
        { e: "branch-instructions", v: 1, color: "#b794f6" },
        { e: "branch-misses", v: 0, color: "#6ee7a4" },
      ];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {events.map((ev, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 11 }}>
              <span style={{ width: 170, color: "var(--text-dim)" }}>{ev.e}</span>
              <div style={{ flex: 1, display: "flex", gap: 2 }}>
                {Array.from({ length: 9 }).map((_, k) => (
                  <div key={k} style={{
                    width: 14, height: 14, borderRadius: 2,
                    background: k < ev.v ? ev.color : "var(--bg-input)",
                    border: k < ev.v ? "none" : "1px solid var(--line)",
                  }} />
                ))}
              </div>
              <span style={{ width: 22, color: ev.warn ? "var(--hot)" : "var(--text)", textAlign: "right", fontWeight: 600 }}>{ev.v}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--mono)", marginTop: 4 }}>
            一次內層迴圈疊代產生的事件數 (示意)
          </div>
        </div>
      );
    }
    // text-token rendering
    return (
      <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-wrap" }}>
        {layer.tokens.map((tok, i) => {
          if (tok.br) return <br key={i} />;
          const groupColor = GROUP_COLORS[tok.g];
          return (
            <span key={i} style={{
              background: tok.g ? `${groupColor}25` : "transparent",
              color: tok.g ? groupColor : "var(--text-dim)",
              padding: tok.g ? "1px 3px" : 0,
              borderRadius: 3,
              borderBottom: tok.g ? `1px solid ${groupColor}50` : "none",
            }}>{tok.t}</span>
          );
        })}
      </pre>
    );
  }

  return (
    <Card title="Rosetta — 同一操作在不同抽象層的樣貌" style={{ overflow: "hidden" }}>
      <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 18, lineHeight: 1.7 }}>
        以矩陣相乘的內層運算 <code>c[i][j] += a[i][k] * b[k][j]</code> 為例，往下追蹤
        它如何被翻譯、執行、最終又如何被 perf 觀察到。同色塊代表同一邏輯操作在每一層的對應物。
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {layers.map(l => (
          <button key={l.id}
            onClick={() => setFocus(l.id)}
            className="chip"
            style={{
              cursor: "pointer", padding: "6px 12px",
              background: isFocus(l.id) ? `${l.color}22` : "var(--bg-input)",
              borderColor: isFocus(l.id) ? l.color : "var(--line)",
              color: isFocus(l.id) ? l.color : "var(--text-dim)",
              fontWeight: isFocus(l.id) ? 600 : 400,
            }}>
            {l.title}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {layers.map((layer, idx) => (
          <div key={layer.id}
            onClick={() => setFocus(layer.id)}
            style={{
              display: "grid", gridTemplateColumns: "200px 1fr", gap: 16,
              padding: "16px 18px",
              background: isFocus(layer.id) ? `${layer.color}10` : "var(--bg-card)",
              border: `1px solid ${isFocus(layer.id) ? layer.color : "var(--line)"}`,
              borderRadius: 8,
              cursor: "pointer",
              transition: "all .2s",
              opacity: focus && !isFocus(layer.id) ? 0.55 : 1,
            }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 50, background: layer.color }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: 2, color: layer.color, fontWeight: 700 }}>
                  L{idx}
                </span>
              </div>
              <div style={{ fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{layer.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2 }}>{layer.sub}</div>
              {idx < layers.length - 1 && (
                <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--mono)" }}>↓ {nextStepLabel(idx)}</div>
              )}
            </div>
            <div style={{ background: "var(--bg)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--line-soft)" }}>
              {renderTokens(layer)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)" }}>
        {Object.entries(GROUP_COLORS).map(([k, c]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 12, height: 12, background: c, borderRadius: 2 }} />
            {GROUP_LABELS[k]}
          </span>
        ))}
      </div>

      <Annot show={showAnnotations}>
        從 L0 到 L4 抽象越來越低、越來越具體：高階一行程式對應到 L1 的 6 條組合語言指令，
        到 L3 變成需要 4–6 個 cycle 的 pipeline 階段，最終在 L4 被 perf 看作 7 條 instructions、9 個 cycle、1 次 cache miss 的事件序列。
        想優化效能，必須能在這幾層之間自由切換思考。
      </Annot>
    </Card>
  );
}

const GROUP_COLORS = {
  loadA: "#4dd2ff",
  loadB: "#b794f6",
  mul:   "#ff5d6c",
  add:   "#ffb627",
  store: "#6ee7a4",
  loop:  "#ff85c1",
};
const GROUP_LABELS = {
  loadA: "載入 a[i][k]",
  loadB: "載入 b[k][j]",
  mul:   "乘法",
  add:   "累加",
  store: "存回 c[i][j]",
  loop:  "迴圈控制",
};

function nextStepLabel(idx) {
  return ["編譯器產生", "組譯為機器碼", "CPU 取指 + 執行", "PMU 計數"][idx] || "";
}

window.AbstractionRosetta = AbstractionRosetta;
