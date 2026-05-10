// Section 01 — Sampling visualization
function SamplingSection({ t, animSpeed, showAnnotations }) {
  const [hz, setHz] = useState(4);
  const [running, setRunning] = useState(true);
  const tick = useTick(2, running, animSpeed);

  // 16 second timeline. Real distribution: 75% blue (gaps), 25% orange.
  // Block layout: orange in [0..2, 6..7, 11..12], blue otherwise. 16 units total (4 orange).
  const totalUnits = 16;
  const isOrange = (i) => (i >= 0 && i < 2) || i === 6 || (i >= 11 && i < 12);

  // Generate sample positions based on hz (samples per 16-sec window)
  const samples = useMemo(() => {
    const n = Math.max(1, Math.round(hz));
    const arr = [];
    for (let i = 0; i < n; i++) {
      // jitter slightly per tick to imitate stochastic sampling
      const base = (i + 0.5) / n;
      const jitter = (((i + tick) * 9301 + 49297) % 233280) / 233280 * 0.6 - 0.3;
      const pos = Math.max(0.005, Math.min(0.995, base + jitter / n));
      arr.push(pos);
    }
    return arr;
  }, [hz, tick]);

  // Estimate from samples
  const orangeSamples = samples.filter(p => isOrange(p * totalUnits)).length;
  const orangePct = samples.length ? Math.round((orangeSamples / samples.length) * 100) : 0;
  const bluePct = 100 - orangePct;

  const barW = 1100;
  const barH = 64;
  const sampleY = barH + 36;
  const svgH = sampleY + 28;

  return (
    <Section id="sampling" label="Sampling" num="01"
      eyebrow={t.sampling.eyebrow}
      title={t.sampling.title}
      lede={t.sampling.lede}
    >
      <div className="grid-2">
        <Card title={t.sampling.realTitle}>
          <svg viewBox={`0 0 ${barW} ${svgH}`} className="timeline-svg" style={{ maxHeight: 200 }}>
            {/* time bar */}
            {Array.from({ length: totalUnits }).map((_, i) => {
              const x = (i / totalUnits) * barW;
              const w = barW / totalUnits;
              return (
                <rect key={i} x={x} y={0} width={w - 1} height={barH}
                  fill={isOrange(i) ? "#ffb627" : "#4dd2ff"} opacity={0.85}
                  rx={2}
                />
              );
            })}
            {/* axis */}
            <line x1={0} y1={barH + 6} x2={barW} y2={barH + 6} stroke="var(--line)" />
            {/* samples */}
            {samples.map((p, i) => {
              const x = p * barW;
              const orange = isOrange(p * totalUnits);
              return (
                <g key={i}>
                  <line x1={x} y1={barH + 6} x2={x} y2={sampleY - 8} stroke="var(--text-mute)" strokeDasharray="2 2" />
                  <polygon
                    points={`${x},${sampleY - 8} ${x - 8},${sampleY + 6} ${x + 8},${sampleY + 6}`}
                    fill={orange ? "#ffb627" : "#4dd2ff"}
                    stroke="var(--text)" strokeWidth={1}
                  />
                </g>
              );
            })}
          </svg>
          <div className="slider-row" style={{ marginTop: 18 }}>
            <label>{t.sampling.sliderLabel}</label>
            <input type="range" min="1" max="40" step="1" value={hz} onChange={e => setHz(+e.target.value)} />
            <span className="slider-val">{hz} {t.sampling.hzUnit}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => setRunning(r => !r)}>{running ? "⏸ pause" : "▶ play"}</button>
            <span className="chip cool">● {t.sampling.blueLabel}</span>
            <span className="chip warm" style={{ color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-soft)" }}>● {t.sampling.orangeLabel}</span>
          </div>
          <Annot show={showAnnotations}>{t.sampling.annot}</Annot>
        </Card>

        <Card title={t.sampling.estimateTitle}>
          <div style={{ marginBottom: 18 }}>
            <HBar value={bluePct} max={100} color="#4dd2ff" label={t.sampling.blueLabel} valueLabel={`${bluePct}%`} height={14} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <HBar value={orangePct} max={100} color="#ffb627" label={t.sampling.orangeLabel} valueLabel={`${orangePct}%`} height={14} />
          </div>
          <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 14, marginTop: 14 }}>
            <div className="stat-row">
              <div className="stat">
                <div className="stat-num warm">{samples.length}</div>
                <div className="stat-label">samples</div>
              </div>
              <div className="stat">
                <div className="stat-num">{Math.abs(orangePct - 25)}%</div>
                <div className="stat-label">誤差 (vs 真實 25%)</div>
              </div>
              <div className="stat">
                <div className="stat-num good">{hz <= 5 ? "低" : hz <= 20 ? "中" : "高"}</div>
                <div className="stat-label">觀察者效應</div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 12 }}>
            真實比例為 75 / 25。樣本越多誤差越小，但 perf_event 取樣上限約 10,000 Hz — 拉到頂仍是統計逼近，不是精確測量。
          </p>
        </Card>
      </div>
    </Section>
  );
}

window.SamplingSection = SamplingSection;
