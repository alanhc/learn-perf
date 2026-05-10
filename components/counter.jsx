// Section 02 — Hardware counter & Skid
function CounterSection({ t, animSpeed, showAnnotations }) {
  const [period, setPeriod] = useState(4);
  const [running, setRunning] = useState(true);
  const tick = useTick(3, running, animSpeed);

  // 24 events. Counter starts at period, decrements per event, fires IRQ at 0, then resets.
  const totalEvents = 24;
  const events = Array.from({ length: totalEvents }).map((_, i) => i);
  const counterValue = period - ((tick % (totalEvents + 1)) % period);
  const cursor = tick % (totalEvents + 1);

  // Pipeline skid demo
  const ipInstrs = ["mov  (%rcx),%edx", "imul (%rax),%edx", "add  $0x4,%rcx", "add  %edx,%esi", "cmp  %rdi,%rax", "jne  .L2"];
  const realIdx = 1; // imul triggers cache miss
  const recordedIdx = 3 + (Math.floor(tick / 6) % 2); // skid lands on add or cmp

  return (
    <Section id="counter" label="Counter" num="02"
      eyebrow={t.counter.eyebrow}
      title={t.counter.title}
      lede={t.counter.lede}
    >
      <div className="grid-2">
        <Card title="計數器中斷觸發">
          <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
            {events.map(i => {
              const isPast = i < cursor;
              const isCurrent = i === cursor;
              const isFire = isPast && (i + 1) % period === 0;
              return (
                <div key={i} title={`event #${i + 1}`}
                  style={{
                    width: 26, height: 26, borderRadius: 4,
                    background: isFire ? "var(--accent)" : isPast ? "var(--bg-input)" : "var(--bg-card)",
                    border: `1px solid ${isCurrent ? "var(--accent)" : "var(--line)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--mono)", fontSize: 10, color: isFire ? "#000" : "var(--text-mute)",
                    transition: "all .2s",
                  }}>
                  {isFire ? "⚡" : ""}
                </div>
              );
            })}
          </div>

          <div className="slider-row">
            <label>Period</label>
            <input type="range" min="2" max="12" step="1" value={period} onChange={e => setPeriod(+e.target.value)} />
            <span className="slider-val">{period}</span>
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="stat-num warm" style={{ fontVariantNumeric: "tabular-nums" }}>
                {String(counterValue).padStart(2, "0")}
              </div>
              <div className="stat-label">{t.counter.counterLabel}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{Math.floor(cursor / period)}</div>
              <div className="stat-label">中斷次數</div>
            </div>
          </div>
          <button className="btn" onClick={() => setRunning(r => !r)} style={{ marginTop: 12 }}>{running ? "⏸ pause" : "▶ play"}</button>
        </Card>

        <Card title={`Skid 現象 — ${t.counter.skidLabel}`}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.9 }}>
            {ipInstrs.map((ins, i) => {
              const real = i === realIdx;
              const recorded = i === recordedIdx;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "4px 10px", borderRadius: 4,
                  background: recorded ? "rgba(255,93,108,0.15)" : real ? "rgba(255,182,39,0.15)" : "transparent",
                  borderLeft: `3px solid ${recorded ? "var(--hot)" : real ? "var(--accent)" : "transparent"}`,
                }}>
                  <span style={{ color: "var(--text-mute)", width: 28 }}>{String(i).padStart(2, "0")}</span>
                  <span style={{ flex: 1 }}>{ins}</span>
                  {real && <span className="chip warm" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>實際觸發</span>}
                  {recorded && <span className="chip hot">perf 記錄</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, padding: "10px 0", color: "var(--text-mute)", fontFamily: "var(--mono)", fontSize: 12 }}>
            <span style={{ color: "var(--accent)" }}>imul</span>
            <span>→ skid →</span>
            <span style={{ color: "var(--hot)" }}>{ipInstrs[recordedIdx].split(/\s+/)[0]}</span>
            <span style={{ marginLeft: 8 }}>(滑了 {recordedIdx - realIdx} 條指令)</span>
          </div>
          <Annot show={showAnnotations}>{t.counter.annot}</Annot>
        </Card>
      </div>
    </Section>
  );
}

window.CounterSection = CounterSection;
