// Section 05 — perf commands (interactive terminal)
const PERF_COMMANDS = {
  list: {
    cmd: "sudo perf list",
    desc: "列出 Linux 核心與硬體支援的事件種類",
    output: [
      { type: "out", text: "List of pre-defined events (to be used in -e or -M):" },
      { type: "out", text: "" },
      { type: "warm", text: "  branch-instructions OR branches               [Hardware event]" },
      { type: "warm", text: "  branch-misses                                  [Hardware event]" },
      { type: "warm", text: "  bus-cycles                                     [Hardware event]" },
      { type: "warm", text: "  cache-misses                                   [Hardware event]" },
      { type: "warm", text: "  cache-references                               [Hardware event]" },
      { type: "warm", text: "  cpu-cycles OR cycles                           [Hardware event]" },
      { type: "warm", text: "  instructions                                   [Hardware event]" },
      { type: "out", text: "" },
      { type: "cool", text: "  alignment-faults                               [Software event]" },
      { type: "cool", text: "  context-switches OR cs                         [Software event]" },
      { type: "cool", text: "  page-faults OR faults                          [Software event]" },
      { type: "cool", text: "  task-clock                                     [Software event]" },
      { type: "out", text: "" },
      { type: "out", text: "  cpu_core:" },
      { type: "out", text: "    L1-dcache-load-misses                        [Hardware cache event]" },
      { type: "out", text: "    L1-dcache-loads                              [Hardware cache event]" },
      { type: "out", text: "    LLC-load-misses                              [Hardware cache event]" },
      { type: "out", text: "    dTLB-load-misses                             [Hardware cache event]" },
      { type: "out", text: "" },
      { type: "out", text: "  ... (about 1500 more events)" },
    ],
  },
  stat: {
    cmd: "sudo perf stat -e cycles,instructions ./matrix-v1",
    desc: "執行指定程式並印出各事件的總體統計數據",
    output: [
      { type: "out", text: "" },
      { type: "out", text: " Performance counter stats for './matrix-v1':" },
      { type: "out", text: "" },
      { type: "warm", text: "        8,257,295,521      cpu_atom/cycles/                 (0.03%)" },
      { type: "warm", text: "       53,805,621,962      cpu_core/cycles/                 (99.97%)" },
      { type: "warm", text: "        7,236,717,620      cpu_atom/instructions/  # 0.88 insn per cycle" },
      { type: "hot", text:  "       37,782,271,451      cpu_core/instructions/  # 4.58 insn per cycle  ← 偏低！" },
      { type: "out", text: "" },
      { type: "good", text: "       10.397060010 seconds time elapsed" },
      { type: "out", text: "       10.382124000 seconds user" },
      { type: "out", text: "        0.015000000 seconds sys" },
      { type: "out", text: "" },
      { type: "out", text: "// 現代 CPU 一個 cycle 應該能完成多條指令；" },
      { type: "out", text: "// IPC 只有 4.58 暗示有東西在拖累 CPU — 可能是 cache miss" },
    ],
  },
  record: {
    cmd: "sudo perf record -g -e cycles,instructions,L1-dcache-load-misses ./matrix-v1",
    desc: "執行程式並取樣記錄事件 (含 stack trace)",
    output: [
      { type: "out", text: "[ perf record: Woken up 12 times to write data ]" },
      { type: "out", text: "[ perf record: Captured and wrote 5.234 MB perf.data (52340 samples) ]" },
      { type: "out", text: "" },
      { type: "out", text: "// 執行時間 ≈ 10.4 秒, 取樣率 ≈ 5000 Hz" },
      { type: "out", text: "// -g 記錄 stack trace, -e 指定事件種類" },
      { type: "out", text: "// 預設輸出檔名為 perf.data" },
      { type: "good", text: "" },
      { type: "good", text: "$ ls -lh perf.data" },
      { type: "out", text: "-rw------- 1 root root 5.2M  May  8 10:24 perf.data" },
    ],
  },
  report: {
    cmd: "sudo perf report -g graph,0.5,caller",
    desc: "讀取 perf record 的記錄並繪製 Call Graph",
    output: [
      { type: "out", text: "Samples: 52K of event 'cpu_core/cycles/'" },
      { type: "out", text: "Event count (approx.): 53,805,621,962" },
      { type: "out", text: "" },
      { type: "out", text: "  Children      Self  Command       Symbol" },
      { type: "out", text: "  ........  ........  ............  ............................." },
      { type: "out", text: "" },
      { type: "hot", text:  "    99.83%    99.83%  matrix-v1     [.] mult            ← 熱點！" },
      { type: "out", text: "        |" },
      { type: "out", text: "        ---_start" },
      { type: "out", text: "           __libc_start_main" },
      { type: "out", text: "           main" },
      { type: "hot", text:  "           mult" },
      { type: "out", text: "" },
      { type: "warm", text: "     0.10%     0.10%  matrix-v1     [.] load_matrix" },
      { type: "out", text: "     0.07%     0.07%  matrix-v1     [.] [kernel.kallsyms]" },
    ],
  },
};

function renderLine(line, idx) {
  const cls = `term-${line.type}`;
  return <div key={idx} className={cls}>{line.text || "\u00A0"}</div>;
}

function CommandsSection({ t, animSpeed }) {
  const tabs = ["list", "stat", "record", "report"];
  const [active, setActive] = useState("list");
  const [typed, setTyped] = useState(0);
  const cmd = PERF_COMMANDS[active];

  // Reset & retype when tab switches
  useEffect(() => {
    setTyped(0);
    const total = cmd.cmd.length;
    let i = 0;
    const speed = 22 / animSpeed;
    const id = setInterval(() => {
      i++;
      setTyped(Math.min(i, total));
      if (i >= total) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [active, animSpeed]);

  const cmdShown = cmd.cmd.slice(0, typed);
  const cmdDone = typed >= cmd.cmd.length;

  // After cmd typed, reveal output progressively
  const [outputLines, setOutputLines] = useState(0);
  useEffect(() => {
    if (!cmdDone) { setOutputLines(0); return; }
    let i = 0;
    const id = setInterval(() => {
      i++;
      setOutputLines(i);
      if (i > cmd.output.length) clearInterval(id);
    }, 60 / animSpeed);
    return () => clearInterval(id);
  }, [cmdDone, active, animSpeed]);

  return (
    <Section id="commands" label="Commands" num="05"
      eyebrow={t.cmd.eyebrow}
      title={t.cmd.title}
      lede={t.cmd.lede}
    >
      <div className="tabs">
        {tabs.map(name => (
          <button key={name} className={clsx("tab", active === name && "active")} onClick={() => setActive(name)}>
            {t.cmd.tabs[tabs.indexOf(name)]}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 14, fontFamily: "var(--sans)" }}>
        <strong style={{ color: "var(--accent)" }}>{cmd.cmd.split(" ")[1] ?? cmd.cmd}</strong> — {cmd.desc}
      </div>

      <div className="terminal">
        <div className="terminal-bar">
          <span className="terminal-dot r" />
          <span className="terminal-dot y" />
          <span className="terminal-dot g" />
          <span className="terminal-title">~/sysprog/perf-demo</span>
        </div>
        <div className="terminal-body">
          <pre>
            <span className="term-prompt">user@sysprog $ </span>
            <span className="term-cmd">{cmdShown}</span>
            {!cmdDone && <span className="term-cursor" />}
            {"\n"}
          </pre>
          {cmdDone && (
            <div style={{ marginTop: 8 }}>
              {cmd.output.slice(0, outputLines).map(renderLine)}
              {outputLines <= cmd.output.length && <span className="term-cursor" />}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 24 }}>
        {[
          { name: "perf list", k: "看支援事件" },
          { name: "perf stat", k: "看總體數字" },
          { name: "perf record", k: "取樣記錄" },
          { name: "perf report", k: "讀取報表" },
        ].map(c => (
          <div key={c.name} style={{ background: "var(--bg-input)", padding: "12px 14px", borderRadius: 8, borderLeft: "3px solid var(--accent)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2 }}>{c.k}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

window.CommandsSection = CommandsSection;
