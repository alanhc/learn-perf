// HW → Kernel → User → Visualization stack flow animation
// Shows event particles bubbling up from CPU silicon through layers to flame graph
function StackFlow({ animSpeed = 1, showAnnotations = true }) {
  const tick = useTick(20, true, animSpeed);

  // Layer definition (top → bottom rendering, but we draw bottom-first conceptually)
  const layers = [
    { id: "hw", label: "HARDWARE", sub: "CPU · PMU · Counters", color: "#ff5d6c", icon: "▦",
      detail: ["cycles", "instructions", "cache-misses", "branch-misses", "LLC-loads"] },
    { id: "kernel", label: "KERNEL", sub: "perf_event subsystem", color: "#ffb627", icon: "◆",
      detail: ["perf_event_open()", "PMU driver", "ring buffer", "sample IRQ"] },
    { id: "user", label: "USER SPACE", sub: "perf CLI · libraries", color: "#4dd2ff", icon: "▣",
      detail: ["perf record", "perf.data", "addr2sym", "stack unwind"] },
    { id: "viz", label: "VISUALIZATION", sub: "你眼前看到的東西", color: "#6ee7a4", icon: "◉",
      detail: ["call graph", "flame graph", "annotation", "histogram"] },
  ];

  // Particle system: event particles spawn at HW and flow upward through layers.
  const NUM_PARTICLES = 14;
  const PERIOD = 100; // tick frames for one full ascent
  const particles = useMemo(() => {
    return Array.from({ length: NUM_PARTICLES }).map((_, i) => {
      const offset = (i * (PERIOD / NUM_PARTICLES));
      const lane = (i * 7) % 9; // 9 lanes
      const variant = i % 5;
      return { offset, lane, variant };
    });
  }, []);

  // For each particle, where is it now along 0..1 (0 = bottom HW, 1 = top viz)?
  function particlePos(p) {
    const phase = ((tick + p.offset) % PERIOD) / PERIOD;
    return phase;
  }
  // What layer is it in? phase splits into 4 segments
  function particleLayer(phase) {
    return Math.floor(phase * 4);
  }

  // Draw an SVG with 4 horizontal layers stacked top→bottom (viz → user → kernel → hw)
  const W = 1000;
  const layerH = 90;
  const H = layerH * 4 + 20;

  return (
    <Card title="Hardware → Software 全景" style={{ overflow: "hidden" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Layers (from bottom up: HW=last index). We render in reverse so HW is at bottom of svg */}
        {layers.slice().reverse().map((layer, vi) => {
          const realIdx = layers.length - 1 - vi;
          const y = vi * layerH + 10;
          return (
            <g key={layer.id}>
              {/* layer band */}
              <rect x={20} y={y} width={W - 40} height={layerH - 8}
                fill={`${layer.color}10`}
                stroke={`${layer.color}40`}
                strokeDasharray="4 4"
                rx={8}
              />
              {/* layer label box (left) */}
              <rect x={28} y={y + 8} width={180} height={layerH - 24} fill={layer.color} rx={4} opacity={0.95} />
              <text x={42} y={y + 32} fill="#0a0a0c" fontFamily="var(--mono)" fontSize="11" fontWeight="700" letterSpacing="2">{layer.label}</text>
              <text x={42} y={y + 50} fill="#0a0a0c" fontFamily="var(--mono)" fontSize="10" opacity={0.75}>{layer.sub}</text>
              <text x={186} y={y + 56} fill="#0a0a0c" fontSize="28" textAnchor="end" opacity={0.8}>{layer.icon}</text>

              {/* detail chips */}
              {layer.detail.map((d, di) => (
                <g key={di} transform={`translate(${230 + di * 130} ${y + 28})`}>
                  <rect x={0} y={0} width={120} height={28}
                    fill="var(--bg-input)"
                    stroke={layer.color}
                    strokeOpacity={0.4}
                    rx={4}
                  />
                  <text x={60} y={18} fill="var(--text-dim)" fontFamily="var(--mono)" fontSize="11" textAnchor="middle">{d}</text>
                </g>
              ))}
            </g>
          );
        })}

        {/* Connection arrows between layers */}
        {[0, 1, 2].map(i => {
          // arrow goes from bottom of layer (i+1 in display order = layers[2-i]?) — easier: between display rows
          const fromY = (i + 1) * layerH + 10;     // bottom of upper layer
          const toY = (i + 1) * layerH + 10 + 4;
          return (
            <g key={i}>
              {[300, 500, 700].map(x => (
                <path key={x}
                  d={`M ${x} ${fromY - layerH + 8 + (layerH - 16)} L ${x} ${fromY + 2}`}
                  stroke="var(--text-mute)"
                  strokeOpacity={0.35}
                  strokeDasharray="2 3"
                  strokeWidth={1}
                />
              ))}
            </g>
          );
        })}

        {/* Particles flowing upward */}
        {particles.map((p, i) => {
          const phase = particlePos(p);
          // svg Y: phase 0 → bottom (HW band), phase 1 → top (viz band)
          // bottom of svg = H - some padding
          const startY = 3 * layerH + layerH / 2 + 10;  // HW center
          const endY = layerH / 2 + 10;                 // viz center
          const y = startY + (endY - startY) * easeInOut(phase);
          const x = 220 + p.lane * 78;
          const opacity = phase < 0.05 ? phase / 0.05 : phase > 0.95 ? (1 - phase) / 0.05 : 1;
          const layerIdx = particleLayer(phase);
          const color = layers[3 - layerIdx]?.color ?? "#fff";  // color shifts as it ascends
          return (
            <g key={i} opacity={opacity}>
              <circle cx={x} cy={y} r={5} fill={color} />
              <circle cx={x} cy={y} r={9} fill={color} opacity={0.25} />
              {/* trail */}
              <line x1={x} y1={y + 8} x2={x} y2={y + 22}
                stroke={color} strokeWidth={2} strokeOpacity={0.4} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      <div style={{ display: "flex", gap: 18, marginTop: 18, flexWrap: "wrap", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.7 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ color: "var(--hot)" }}>① CPU 觸發事件</strong> — PMU 內建的硬體計數器在每次 cycle / cache-miss 等事件遞減；歸零時送出中斷。
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ color: "var(--accent)" }}>② Kernel 取樣</strong> — perf_event 子系統處理中斷，記下當下的 IP、暫存器、stack pointer，寫入 ring buffer。
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ color: "var(--cool)" }}>③ User 程式讀取</strong> — perf record 把 ring buffer dump 到 perf.data，事後 perf report / perf script 才把 IP 翻譯成函式名稱。
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ color: "var(--good)" }}>④ 視覺化</strong> — Call Graph / Flame Graph / Annotation 把幾百萬筆樣本壓縮成人腦可消化的圖。
        </div>
      </div>

      <Annot show={showAnnotations}>
        紅 → 黃 → 藍 → 綠 的色帶代表「事件越往上走，抽象層次越高」。本儀表板章節 02、03 講最底下兩層，05 是中間 user 工具，07–08 講最上面的視覺化。
      </Annot>
    </Card>
  );
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t); }

window.StackFlow = StackFlow;
