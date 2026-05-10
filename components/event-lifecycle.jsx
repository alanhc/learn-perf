// Detailed block diagram: how a single perf sample is born and travels through the system.
// Animated step-by-step trace of one event from CPU → ring buffer → user → visualization.
function EventLifecycle({ animSpeed = 1, showAnnotations = true }) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const TOTAL = 8;

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setStep(s => (s + 1) % TOTAL), 1800 / animSpeed);
    return () => clearInterval(id);
  }, [auto, animSpeed]);

  // Steps with their associated active block and a description
  const STEPS = [
    { id: 0, active: ["pmu"], label: "① PMU 計數器遞減",
      desc: "硬體效能單元 (PMU) 的計數器隨指定事件 (cycles, cache-miss…) 一次次遞減。" },
    { id: 1, active: ["pmu", "irq"], label: "② 計數器歸零，觸發中斷",
      desc: "當 counter 走到 0，CPU 透過 NMI / PMI 直接打中斷給核心，並立刻重設下一個 period。" },
    { id: 2, active: ["irq", "handler"], label: "③ 核心 IRQ handler 接住",
      desc: "Linux 的 perf_event_overflow() 是這個中斷的入口，立刻搶下當前 CPU 控制權。" },
    { id: 3, active: ["handler", "snapshot"], label: "④ 快照當下執行狀態",
      desc: "讀出被打斷指令的 IP、所有通用暫存器、stack pointer，必要時還向上展開幾個 stack frame。" },
    { id: 4, active: ["snapshot", "ring"], label: "⑤ 寫入 ring buffer",
      desc: "把樣本結構 (PERF_RECORD_SAMPLE) 序列化寫進 mmap 共享的 ring buffer，避免額外的 syscall。" },
    { id: 5, active: ["ring", "perf"], label: "⑥ user 端 perf 程式輪詢",
      desc: "perf record 透過 mmap 讀同一塊 ring buffer，把 raw samples flush 到 perf.data 檔。" },
    { id: 6, active: ["perf", "symbol"], label: "⑦ 符號解析",
      desc: "perf report 載入 ELF/DWARF/kallsyms，把 IP 位址翻成函式名稱、檔名、行號。" },
    { id: 7, active: ["symbol", "viz"], label: "⑧ 聚合與視覺化",
      desc: "依 stack trace 聚合相同前綴，產出 Call Graph、Flame Graph、annotation 等人腦可消化的視圖。" },
  ];

  const cur = STEPS[step];
  const isActive = (id) => cur.active.includes(id);

  // SVG layout
  const W = 1100, H = 460;
  // Block descriptors with positions
  const blocks = {
    pmu:      { x: 30,  y: 20,  w: 200, h: 90, label: "PMU\n(硬體計數器)", sub: "cycles · cache · branch", layer: "hw", color: "#ff5d6c" },
    irq:      { x: 280, y: 20,  w: 160, h: 90, label: "NMI / PMI", sub: "中斷訊號", layer: "hw", color: "#ff5d6c" },
    handler:  { x: 30,  y: 150, w: 410, h: 80, label: "perf_event_overflow()", sub: "Linux kernel IRQ handler", layer: "kernel", color: "#ffb627" },
    snapshot: { x: 470, y: 150, w: 220, h: 80, label: "PT_REGS\n+ stack unwind", sub: "IP · GP regs · SP · FP", layer: "kernel", color: "#ffb627" },
    ring:     { x: 720, y: 150, w: 350, h: 80, label: "ring buffer (mmap)", sub: "PERF_RECORD_SAMPLE × N", layer: "kernel", color: "#ffb627" },
    perf:     { x: 30,  y: 270, w: 280, h: 80, label: "perf record", sub: "user-space reader", layer: "user", color: "#4dd2ff" },
    symbol:   { x: 340, y: 270, w: 350, h: 80, label: "perf report\n(addr2sym + DWARF)", sub: "IP → fn / file / line", layer: "user", color: "#4dd2ff" },
    viz:      { x: 720, y: 270, w: 350, h: 80, label: "Call Graph · Flame Graph", sub: "聚合 + 視覺化", layer: "viz", color: "#6ee7a4" },
  };
  // Layer band rows (for striping background)
  const bands = [
    { y: 0,   h: 130, label: "HARDWARE",     color: "#ff5d6c" },
    { y: 130, h: 130, label: "KERNEL",       color: "#ffb627" },
    { y: 260, h: 100, label: "USER SPACE",   color: "#4dd2ff" },
    { y: 360, h: 80,  label: "VISUALIZATION", color: "#6ee7a4" },
  ];

  // Edges (arrows): from → to, with optional label
  const edges = [
    { from: "pmu", to: "irq", label: "overflow", path: "M 230 65 L 280 65" },
    { from: "irq", to: "handler", label: "raise IRQ", path: "M 360 110 L 360 130 L 235 130 L 235 150" },
    { from: "handler", to: "snapshot", label: "capture", path: "M 440 190 L 470 190" },
    { from: "snapshot", to: "ring", label: "write", path: "M 690 190 L 720 190" },
    { from: "ring", to: "perf", label: "mmap read", path: "M 895 230 L 895 250 L 170 250 L 170 270" },
    { from: "perf", to: "symbol", label: "perf.data", path: "M 310 310 L 340 310" },
    { from: "symbol", to: "viz", label: "stacks", path: "M 690 310 L 720 310" },
  ];

  // edge step mapping (which step activates which edge)
  const edgeStep = { 0: -1, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

  return (
    <Card title="一個樣本的旅程 — 由 CPU 矽晶片到火焰圖" style={{ overflow: "hidden" }}>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
          {/* layer bands */}
          {bands.map(b => (
            <g key={b.label}>
              <rect x={0} y={b.y} width={W} height={b.h} fill={b.color} fillOpacity={0.04} />
              <line x1={0} y1={b.y} x2={W} y2={b.y} stroke={b.color} strokeOpacity={0.3} strokeDasharray="4 4" />
              <text x={W - 14} y={b.y + 14} fontFamily="var(--mono)" fontSize="9" fontWeight="700"
                letterSpacing="2" fill={b.color} fillOpacity={0.7} textAnchor="end">
                {b.label}
              </text>
            </g>
          ))}

          {/* edges */}
          {edges.map((e, i) => {
            const active = edgeStep[step] === i;
            return (
              <g key={i}>
                <path d={e.path}
                  stroke={active ? "var(--accent)" : "var(--text-mute)"}
                  strokeWidth={active ? 2.5 : 1.2}
                  strokeDasharray={active ? "0" : "4 3"}
                  fill="none"
                  markerEnd={active ? "url(#arrow-active)" : "url(#arrow-mute)"}
                  opacity={active ? 1 : 0.45}
                />
                {/* edge label, mid-point heuristic */}
                {active && (() => {
                  const m = e.path.match(/M\s*([\d.]+)\s+([\d.]+)/);
                  const l = e.path.match(/L\s*([\d.]+)\s+([\d.]+)\s*$/);
                  if (!m || !l) return null;
                  const mx = (parseFloat(m[1]) + parseFloat(l[1])) / 2;
                  const my = (parseFloat(m[2]) + parseFloat(l[2])) / 2;
                  return (
                    <g>
                      <rect x={mx - 32} y={my - 8} width={64} height={16} rx={3} fill="var(--bg-card)" stroke="var(--accent)" strokeWidth={0.5} />
                      <text x={mx} y={my + 3} textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--accent)">
                        {e.label}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* arrow markers */}
          <defs>
            <marker id="arrow-mute" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--text-mute)" opacity={0.5} />
            </marker>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
            </marker>
          </defs>

          {/* blocks */}
          {Object.entries(blocks).map(([id, b]) => {
            const active = isActive(id);
            return (
              <g key={id} style={{ transition: "transform .25s" }}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8}
                  fill={active ? b.color : "var(--bg-card)"}
                  stroke={active ? b.color : `${b.color}50`}
                  strokeWidth={active ? 2 : 1}
                />
                {/* glow ring on active */}
                {active && (
                  <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} rx={11}
                    fill="none" stroke={b.color} strokeWidth={1} strokeOpacity={0.4}>
                    <animate attributeName="stroke-opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
                  </rect>
                )}
                {b.label.split("\n").map((line, li) => (
                  <text key={li} x={b.x + b.w / 2} y={b.y + 28 + li * 16}
                    textAnchor="middle"
                    fontFamily="var(--mono)" fontSize="13" fontWeight="700"
                    fill={active ? "#0a0a0c" : "var(--text)"}>
                    {line}
                  </text>
                ))}
                <text x={b.x + b.w / 2} y={b.y + b.h - 14}
                  textAnchor="middle"
                  fontFamily="var(--mono)" fontSize="10"
                  fill={active ? "#0a0a0c" : "var(--text-mute)"}
                  opacity={active ? 0.8 : 1}>
                  {b.sub}
                </text>
              </g>
            );
          })}

          {/* sample data flying along active edge */}
          {edgeStep[step] >= 0 && (() => {
            const e = edges[edgeStep[step]];
            const m = e.path.match(/M\s*([\d.]+)\s+([\d.]+)/);
            const l = e.path.match(/L\s*([\d.]+)\s+([\d.]+)\s*$/);
            if (!m || !l) return null;
            const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
            const x2 = parseFloat(l[1]), y2 = parseFloat(l[2]);
            return (
              <circle r={6} fill="var(--accent)">
                <animate attributeName="cx" from={x1} to={x2} dur={`${1.4 / animSpeed}s`} repeatCount="indefinite" />
                <animate attributeName="cy" from={y1} to={y2} dur={`${1.4 / animSpeed}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0" dur={`${1.4 / animSpeed}s`} repeatCount="indefinite" />
              </circle>
            );
          })()}
        </svg>
      </div>

      {/* step controls */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button className="btn" onClick={() => setAuto(a => !a)}>{auto ? "⏸ pause" : "▶ play"}</button>
          <button className="btn" onClick={() => { setStep(s => (s - 1 + TOTAL) % TOTAL); setAuto(false); }}>‹ prev</button>
          <button className="btn" onClick={() => { setStep(s => (s + 1) % TOTAL); setAuto(false); }}>next ›</button>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-mute)" }}>
            step {step + 1} / {TOTAL}
          </span>
        </div>
        {/* Step pills */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
          {STEPS.map((s, i) => (
            <button key={i}
              onClick={() => { setStep(i); setAuto(false); }}
              className="chip"
              style={{
                cursor: "pointer",
                borderColor: step === i ? "var(--accent)" : "var(--line)",
                color: step === i ? "var(--accent)" : "var(--text-mute)",
                background: step === i ? "var(--accent-soft)" : "var(--bg-input)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ background: "var(--bg-input)", padding: "14px 18px", borderRadius: 8, borderLeft: "3px solid var(--accent)" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>
            {cur.label}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.7 }}>
            {cur.desc}
          </div>
        </div>
      </div>

      <Annot show={showAnnotations}>
        ring buffer 是 perf 高效的關鍵 — 它是核心與使用者程式 mmap 共享的同一塊記憶體，因此 perf record 不需要 syscall 就能讀到樣本。這也是為什麼即使每秒幾千個樣本，perf 的額外負擔仍可低於 5%。
      </Annot>
    </Card>
  );
}

window.EventLifecycle = EventLifecycle;
