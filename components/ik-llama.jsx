// Section 09 — Real-world case study: ik_llama (BitNet quantized LLM inference)
// Visualizes perf stat output, hotspot table, and threading scaling story
// Source: hackmd.io/B8ksksFvREG9RjBHPv05kQ

const IK_LLAMA_RUNS = {
  default: {
    label: "預設執行",
    cmd: "./llama-cli ... --temp 0",
    elapsed: "—",
    cpuAtomCycles: 8.26e9,
    cpuCoreCycles: 53.8e9,
    atomShare: 0.27,
    coreShare: 99.73,
    ipcAtom: "—",
    ipcCore: "—",
    cacheRefAtom: 373e6,
    cacheRefCore: 532e6,
    cacheMissAtom: 75.85,
    cacheMissCore: 81.84,
    threads: "default",
  },
  t1: {
    label: "單執行緒 (-t 1)",
    cmd: "./llama-cli ... -t 1",
    elapsed: 2.146,
    cpuAtomCycles: 1.628e9,
    cpuCoreCycles: 11.30e9,
    atomShare: 12.6,
    coreShare: 87.4,
    ipcAtom: 1.02,
    ipcCore: 2.17,
    minorFaults: 107439,
    majorFaults: 0,
    dTLBMissPctAtom: 0.15,
    dTLBMissPctCore: 0.02,
    cacheRefAtom: 10.6e6,
    cacheRefCore: 467.9e6,
    cacheMissAtom: 35.06,
    cacheMissCore: 84.06,
    user: 2.006,
    sys: 0.139,
  },
  t8: {
    label: "8 執行緒 (-t 8)",
    cmd: "./llama-cli ... -t 8",
    elapsed: 1.163,
    cpuAtomCycles: 11.53e9,
    cpuCoreCycles: 29.78e9,
    atomShare: 27.9,
    coreShare: 72.1,
    ipcAtom: 0.84,
    ipcCore: 0.79,
    minorFaults: 107767,
    majorFaults: 0,
    dTLBMissPctAtom: 0.01,
    dTLBMissPctCore: 0.07,
    cacheRefAtom: 218.3e6,
    cacheRefCore: 463.0e6,
    cacheMissAtom: 83.63,
    cacheMissCore: 85.06,
    user: 6.080,
    sys: 0.145,
  },
};

const IK_LLAMA_HOTSPOTS = [
  { rank: 1, pct: 84.09, fn: "ggml_compute_forward_mul_mat", mod: "libggml.so", layer: "user", kind: "matmul",
    note: "LLM 中所有矩陣運算的核心 — transformer linear / attention / MLP" },
  { rank: 2, pct: 81.24, fn: "iqk_mul_mat_4d", mod: "libggml.so", layer: "user", kind: "matmul",
    note: "4D 矩陣乘法拆解為 SIMD-friendly 區塊，量化模型專用" },
  { rank: 3, pct: 81.17, fn: "iqk_mul_mat", mod: "libggml.so", layer: "user", kind: "matmul",
    note: "*_4d 的實作主體，dot product 計算" },
  { rank: 4, pct: 51.82, fn: "mul_mat_iq2bn_q8_K64<1>", mod: "libggml.so", layer: "user", kind: "matmul",
    note: "8-bit block quantized matmul 核心 kernel" },
  { rank: 5, pct: 27.41, fn: "mul_mat_qY_K_q8_K_T<DequantizerQ6K>", mod: "libggml.so", layer: "user", kind: "matmul",
    note: "Q6_K 量化格式 + 反量化邏輯" },
  { rank: 6, pct: 7.28,  fn: "entry_SYSCALL_64_after_hwframe", mod: "kernel", layer: "kernel", kind: "syscall",
    note: "syscall 進入點" },
  { rank: 7, pct: 7.28,  fn: "do_syscall_64", mod: "kernel", layer: "kernel", kind: "syscall",
    note: "syscall 分派" },
  { rank: 8, pct: 6.73,  fn: "x64_sys_futex", mod: "kernel", layer: "kernel", kind: "lock",
    note: "futex 鎖操作 — 多執行緒等待" },
  { rank: 9, pct: 5.88,  fn: "do_futex", mod: "kernel", layer: "kernel", kind: "lock",
    note: "futex 核心處理" },
  { rank: 10, pct: 5.77, fn: "libgomp.so+0x...", mod: "libgomp.so", layer: "user", kind: "lock",
    note: "OpenMP 執行緒管理" },
  { rank: 11, pct: 5.16, fn: "ggml_graph_compute_thread", mod: "libggml.so", layer: "user", kind: "compute",
    note: "thread pool 執行 graph node" },
  { rank: 12, pct: 4.91, fn: "futex_wait", mod: "kernel", layer: "kernel", kind: "lock", note: "futex wait queue" },
  { rank: 15, pct: 2.93, fn: "schedule", mod: "kernel", layer: "kernel", kind: "lock", note: "Linux context switch" },
  { rank: 17, pct: 2.08, fn: "__memset_avx2_unaligned_erms", mod: "libc.so.6", layer: "user", kind: "compute", note: "記憶體清空" },
];

const KIND_COLORS = {
  matmul:  "#ff5d6c",   // hot — the actual computation
  lock:    "#ffb627",   // warm — synchronization
  syscall: "#b794f6",   // violet — kernel boundary
  compute: "#4dd2ff",   // cool — supporting compute
};

function IkLlamaSection({ animSpeed = 1, showAnnotations = true }) {
  const [run, setRun] = useState("t1");
  const [stage, setStage] = useState("openmp"); // openmp | nogomp
  const r = IK_LLAMA_RUNS[run];

  return (
    <Section id="ik-llama" label="ik_llama Case" num="09"
      eyebrow="REAL CASE · ik_llama"
      title="實驗筆記：BitNet 量化 LLM 推論分析"
      lede="把前面所有概念套用到一個真實負載 — 用 ik_llama.cpp 跑 BitNet (i2_s_bn) 量化模型推論，看 perf 怎麼指出瓶頸、threading 如何反過來拖慢效能、以及最終為什麼 matmul kernel 還是大魔王。"
    >
      {/* Experimental setup */}
      <Card title="實驗設定" style={{ marginBottom: 24 }}>
        <div className="grid-3">
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>受測程式</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)" }}>ik_llama.cpp</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>BitNet 量化模型推論引擎</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>模型量化</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)" }}>iq2_bn (2-bit BitNet)</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>每權重平均 ≈ 2 bit</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Prompt</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)" }}>"Once upon a time"</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>32 tokens, temp=0</div>
          </div>
        </div>
      </Card>

      {/* Run selector + perf stat dashboard */}
      <Card title="perf stat — 三組執行對比">
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {Object.keys(IK_LLAMA_RUNS).map(k => (
            <button key={k} className={clsx("btn", run === k && "primary")} onClick={() => setRun(k)}>
              {IK_LLAMA_RUNS[k].label}
            </button>
          ))}
        </div>

        <div style={{ background: "var(--bg-input)", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)" }}>
          <span style={{ color: "var(--good)" }}>$ </span>
          <span style={{ color: "var(--text)" }}>sudo perf stat -e cycles,instructions,cache-misses,...</span><br />
          <span style={{ paddingLeft: 14 }}>{r.cmd}</span>
        </div>

        {/* Big stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          <BigStat label="總執行時間" value={typeof r.elapsed === "number" ? `${r.elapsed.toFixed(2)}s` : "—"} accent="warm" />
          <BigStat label="P-core IPC" value={r.ipcCore ?? "—"}
            accent={typeof r.ipcCore === "number" && r.ipcCore > 1.5 ? "good" : "hot"}
            sub={typeof r.ipcCore === "number" && r.ipcCore > 1.5 ? "良好" : "偏低"}
          />
          <BigStat label="P-core cache miss" value={`${r.cacheMissCore}%`} accent="hot" sub="超過 75% — 瓶頸" />
          <BigStat label="major-faults" value={typeof r.majorFaults === "number" ? r.majorFaults : "—"} accent="good" sub="無 disk IO" />
        </div>

        {/* P-core vs E-core split */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>
            CPU 負載分佈：P-core (Performance) vs E-core (Atom/Efficiency)
          </div>
          <CoreSplitBar coreShare={r.coreShare} atomShare={r.atomShare} ipcCore={r.ipcCore} ipcAtom={r.ipcAtom} />
          <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 8, lineHeight: 1.6 }}>
            {run === "t1" && "─t 1 把推論鎖在單核 → 排程器自然挑 P-core，IPC 衝到 2.17（指令級平行壓榨 superscalar / OoO 的成果）。"}
            {run === "t8" && "─t 8 反而讓 IPC 跌到 0.79，原因看下方 cache miss 與 futex 等待 — 多執行緒 cache 互踩 + 同步 overhead 抵銷了平行化收益。"}
            {run === "default" && "預設 thread 設定下，90% cycles 在 P-core，但 cache miss 仍 ~80% — 計算密度被記憶體頻寬綁死。"}
          </div>
        </div>

        {/* Cache miss rate visual */}
        <CacheMissDial atom={r.cacheMissAtom} core={r.cacheMissCore} />

        <Annot show={showAnnotations}>
          注意 −t 1 跟 −t 8 的 elapsed 差異只有 1.85 倍，但 user time 從 2 秒漲到 6 秒 — 多核給的並非自由午餐。
          這在 perf stat 的數字上體現為 IPC 從 2.17 跌到 0.79，原因下面會看到：分散到多核之後，每核的 cache miss 都更慘，barrier 同步也吃掉時間。
        </Annot>
      </Card>

      <div style={{ height: 24 }} />

      {/* Threading scaling story */}
      <Card title="Threading Scaling — 並非線性">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <ThreadingScalingChart />
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 12 }}>
              為什麼 8 執行緒沒有 8 倍快？
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.8 }}>
              <li><strong style={{ color: "var(--hot)" }}>Cache miss 互踩</strong> — 多核共用 LLC，工作集塞不下時相互 evict</li>
              <li><strong style={{ color: "var(--accent)" }}>OpenMP barrier spin</strong> — 每個 matmul tile 結束都要 sync</li>
              <li><strong style={{ color: "var(--violet)" }}>Futex / context switch</strong> — 7.28% syscall + 6.73% futex</li>
              <li><strong style={{ color: "var(--cool)" }}>記憶體頻寬天花板</strong> — DRAM bus 不會因為加 thread 就變快</li>
            </ul>
            <div style={{ background: "var(--bg-input)", padding: 14, borderRadius: 8, marginTop: 16, borderLeft: "3px solid var(--good)" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--good)", marginBottom: 4 }}>關鍵觀察</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
                ─t 1 每核 IPC = 2.17 ＞ ─t 8 每核 IPC = 0.79。
                並行化反而讓單核「閒置等待」時間變長 — 這就是為什麼 perf record 之後要看火焰圖找出 spin / barrier 的成本。
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ height: 24 }} />

      {/* Hotspot ladder */}
      <Card title="perf report — 函式熱點 Top 14">
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
          每一條代表一個函式的 children% (含被它呼叫的後代)。
          顏色分類顯示瓶頸的本質 — 紅色是真正的數學運算、橘色是同步等待、紫色是 syscall 邊界。
        </p>
        <HotspotLadder data={IK_LLAMA_HOTSPOTS} />

        <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)" }}>
          {Object.entries(KIND_COLORS).map(([k, c]) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, background: c, borderRadius: 2 }} />
              {{ matmul: "矩陣運算 (真核心)", lock: "同步等待", syscall: "syscall 邊界", compute: "輔助計算" }[k]}
            </span>
          ))}
        </div>

        <Annot show={showAnnotations}>
          前 5 名全是 matmul 變體，加總 &gt; 80% — 想優化推論必須從 matmul kernel 下手。
          但 6–9 名的 syscall + futex 也吃了 ~26% — 這是 OpenMP 給的「稅」，下面我們會看關掉它後會發生什麼。
        </Annot>
      </Card>

      <div style={{ height: 24 }} />

      {/* OpenMP off experiment */}
      <Card title="關掉 OpenMP 之後的故事">
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          <button className={clsx("btn", stage === "openmp" && "primary")} onClick={() => setStage("openmp")}>有 OpenMP</button>
          <button className={clsx("btn", stage === "nogomp" && "primary")} onClick={() => setStage("nogomp")}>關掉 OpenMP</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-mute)", marginBottom: 8 }}>
              {stage === "openmp" ? "perf record (預設 build)" : "perf record (LLAMA_OPENMP=OFF)"}
            </div>
            <BarPair stage={stage} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 8 }}>
              {stage === "openmp" ? "原本看起來..." : "關掉 OpenMP 後，真相浮現"}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
              {stage === "openmp"
                ? "matmul 函式吃掉 81% — 看起來只要優化 matmul 就好。但 5.77% 的 libgomp + 6.73% 的 futex 暗示同步成本被均勻分散了。"
                : <>
                    把 OpenMP 抽掉後 <code>ggml_barrier</code> 直接跳到 <strong style={{ color: "var(--hot)" }}>34.6%</strong> —
                    這是 ggml 自己的 spin barrier，原本 OpenMP barrier 把它擋住了。
                    換句話說，<em>更動編譯選項會讓 perf 看到的世界完全不同</em>。
                  </>
              }
            </p>
            <div style={{ background: "var(--bg-input)", padding: 12, borderRadius: 8, marginTop: 12, fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
              <span style={{ color: "var(--text-mute)" }}># 重新編譯</span><br />
              cmake -B build \<br />
              &nbsp;&nbsp;-DLLAMA_OPENMP=<span style={{ color: stage === "nogomp" ? "var(--hot)" : "var(--good)" }}>{stage === "nogomp" ? "OFF" : "ON"}</span> \<br />
              &nbsp;&nbsp;-DGGML_OPENMP=<span style={{ color: stage === "nogomp" ? "var(--hot)" : "var(--good)" }}>{stage === "nogomp" ? "OFF" : "ON"}</span>
            </div>
          </div>
        </div>

        <Annot show={showAnnotations}>
          這是一個很重要的「觀察者效應」：你以為自己在量 A，但測量本身把 B 隱藏起來了。Always 切換 build flag 重新測一次。
        </Annot>
      </Card>
    </Section>
  );
}

// ───────── helpers ─────────

function BigStat({ label, value, accent = "warm", sub }) {
  return (
    <div style={{ background: "var(--bg-input)", padding: 16, borderRadius: 8, borderTop: `2px solid var(--${accent === "hot" ? "hot" : accent === "good" ? "good" : "accent"})` }}>
      <div className={clsx("stat-num", accent)} style={{ fontSize: 26, fontFamily: "var(--mono)", fontWeight: 700, lineHeight: 1, color: accent === "hot" ? "var(--hot)" : accent === "good" ? "var(--good)" : "var(--accent)" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--sans)" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function CoreSplitBar({ coreShare, atomShare, ipcCore, ipcAtom }) {
  const cs = typeof coreShare === "number" ? coreShare : 0;
  const as = typeof atomShare === "number" ? atomShare : 0;
  return (
    <div>
      <div style={{ display: "flex", height: 56, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
        <div style={{ width: `${cs}%`, background: "linear-gradient(135deg, #ff5d6c, #ffb627)", display: "flex", alignItems: "center", paddingLeft: 16, gap: 12, color: "#0a0a0c", fontFamily: "var(--mono)", fontWeight: 700, transition: "width .4s" }}>
          <span style={{ fontSize: 18 }}>P-core</span>
          <span style={{ opacity: 0.7, fontSize: 13 }}>{cs.toFixed(1)}%</span>
          {typeof ipcCore === "number" && <span style={{ marginLeft: "auto", marginRight: 14, fontSize: 13, opacity: 0.85 }}>IPC {ipcCore}</span>}
        </div>
        <div style={{ width: `${as}%`, background: "var(--bg-input)", display: "flex", alignItems: "center", paddingLeft: 16, gap: 12, color: "var(--text-dim)", fontFamily: "var(--mono)", fontWeight: 600, transition: "width .4s" }}>
          <span style={{ fontSize: 14 }}>E-core</span>
          <span style={{ fontSize: 12 }}>{as.toFixed(1)}%</span>
          {typeof ipcAtom === "number" && <span style={{ marginLeft: "auto", marginRight: 12, fontSize: 12 }}>IPC {ipcAtom}</span>}
        </div>
      </div>
    </div>
  );
}

function CacheMissDial({ atom, core }) {
  return (
    <div style={{ background: "var(--bg-input)", padding: 18, borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "var(--text)" }}>
        Cache Miss Rate — DRAM 頻寬瓶頸指標
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <DialGauge value={core} label="P-core" />
        <DialGauge value={atom} label="E-core" />
        <div style={{ flex: 1, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
          <strong style={{ color: "var(--hot)" }}>{core}%</strong> 的 cache 存取直接打到 DRAM。
          量化模型雖然小，但 KV cache + activation buffers 仍超過 LLC，
          每次 matmul 內層迴圈都在等記憶體 — 這就是 IPC 偏低的物理解釋。
        </div>
      </div>
    </div>
  );
}

function DialGauge({ value, label }) {
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - value / 100);
  const color = value > 75 ? "var(--hot)" : value > 50 ? "var(--accent)" : "var(--good)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={radius} fill="none" stroke="var(--line)" strokeWidth={6} />
        <circle cx={48} cy={48} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 48 48)" strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .5s" }}
        />
        <text x={48} y={50} textAnchor="middle" fontFamily="var(--mono)" fontSize="18" fontWeight="700" fill={color}>{value}%</text>
        <text x={48} y={66} textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--text-mute)">miss</text>
      </svg>
      <div style={{ fontSize: 11, color: "var(--text-mute)", fontFamily: "var(--mono)", marginTop: -4 }}>{label}</div>
    </div>
  );
}

function ThreadingScalingChart() {
  // x = threads, y1 = elapsed time, y2 = IPC. Two parallel y axes
  const points = [
    { t: 1, elapsed: 2.146, ipc: 2.17, user: 2.006 },
    { t: 8, elapsed: 1.163, ipc: 0.79, user: 6.080 },
  ];
  const W = 360, H = 200;
  const pad = { l: 36, r: 36, t: 14, b: 32 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxElapsed = 2.5, maxIpc = 2.5;
  const xFor = (t) => pad.l + (t === 1 ? 0 : 1) * innerW;
  const yElapsed = (e) => pad.t + (1 - e / maxElapsed) * innerH;
  const yIpc = (i) => pad.t + (1 - i / maxIpc) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 420, height: "auto" }}>
      {/* axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="var(--line)" />
      <line x1={W - pad.r} y1={pad.t} x2={W - pad.r} y2={H - pad.b} stroke="var(--line)" />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--line)" />
      {/* grid */}
      {[0.5, 1, 1.5, 2, 2.5].map(v => (
        <g key={v}>
          <line x1={pad.l} y1={yElapsed(v)} x2={W - pad.r} y2={yElapsed(v)} stroke="var(--line-soft)" strokeDasharray="2 3" />
          <text x={pad.l - 6} y={yElapsed(v) + 3} fontFamily="var(--mono)" fontSize="9" fill="var(--text-mute)" textAnchor="end">{v}s</text>
          <text x={W - pad.r + 6} y={yIpc(v) + 3} fontFamily="var(--mono)" fontSize="9" fill="var(--text-mute)">{v}</text>
        </g>
      ))}
      {/* x labels */}
      {points.map(p => (
        <text key={p.t} x={xFor(p.t)} y={H - 12} fontFamily="var(--mono)" fontSize="10" fill="var(--text-dim)" textAnchor="middle">{p.t} thread{p.t > 1 ? "s" : ""}</text>
      ))}
      {/* lines */}
      <line x1={xFor(1)} y1={yElapsed(points[0].elapsed)} x2={xFor(8)} y2={yElapsed(points[1].elapsed)} stroke="var(--accent)" strokeWidth={2} />
      <line x1={xFor(1)} y1={yIpc(points[0].ipc)} x2={xFor(8)} y2={yIpc(points[1].ipc)} stroke="var(--hot)" strokeWidth={2} strokeDasharray="4 3" />
      {/* points */}
      {points.map(p => (
        <g key={p.t}>
          <circle cx={xFor(p.t)} cy={yElapsed(p.elapsed)} r={5} fill="var(--accent)" />
          <text x={xFor(p.t)} y={yElapsed(p.elapsed) - 10} fontFamily="var(--mono)" fontSize="10" fill="var(--accent)" textAnchor="middle">{p.elapsed}s</text>
          <circle cx={xFor(p.t)} cy={yIpc(p.ipc)} r={5} fill="var(--hot)" />
          <text x={xFor(p.t)} y={yIpc(p.ipc) - 10} fontFamily="var(--mono)" fontSize="10" fill="var(--hot)" textAnchor="middle">IPC {p.ipc}</text>
        </g>
      ))}
      {/* legend */}
      <g transform="translate(46, 14)">
        <line x1={0} y1={0} x2={14} y2={0} stroke="var(--accent)" strokeWidth={2} />
        <text x={18} y={3} fontFamily="var(--mono)" fontSize="10" fill="var(--accent)">elapsed</text>
        <line x1={68} y1={0} x2={82} y2={0} stroke="var(--hot)" strokeWidth={2} strokeDasharray="3 2" />
        <text x={86} y={3} fontFamily="var(--mono)" fontSize="10" fill="var(--hot)">IPC</text>
      </g>
    </svg>
  );
}

function HotspotLadder({ data }) {
  const max = Math.max(...data.map(d => d.pct));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {data.map(d => {
        const pctW = (d.pct / max) * 100;
        const color = KIND_COLORS[d.kind];
        return (
          <div key={d.rank} style={{ display: "grid", gridTemplateColumns: "30px 60px 1fr 32px", gap: 10, alignItems: "center", fontFamily: "var(--mono)", fontSize: 11 }}>
            <div style={{ color: "var(--text-mute)", textAlign: "right" }}>#{d.rank}</div>
            <div style={{ color: "var(--text)", fontWeight: 600, textAlign: "right" }}>{d.pct}%</div>
            <div style={{ position: "relative", height: 22, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, width: `${pctW}%`, background: color, opacity: 0.85 }} />
              <div style={{ position: "absolute", inset: 0, padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--text)", zIndex: 1 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{d.fn}</span>
                <span style={{ color: "var(--text-mute)", fontSize: 10 }}>{d.note}</span>
              </div>
            </div>
            <div style={{ color: "var(--text-mute)", fontSize: 9, textAlign: "right" }}>
              {d.layer === "kernel" ? "K" : d.layer === "user" ? "U" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarPair({ stage }) {
  // Two stacked bars showing where time goes, in two builds
  const data = stage === "openmp" ? [
    { name: "iqk_mul_mat", pct: 81, color: KIND_COLORS.matmul },
    { name: "futex_*", pct: 12, color: KIND_COLORS.lock },
    { name: "syscall_*", pct: 14, color: KIND_COLORS.syscall },
    { name: "libgomp", pct: 5.8, color: KIND_COLORS.lock },
    { name: "其他", pct: 6, color: "var(--text-mute)" },
  ] : [
    { name: "iqk_mul_mat", pct: 54.9, color: KIND_COLORS.matmul },
    { name: "ggml_barrier (spin!)", pct: 34.6, color: KIND_COLORS.lock },
    { name: "memset / page fault", pct: 4, color: KIND_COLORS.compute },
    { name: "其他", pct: 6.5, color: "var(--text-mute)" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11, marginBottom: 2 }}>
            <span style={{ color: "var(--text)" }}>{d.name}</span>
            <span style={{ color: "var(--text-dim)" }}>{d.pct}%</span>
          </div>
          <div style={{ height: 18, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${d.pct}%`, background: d.color, transition: "width .3s" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

window.IkLlamaSection = IkLlamaSection;
