// Section 03 — Period vs Frequency
function PeriodFreqSection({ t, animSpeed, showAnnotations }) {
  const [targetFreq, setTargetFreq] = useState(4);
  const [running, setRunning] = useState(true);
  const tick = useTick(2, running, animSpeed);

  // 4 second window with bursts of events: dense at start, sparse, dense, normal.
  const buckets = [12, 4, 9, 3]; // events per second
  const totalEvents = buckets.reduce((a, b) => a + b, 0);
  // For target freq 4 Hz over 4 sec window → want 1 sample per bucket.
  // Period auto-adjusts: bucket events / desired samples in bucket
  const periods = buckets.map(b => Math.max(1, Math.round(b / Math.max(1, targetFreq / buckets.length))));

  // Visual: grid of events, with sample markers
  const W = 1100, H = 110;
  const padX = 30;
  const innerW = W - padX * 2;

  const samples = [];
  let evtIdx = 0;
  for (let bi = 0; bi < buckets.length; bi++) {
    const period = Math.max(1, Math.round(buckets[bi] / Math.max(1, Math.round(targetFreq / 4))));
    let counter = period;
    for (let e = 0; e < buckets[bi]; e++) {
      counter--;
      if (counter <= 0) {
        const x = padX + ((evtIdx + e + 0.5) / totalEvents) * innerW;
        samples.push({ x, bucket: bi, period });
        counter = period;
      }
    }
    evtIdx += buckets[bi];
  }

  let runningEvtIdx = 0;
  const eventDots = [];
  for (let bi = 0; bi < buckets.length; bi++) {
    for (let e = 0; e < buckets[bi]; e++) {
      const x = padX + ((runningEvtIdx + 0.5) / totalEvents) * innerW;
      eventDots.push({ x, bucket: bi, idx: runningEvtIdx });
      runningEvtIdx++;
    }
  }

  return (
    <Section id="period-freq" label="Period vs Freq" num="03"
      eyebrow={t.pf.eyebrow}
      title={t.pf.title}
      lede={t.pf.lede}
    >
      <Card title="Period 自適應到 Target Frequency">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", maxHeight: 220 }}>
          {/* bucket separators */}
          {buckets.map((_, bi) => {
            const x = padX + ((buckets.slice(0, bi + 1).reduce((a, b) => a + b, 0)) / totalEvents) * innerW;
            return <line key={bi} x1={x} y1={20} x2={x} y2={H - 20} stroke="var(--line)" strokeDasharray="3 3" />;
          })}
          {/* time labels */}
          {[0, 1, 2, 3, 4].map(s => {
            const x = padX + (s / 4) * innerW;
            return <text key={s} x={x} y={H - 4} fontSize="10" fill="var(--text-mute)" fontFamily="var(--mono)" textAnchor="middle">{s}s</text>;
          })}
          {/* events */}
          {eventDots.map((d, i) => (
            <circle key={i} cx={d.x} cy={45} r={3} fill="var(--text-mute)" opacity={0.5} />
          ))}
          {/* sample markers */}
          {samples.map((s, i) => (
            <g key={i}>
              <line x1={s.x} y1={45} x2={s.x} y2={80} stroke="var(--accent)" strokeWidth={2} />
              <circle cx={s.x} cy={80} r={6} fill="var(--accent)" stroke="var(--text)" strokeWidth={1.5} />
              <text x={s.x} y={H - 22} fontSize="9" fill="var(--accent)" fontFamily="var(--mono)" textAnchor="middle">P={s.period}</text>
            </g>
          ))}
          {/* labels */}
          <text x={padX} y={32} fontSize="10" fill="var(--text-mute)" fontFamily="var(--mono)">all events</text>
          <text x={padX} y={92} fontSize="10" fill="var(--accent)" fontFamily="var(--mono)">samples</text>
        </svg>

        <div className="slider-row" style={{ marginTop: 14 }}>
          <label>{t.pf.freqLabel}</label>
          <input type="range" min="1" max="20" step="1" value={targetFreq} onChange={e => setTargetFreq(+e.target.value)} />
          <span className="slider-val">{targetFreq} Hz</span>
        </div>

        <div className="stat-row">
          <div className="stat">
            <div className="stat-num warm">{samples.length}</div>
            <div className="stat-label">實際樣本數</div>
          </div>
          <div className="stat">
            <div className="stat-num">{periods.join(" / ")}</div>
            <div className="stat-label">各 bucket 自適應 period</div>
          </div>
          <div className="stat">
            <div className="stat-num good">{totalEvents}</div>
            <div className="stat-label">總事件</div>
          </div>
        </div>

        <Annot show={showAnnotations}>
          灰點 = 真實事件，密度不均 (12/4/9/3)。橘色三角 = 樣本。perf 在每個時間區間後重新計算 period — 事件多時 period 上調，事件少時下調，努力維持每秒 {targetFreq} 個樣本。
        </Annot>
      </Card>
    </Section>
  );
}

window.PeriodFreqSection = PeriodFreqSection;
