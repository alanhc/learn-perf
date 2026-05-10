// Section 04 — Pipeline + Branch Prediction
function PipelineSection({ t, animSpeed, showAnnotations }) {
  const [running, setRunning] = useState(true);
  const [bpHit, setBpHit] = useState(85);
  const [showBranchMiss, setShowBranchMiss] = useState(false);
  const tick = useTick(2, running, animSpeed);

  const stages = t.pipeline.stages;          // ["IF","ID","EX","MEM","WB"]
  const stageNames = t.pipeline.stageNames;
  const numInstrs = 8;

  // Each instruction enters pipeline 1 cycle after the previous → diagonal pattern.
  // At "branch miss" instruction (idx 3), the in-flight instructions get flushed.
  const branchAt = 3;
  const flushedCycle = branchAt + 2; // miss detected at EX of branch instruction
  // Generate cell color for (instr, cycle).
  // baseline:  cycle - instrIdx in [0..numStages-1] → that stage
  function stateAt(instrIdx, cycle) {
    if (showBranchMiss) {
      // Instructions launched after branch (idx > branchAt) within flush window get bubble.
      if (instrIdx > branchAt && cycle >= flushedCycle && cycle < flushedCycle + (instrIdx - branchAt)) {
        return { stage: "💥", color: "var(--hot)" };
      }
      // After flush, restart instruction at flushedCycle + (instrIdx - branchAt - 1)
      if (instrIdx > branchAt) {
        const restartCycle = flushedCycle + (instrIdx - branchAt);
        const sIdx = cycle - restartCycle;
        if (sIdx >= 0 && sIdx < stages.length) return { stage: stages[sIdx], color: "var(--accent)" };
        return null;
      }
    }
    const sIdx = cycle - instrIdx;
    if (sIdx >= 0 && sIdx < stages.length) {
      const colors = ["#4dd2ff", "#b794f6", "#ffb627", "#ff85c1", "#6ee7a4"];
      return { stage: stages[sIdx], color: colors[sIdx] };
    }
    return null;
  }

  const totalCycles = numInstrs + stages.length + (showBranchMiss ? 4 : 0);
  const visCycle = tick % (totalCycles + 4);

  // Branch predictor demo: predict TAKEN over a stream of branches with hit rate
  const predictionStream = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 24; i++) {
      const r = ((i * 9301 + 49297) % 233280) / 233280;
      arr.push(r * 100 < bpHit);
    }
    return arr;
  }, [bpHit]);

  return (
    <Section id="pipeline" label="Pipeline" num="04"
      eyebrow={t.pipeline.eyebrow}
      title={t.pipeline.title}
      lede={t.pipeline.lede}
    >
      <Card title="5-stage pipeline diagram">
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {stages.map((s, i) => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div className="pipeline-stage" style={{ background: ["#4dd2ff","#b794f6","#ffb627","#ff85c1","#6ee7a4"][i], color: "#000" }}>
                {s}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--mono)" }}>{stageNames[i]}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontFamily: "var(--mono)", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: "4px 8px", color: "var(--text-mute)", textAlign: "left", width: 80 }}>instr \ cycle</th>
                {Array.from({ length: totalCycles }).map((_, c) => (
                  <th key={c} style={{ padding: "4px 6px", color: c === visCycle ? "var(--accent)" : "var(--text-mute)", fontWeight: c === visCycle ? 700 : 400, minWidth: 36, textAlign: "center" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: numInstrs }).map((_, ii) => (
                <tr key={ii}>
                  <td style={{ padding: "4px 8px", color: ii === branchAt && showBranchMiss ? "var(--hot)" : "var(--text-dim)" }}>
                    i{ii}{ii === branchAt && showBranchMiss ? " (br)" : ""}
                  </td>
                  {Array.from({ length: totalCycles }).map((_, c) => {
                    const st = stateAt(ii, c);
                    const visible = c <= visCycle;
                    return (
                      <td key={c} style={{ padding: "2px 3px", textAlign: "center" }}>
                        {st && visible ? (
                          <div style={{
                            width: 32, height: 22, borderRadius: 3,
                            background: st.color, color: st.color === "var(--hot)" ? "#fff" : "#000",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 600,
                            opacity: c === visCycle ? 1 : 0.7,
                            transition: "opacity .2s",
                          }}>
                            {st.stage}
                          </div>
                        ) : (
                          <div style={{ width: 32, height: 22 }} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setRunning(r => !r)}>{running ? "⏸ pause" : "▶ play"}</button>
          <button className={clsx("btn", showBranchMiss && "primary")} onClick={() => setShowBranchMiss(b => !b)}>
            {showBranchMiss ? "✓ branch miss" : "trigger branch miss"}
          </button>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-mute)" }}>
            cycle {visCycle} / {totalCycles - 1}
          </span>
        </div>
      </Card>

      <div style={{ height: 20 }} />

      <Card title="Branch Predictor 命中率">
        <div className="slider-row">
          <label>{t.pipeline.bpLabel}</label>
          <input type="range" min="50" max="99" step="1" value={bpHit} onChange={e => setBpHit(+e.target.value)} />
          <span className="slider-val">{bpHit}%</span>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 16, flexWrap: "wrap" }}>
          {predictionStream.map((hit, i) => (
            <div key={i} title={hit ? "命中" : "miss → flush pipeline"}
              style={{
                width: 28, height: 28, borderRadius: 4,
                background: hit ? "var(--good)" : "var(--hot)",
                color: "#000",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
              }}>
              {hit ? "✓" : "✗"}
            </div>
          ))}
        </div>
        <div className="stat-row" style={{ marginTop: 14 }}>
          <div className="stat">
            <div className="stat-num good">{predictionStream.filter(x => x).length}</div>
            <div className="stat-label">命中</div>
          </div>
          <div className="stat">
            <div className="stat-num hot">{predictionStream.filter(x => !x).length}</div>
            <div className="stat-label">失誤 (每次 ≈ 15 cycles 浪費)</div>
          </div>
          <div className="stat">
            <div className="stat-num">{predictionStream.filter(x => !x).length * 15}</div>
            <div className="stat-label">浪費的 cycles</div>
          </div>
        </div>
        <Annot show={showAnnotations}>
          固定模式分支 (例如 for 迴圈) 預測命中率高；switch-case 散亂跳躍預測差。perf record -e branch-misses 可量化分支預測失誤。
        </Annot>
      </Card>
    </Section>
  );
}

window.PipelineSection = PipelineSection;
