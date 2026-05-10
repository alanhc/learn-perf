// Section 06 — Matrix multiplication cache visualization
// Side-by-side: matrix-v1 (cache-hostile) vs matrix-v2 (transposed, cache-friendly)
function MatrixSection({ t, animSpeed, showAnnotations }) {
  const [running, setRunning] = useState(true);
  const [version, setVersion] = useState("compare"); // "v1" | "v2" | "compare"

  const SIZE = 16;       // 16x16 grid for visualization
  const CACHE_LINE = 4;  // each cache line holds 4 cells
  const tick = useTick(8, running, animSpeed);

  // For v1: c[i][j] += a[i][k] * b[k][j]
  // We visualize the access to b[k][j] — the problematic one.
  // Iteration order: outer i, j, k. So for fixed i,j, k advances → row of b changes.
  // Let's pick i=0, j=2 (fixed), and animate k from 0..SIZE-1.
  const fixedI = 0;
  const fixedJ = 5;
  const k = tick % SIZE;

  // Cache state — track which cache lines are loaded.
  // We simulate a small cache with N lines, evicted FIFO.
  const CACHE_LINES = 4; // tiny cache to make miss/hit visible
  const v1Cache = useMemo(() => simulateV1Cache(fixedI, fixedJ, k, SIZE, CACHE_LINE, CACHE_LINES), [k]);
  const v2Cache = useMemo(() => simulateV2Cache(fixedI, fixedJ, k, SIZE, CACHE_LINE, CACHE_LINES), [k]);

  return (
    <Section id="matrix" label="Matrix Case" num="06"
      eyebrow={t.matrix.eyebrow}
      title={t.matrix.title}
      lede={t.matrix.lede}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button className={clsx("btn", version === "compare" && "primary")} onClick={() => setVersion("compare")}>對照 (v1 vs v2)</button>
        <button className={clsx("btn", version === "v1" && "primary")} onClick={() => setVersion("v1")}>只看 v1</button>
        <button className={clsx("btn", version === "v2" && "primary")} onClick={() => setVersion("v2")}>只看 v2</button>
        <button className="btn" onClick={() => setRunning(r => !r)}>{running ? "⏸ pause" : "▶ play"}</button>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-mute)", alignSelf: "center" }}>
          k = {k} / {SIZE - 1} &nbsp;|&nbsp; i={fixedI}, j={fixedJ}
        </span>
      </div>

      <div className="grid-2">
        {(version === "v1" || version === "compare") && (
          <Card title={t.matrix.v1} dot={false} style={{ borderTop: "3px solid var(--hot)" }}>
            <MatrixVisualizer
              version="v1" size={SIZE} cacheLine={CACHE_LINE}
              fixedI={fixedI} fixedJ={fixedJ} k={k} cache={v1Cache} t={t}
            />
            <CacheStats cache={v1Cache} version="v1" />
          </Card>
        )}
        {(version === "v2" || version === "compare") && (
          <Card title={t.matrix.v2} dot={false} style={{ borderTop: "3px solid var(--good)" }}>
            <MatrixVisualizer
              version="v2" size={SIZE} cacheLine={CACHE_LINE}
              fixedI={fixedI} fixedJ={fixedJ} k={k} cache={v2Cache} t={t}
            />
            <CacheStats cache={v2Cache} version="v2" />
          </Card>
        )}
      </div>

      <div style={{ height: 24 }} />

      <Card title="效能對比 — 真實 1024×1024 矩陣相乘 (Intel i7-13700)">
        <table className="diff-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="num">matrix-v1</th>
              <th className="num">matrix-v2</th>
              <th className="num">變化</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Insn Per Cycle</td>
              <td className="num">4.58</td>
              <td className="num">24.43</td>
              <td className="num delta-good">+433%</td>
            </tr>
            <tr>
              <td>L1 Data Cache Miss</td>
              <td className="num">5,234,653,990</td>
              <td className="num">254,865,271</td>
              <td className="num delta-good">−95%</td>
            </tr>
            <tr>
              <td>總執行時間</td>
              <td className="num">10.40 秒</td>
              <td className="num">1.67 秒</td>
              <td className="num delta-good">−84%</td>
            </tr>
            <tr>
              <td>Total Cycles</td>
              <td className="num">53,805,621,962</td>
              <td className="num">8,540,868,422</td>
              <td className="num delta-good">−84%</td>
            </tr>
          </tbody>
        </table>
        <Annot show={showAnnotations}>
          v1 的 b[k][j] 跨 column 存取 → 每次都讀新的 cache line，幾乎全 miss。
          v2 先轉置一次成 bT[j][k]，內層 k 迴圈變成連續記憶體存取 (row-major)，
          一條 cache line 的 64 bytes 可服務後面好幾次讀取，spatial locality 飆升。
        </Annot>
      </Card>
    </Section>
  );
}

function MatrixVisualizer({ version, size, cacheLine, fixedI, fixedJ, k, cache, t }) {
  // Show matrix B (or bT for v2). Highlight current access; color cells in cached line.
  const accessRow = version === "v1" ? k : fixedJ;        // v1: b[k][j] → row=k. v2: bT[j][k] → row=j.
  const accessCol = version === "v1" ? fixedJ : k;
  const matrixLabel = version === "v1" ? "matrix B[k][j]" : "matrix bT[j][k]";
  // For v2, mark the row=fixedJ of bT
  // The cells "in cache" are determined by cache.lines (set of cache-line indices)

  const cacheLineIndices = new Set(cache.lines);
  function cellLineIdx(row, col) {
    // Cache line indexing: each row has size/cacheLine lines, line index = row * (size/cacheLine) + Math.floor(col/cacheLine)
    const linesPerRow = size / cacheLine;
    return row * linesPerRow + Math.floor(col / cacheLine);
  }

  return (
    <div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
        {matrixLabel}
      </div>
      <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, maxWidth: 480 }}>
        {Array.from({ length: size * size }).map((_, idx) => {
          const row = Math.floor(idx / size);
          const col = idx % size;
          const isAccess = row === accessRow && col === accessCol;
          const lineIdx = cellLineIdx(row, col);
          const inCache = cacheLineIndices.has(lineIdx);
          const justMissed = isAccess && cache.lastEvent === "miss";
          const justHit = isAccess && cache.lastEvent === "hit";

          let bg = "var(--bg-input)";
          if (inCache) bg = "rgba(110, 231, 164, 0.18)";
          if (justHit) bg = "var(--good)";
          if (justMissed) bg = "var(--hot)";

          return (
            <div key={idx} className="matrix-cell" style={{
              background: bg,
              outline: isAccess ? "2px solid var(--text)" : undefined,
              transition: "background 0.15s",
            }} />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-mute)" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--good)", borderRadius: 2, marginRight: 4 }} />{t.matrix.hitLabel}</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--hot)", borderRadius: 2, marginRight: 4 }} />{t.matrix.missLabel}</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(110, 231, 164, 0.3)", borderRadius: 2, marginRight: 4 }} />已 cache</span>
      </div>
    </div>
  );
}

function CacheStats({ cache, version }) {
  const total = cache.hits + cache.misses;
  const missRate = total ? Math.round((cache.misses / total) * 100) : 0;
  return (
    <div className="stat-row" style={{ marginTop: 18 }}>
      <div className="stat">
        <div className={clsx("stat-num", version === "v1" ? "hot" : "good")}>{missRate}%</div>
        <div className="stat-label">Cache miss rate</div>
      </div>
      <div className="stat">
        <div className="stat-num">{cache.hits}</div>
        <div className="stat-label">hits</div>
      </div>
      <div className="stat">
        <div className="stat-num">{cache.misses}</div>
        <div className="stat-label">misses</div>
      </div>
    </div>
  );
}

// Simulate v1 cache state at iteration step k (i,j fixed)
// b[k][j]: each iteration reads a different row → almost always different cache line
function simulateV1Cache(fixedI, fixedJ, currentK, size, cacheLine, capacity) {
  const accesses = [];
  for (let kk = 0; kk <= currentK; kk++) {
    const linesPerRow = size / cacheLine;
    const lineIdx = kk * linesPerRow + Math.floor(fixedJ / cacheLine);
    accesses.push(lineIdx);
  }
  return runCache(accesses, capacity);
}
// v2: bT[j][k] — j fixed, k advances → SAME row, k advances within row → only crosses cache-line boundary every `cacheLine` iterations
function simulateV2Cache(fixedI, fixedJ, currentK, size, cacheLine, capacity) {
  const accesses = [];
  for (let kk = 0; kk <= currentK; kk++) {
    const linesPerRow = size / cacheLine;
    const lineIdx = fixedJ * linesPerRow + Math.floor(kk / cacheLine);
    accesses.push(lineIdx);
  }
  return runCache(accesses, capacity);
}
function runCache(accesses, capacity) {
  const queue = [];
  let hits = 0, misses = 0;
  let lastEvent = null;
  for (const line of accesses) {
    if (queue.includes(line)) {
      hits++;
      lastEvent = "hit";
    } else {
      misses++;
      lastEvent = "miss";
      queue.push(line);
      if (queue.length > capacity) queue.shift();
    }
  }
  return { hits, misses, lines: queue, lastEvent };
}

window.MatrixSection = MatrixSection;
