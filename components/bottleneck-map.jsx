// BottleneckMap — single-frame integration of HW bottleneck hierarchy
// (CPU → TLB → L1/L2/L3 → DRAM) with measurement chain
// (PMU → NMI → kernel IRQ handler → ring buffer → user space).
function BottleneckMap({ animSpeed = 1, showAnnotations = true }) {
  const [pattern, setPattern] = useState("seq"); // seq | random | tlb-thrash
  const [highlight, setHighlight] = useState(null); // PMU counter id
  const t = useTick(30, true, animSpeed);

  // HW components — laid out horizontally
  const hw = [
    { id: "cpu",  name: "CPU Core",  sub: "register / pipeline", lat: 0,   x: 60,  color: "#6ee7a4" },
    { id: "tlb",  name: "MMU + TLB", sub: "virt → phys",         lat: 1,   x: 220, color: "#ff85c1" },
    { id: "l1",   name: "L1d",       sub: "32 KB / core",        lat: 4,   x: 380, color: "#4dd2ff" },
    { id: "l2",   name: "L2",        sub: "256 KB / core",       lat: 12,  x: 540, color: "#b794f6" },
    { id: "l3",   name: "L3 / LLC",  sub: "shared, 8–32 MB",     lat: 40,  x: 700, color: "#ffb627" },
    { id: "ram",  name: "DRAM",      sub: "GB, off-die",         lat: 200, x: 860, color: "#ff5d6c" },
  ];

  // PMU counters — each taps a HW component
  const counters = [
    { id: "cycles",     name: "cpu-cycles",            taps: "cpu", count: 9342 },
    { id: "insns",      name: "instructions",          taps: "cpu", count: 7821 },
    { id: "dtlb",       name: "dTLB-load-misses",      taps: "tlb", count: 41 },
    { id: "l1miss",     name: "L1-dcache-load-misses", taps: "l1",  count: 213 },
    { id: "llcmiss",    name: "LLC-load-misses",       taps: "l3",  count: 28 },
    { id: "memloads",   name: "mem-loads",             taps: "ram", count: 12 },
  ];

  // Patterns dictate where the access lands (which level it terminates at)
  const patterns = {
    seq:        { label: "循序存取",  end: "l1",  prob: { cpu: 1, tlb: 1, l1: 1, l2: 0, l3: 0, ram: 0 } },
    random:     { label: "隨機存取",  end: "ram", prob: { cpu: 1, tlb: 1, l1: 0.1, l2: 0.2, l3: 0.3, ram: 0.4 } },
    "tlb-thrash":{ label: "TLB 抖動", end: "tlb_miss", prob: { cpu: 1, tlb: 1, l1: 0, l2: 0, l3: 0, ram: 0 } },
  };
  const cur = patterns[pattern];

  // Animate a memory access dot through HW
  const period = 90; // frames
  const phase = (t % period) / period;

  function getDotPos() {
    // dot moves through layers up to the terminating one
    const order = ["cpu", "tlb", "l1", "l2", "l3", "ram"];
    let endIdx;
    if (cur.end === "tlb_miss") endIdx = 1; // bounce at TLB
    else endIdx = order.indexOf(cur.end);
    if (endIdx < 0) endIdx = 5;

    const stages = endIdx + 1;
    const stage = Math.min(Math.floor(phase * stages * 1.4), endIdx);
    const local = (phase * stages * 1.4) % 1;
    const c0 = hw[stage];
    const c1 = hw[Math.min(stage + 1, endIdx)];
    if (cur.end === "tlb_miss" && stage >= 1) {
      // ping-pong between cpu↔tlb to simulate page walk
      const pingPhase = (t % 30) / 30;
      const a = hw[1]; const b = hw[5]; // tlb ↔ ram (page walk hits memory!)
      const x = a.x + (b.x - a.x) * Math.sin(pingPhase * Math.PI);
      return { x, y: 110, hot: true };
    }
    return { x: c0.x + (c1.x - c0.x) * local, y: 110, hot: stage >= 3 };
  }
  const dot = getDotPos();

  // Determine which counter is "ticking" right now
  const tickingCounter = (() => {
    if (cur.end === "tlb_miss") return "dtlb";
    if (cur.end === "ram") return "llcmiss";
    if (cur.end === "l3") return "l1miss";
    return "cycles";
  })();

  // Overflow chain animation: every N frames a sample fires through the kernel chain
  const overflowPhase = ((t % 60) / 60);
  const fired = (t % 60) >= 0 && (t % 60) < 50;

  return (
    <Card title="Bottleneck Map — 從硬體瓶頸到測量輸出的全景圖">
      <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16, lineHeight: 1.7 }}>
        左半邊是<b style={{ color: "var(--accent)" }}>資料路徑</b>（一次記憶體存取走過 CPU → TLB → L1 → L2 → L3 → DRAM，
        延遲指數成長）。下半部 PMU 計數器探針<b style={{ color: "var(--accent)" }}>固定在各層</b>上 — 哪一層瓶頸觸發，
        對應的計數器就跳。當計數器溢位 → NMI → kernel IRQ handler → perf_events 子系統 → mmap ring buffer → user space。
      </p>

      {/* Pattern selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: "var(--text-mute)", alignSelf: "center", marginRight: 4 }}>存取樣式：</span>
        {Object.entries(patterns).map(([k, v]) => (
          <button key={k}
            onClick={() => setPattern(k)}
            className="chip"
            style={{
              cursor: "pointer", padding: "5px 12px",
              background: pattern === k ? "var(--accent-soft)" : "var(--bg-input)",
              borderColor: pattern === k ? "var(--accent)" : "var(--line)",
              color: pattern === k ? "var(--accent)" : "var(--text-dim)",
              fontWeight: pattern === k ? 600 : 400,
            }}>{v.label}</button>
        ))}
      </div>

      <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "20px 16px" }}>
        <svg viewBox="0 0 1000 620" style={{ width: "100%", height: "auto", display: "block" }}>
          <defs>
            <marker id="bm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="var(--text-dim)" />
            </marker>
            <marker id="bm-arrow-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="#ff5d6c" />
            </marker>
          </defs>

          {/* === ROW 1: HW path === */}
          <text x="20" y="40" fill="var(--text-mute)" fontSize="10" fontFamily="var(--mono)" letterSpacing="2">
            HARDWARE  ·  資料路徑
          </text>

          {/* connecting bus line */}
          <line x1="100" y1="110" x2="940" y2="110" stroke="var(--line)" strokeWidth="2" strokeDasharray="2 4" />

          {hw.map((c, i) => (
            <g key={c.id}>
              <rect x={c.x - 50} y={70} width={100} height={80}
                fill={c.color + "1a"} stroke={c.color} strokeWidth="1.5" rx="6" />
              <text x={c.x} y={95} textAnchor="middle" fill={c.color} fontSize="13" fontWeight="700" fontFamily="var(--display)">{c.name}</text>
              <text x={c.x} y={112} textAnchor="middle" fill="var(--text-dim)" fontSize="9">{c.sub}</text>
              <text x={c.x} y={138} textAnchor="middle" fill="var(--text)" fontSize="11" fontFamily="var(--mono)" fontWeight="600">
                {c.lat === 0 ? "~0" : `~${c.lat}`} cyc
              </text>
              {/* latency bar */}
              <rect x={c.x - 35} y={146} width={70} height={3} fill="var(--bg-input)" rx="1.5" />
              <rect x={c.x - 35} y={146}
                width={Math.min(70, Math.log2(c.lat + 2) * 9)} height={3}
                fill={c.color} rx="1.5" />
            </g>
          ))}

          {/* moving access dot */}
          <circle cx={dot.x} cy={dot.y} r="6" fill={dot.hot ? "#ff5d6c" : "#fff"}
            opacity="0.95">
            <animate attributeName="r" values="6;8;6" dur="0.7s" repeatCount="indefinite" />
          </circle>
          <circle cx={dot.x} cy={dot.y} r="14" fill={dot.hot ? "#ff5d6c" : "#fff"} opacity="0.18" />

          {/* === ROW 2: PMU probes === */}
          <text x="20" y="200" fill="var(--text-mute)" fontSize="10" fontFamily="var(--mono)" letterSpacing="2">
            PMU  ·  硬體計數器探針 (固定在各層上)
          </text>

          {/* probe lines from each HW component down to its counter */}
          {counters.map((c, i) => {
            const tap = hw.find(h => h.id === c.taps);
            const cy = 280;
            const cx = 80 + i * 150;
            const isTicking = tickingCounter === c.id;
            const isHl = highlight === c.id;
            return (
              <g key={c.id}
                onMouseEnter={() => setHighlight(c.id)}
                onMouseLeave={() => setHighlight(null)}
                style={{ cursor: "pointer" }}>
                {/* probe wire */}
                <path d={`M ${tap.x} 150 L ${tap.x} 200 L ${cx} 235 L ${cx} ${cy - 30}`}
                  stroke={isTicking ? "#ff5d6c" : (isHl ? "var(--accent)" : "var(--line)")}
                  strokeWidth={isTicking ? "2" : "1"}
                  fill="none"
                  opacity={isHl || isTicking ? 1 : 0.5} />
                {/* counter pill */}
                <rect x={cx - 65} y={cy - 30} width="130" height="56"
                  fill={isTicking ? "rgba(255,93,108,.15)" : "var(--bg-card)"}
                  stroke={isTicking ? "#ff5d6c" : (isHl ? "var(--accent)" : "var(--line)")}
                  strokeWidth={isTicking ? "1.5" : "1"} rx="5" />
                <text x={cx} y={cy - 13} textAnchor="middle" fill="var(--text-dim)" fontSize="9.5" fontFamily="var(--mono)">{c.name}</text>
                <text x={cx} y={cy + 8} textAnchor="middle"
                  fill={isTicking ? "#ff5d6c" : "var(--text)"}
                  fontSize="16" fontFamily="var(--mono)" fontWeight="700">
                  {c.count + (isTicking ? Math.floor(t / 4) : 0)}
                </text>
                <text x={cx} y={cy + 21} textAnchor="middle" fill="var(--text-mute)" fontSize="8">
                  taps {c.taps.toUpperCase()}
                </text>
                {/* ticking indicator */}
                {isTicking && (
                  <circle cx={cx + 55} cy={cy - 22} r="3" fill="#ff5d6c">
                    <animate attributeName="opacity" values="1;0.2;1" dur="0.4s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}

          {/* === ROW 3: overflow → NMI === */}
          <text x="20" y="370" fill="var(--text-mute)" fontSize="10" fontFamily="var(--mono)" letterSpacing="2">
            INTERRUPT PATH  ·  溢位 → NMI → KERNEL → USER
          </text>

          {/* From PMU row down to overflow box */}
          <path d="M 500 326 L 500 395" stroke={fired ? "#ff5d6c" : "var(--line)"} strokeWidth="1.5" markerEnd="url(#bm-arrow-hot)" strokeDasharray="3 3" />
          <text x="510" y="365" fill="var(--text-dim)" fontSize="9" fontFamily="var(--mono)">overflow</text>

          {/* Chain boxes */}
          {[
            { x: 80,  label: "PMU OVERFLOW",   sub: "counter 觸頂",  side: "HW",     color: "#ff5d6c" },
            { x: 270, label: "NMI",             sub: "~10–60 cyc skid", side: "HW→Kernel", color: "#ffb627" },
            { x: 460, label: "IRQ handler",    sub: "perf_events.c", side: "Kernel", color: "#b794f6" },
            { x: 650, label: "Ring buffer",    sub: "mmap'd, lockless", side: "Kernel↔User", color: "#4dd2ff" },
            { x: 840, label: "perf record",    sub: "user-space tool", side: "User",   color: "#6ee7a4" },
          ].map((s, i, arr) => (
            <g key={i}>
              <rect x={s.x - 75} y={400} width="150" height="60"
                fill={fired ? s.color + "20" : "var(--bg-card)"}
                stroke={fired ? s.color : "var(--line)"}
                strokeWidth={fired ? "1.5" : "1"} rx="5" />
              <text x={s.x} y={419} textAnchor="middle" fill={s.color} fontSize="9" fontFamily="var(--mono)" letterSpacing="1.2">{s.side}</text>
              <text x={s.x} y={436} textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="600">{s.label}</text>
              <text x={s.x} y={451} textAnchor="middle" fill="var(--text-dim)" fontSize="9.5" fontFamily="var(--mono)">{s.sub}</text>
              {i < arr.length - 1 && (
                <line x1={s.x + 75} y1={430} x2={arr[i+1].x - 75} y2={430}
                  stroke={fired ? "#ff5d6c" : "var(--line)"} strokeWidth={fired ? "1.5" : "1"}
                  markerEnd={fired ? "url(#bm-arrow-hot)" : "url(#bm-arrow)"} />
              )}
            </g>
          ))}

          {/* travelling sample dot through chain */}
          {fired && (() => {
            const points = [80, 270, 460, 650, 840];
            const seg = Math.min(Math.floor(overflowPhase * 4), 3);
            const local = (overflowPhase * 4) % 1;
            const px = points[seg] + (points[seg + 1] - points[seg]) * local;
            return <circle cx={px} cy={430} r="5" fill="#fff">
              <animate attributeName="opacity" values="0.6;1;0.6" dur="0.4s" repeatCount="indefinite" />
            </circle>;
          })()}

          {/* === ROW 4: HW/Kernel/User boundary === */}
          <line x1="20" y1="495" x2="980" y2="495" stroke="var(--line-soft)" strokeWidth="1" strokeDasharray="2 6" />
          <text x="20" y="513" fill="var(--text-mute)" fontSize="10" fontFamily="var(--mono)" letterSpacing="2">USER SPACE</text>

          {/* Output */}
          <rect x="80" y="525" width="840" height="76" fill="var(--bg-card)" stroke="var(--line)" rx="5" />
          <text x="100" y="548" fill="var(--text-dim)" fontSize="10" fontFamily="var(--mono)">$ perf report --hierarchy</text>
          <text x="100" y="568" fill="var(--text)" fontSize="11" fontFamily="var(--mono)">
            <tspan fill="#ff5d6c">38.2%</tspan>  matmul_v1   <tspan fill="var(--text-mute)">[heavy LLC-load-misses → DRAM hot]</tspan>
          </text>
          <text x="100" y="585" fill="var(--text)" fontSize="11" fontFamily="var(--mono)">
            <tspan fill="#ffb627">14.7%</tspan>  page_walk   <tspan fill="var(--text-mute)">[dTLB-misses → MMU 走頁表]</tspan>
          </text>

          {/* boundary annotations on the right */}
          <g fontFamily="var(--mono)" fontSize="9" fill="var(--text-mute)">
            <text x="965" y="100" textAnchor="end">silicon</text>
            <text x="965" y="280" textAnchor="end">MSR</text>
            <text x="965" y="430" textAnchor="end">syscall ABI</text>
            <text x="965" y="565" textAnchor="end">tty</text>
          </g>
        </svg>
      </div>

      {/* Legend / explanation grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 18 }}>
        <div style={{ padding: 12, background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#ff5d6c", letterSpacing: 1.5, marginBottom: 6 }}>瓶頸點 1</div>
          <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>TLB miss → page walk</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
            虛實位址翻譯失敗，MMU 必須走頁表（可能要 4 次記憶體存取）。看 <code>dTLB-load-misses</code>。
          </div>
        </div>
        <div style={{ padding: 12, background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#ffb627", letterSpacing: 1.5, marginBottom: 6 }}>瓶頸點 2</div>
          <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>L1/L2 miss → 慢 3–10×</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
            存取模式不友善 cache。看 <code>L1-dcache-load-misses</code>，搭 row-major / blocking 修。
          </div>
        </div>
        <div style={{ padding: 12, background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#ff5d6c", letterSpacing: 1.5, marginBottom: 6 }}>瓶頸點 3</div>
          <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>LLC miss → 打 DRAM</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
            晶片外延遲 ~200 cycle，是 L1 的 50 倍。看 <code>LLC-load-misses</code>，記憶體頻寬將成主因。
          </div>
        </div>
      </div>

      <Annot show={showAnnotations}>
        這張圖把兩件事疊在一起：(1) 為什麼會慢 — 越下層的記憶體越遠，延遲指數成長；
        (2) 怎麼觀察到慢 — 每一層都有對應的 PMU 計數器，計數溢位後會走「NMI → kernel IRQ handler → perf_events → ring buffer → user space」這條測量鏈。
        切換上方的存取樣式可以看到不同瓶頸如何讓不同的計數器點亮。NMI 是 non-maskable，所以即使 kernel 關了一般中斷仍會觸發 — 這正是 perf 能 profile kernel code 的關鍵。
      </Annot>
    </Card>
  );
}

window.BottleneckMap = BottleneckMap;
