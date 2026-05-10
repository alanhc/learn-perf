// Top-level app — shell, hero, navigation, tweaks
const { useState: rUseState, useEffect: rUseEffect } = React;

function App() {
  const [tweaks, setTweak] = useTweaks(window.__TWEAK_DEFAULTS__);
  const t = useStrings(tweaks.lang);

  // Apply theme/accent/font scale to root
  rUseEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = tweaks.theme;
    root.dataset.accent = tweaks.accent;
    root.style.setProperty("--font-scale", tweaks.fontScale);
    root.style.setProperty("--anim", tweaks.animSpeed);
    root.style.setProperty("--mono", `"${tweaks.monoFamily}", ui-monospace, monospace`);
    root.style.setProperty("--sans", `"${tweaks.sansFamily}", system-ui, sans-serif`);
  }, [tweaks]);

  // active section tracking via IntersectionObserver
  const [active, setActive] = rUseState("intro");
  rUseEffect(() => {
    const els = t.sections.map(s => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-20% 0px -60% 0px", threshold: [0.05, 0.5, 1] });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [t.sections]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo">{t.brand}</span>
        </div>
        <div className="sidebar-tagline">{t.tagline}</div>

        <nav className="nav">
          {t.sections.map(s => (
            <a key={s.id} href={`#${s.id}`}
              className={clsx("nav-item", active === s.id && "active")}
            >
              <span className="nav-num">{s.num}</span>
              <span>{s.title}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          基於 <a href="https://hackmd.io/@sysprog/linux-perf" target="_blank" rel="noopener">sysprog/linux-perf</a> 整理。
          原文修改自 <a href="https://zh-blog.logan.tw/2019/07/10/analyze-program-performance-with-perf-events/" target="_blank" rel="noopener">羅根學習筆記</a>。
        </div>
      </aside>

      <main className="main">
        <Hero t={t} />
        <IntroSection t={t} animSpeed={tweaks.animSpeed} showAnnotations={tweaks.showAnnotations} />
        <SamplingSection t={t} animSpeed={tweaks.animSpeed} showAnnotations={tweaks.showAnnotations} />
        <CounterSection t={t} animSpeed={tweaks.animSpeed} showAnnotations={tweaks.showAnnotations} />
        <PeriodFreqSection t={t} animSpeed={tweaks.animSpeed} showAnnotations={tweaks.showAnnotations} />
        <PipelineSection t={t} animSpeed={tweaks.animSpeed} showAnnotations={tweaks.showAnnotations} />
        <CommandsSection t={t} animSpeed={tweaks.animSpeed} />
        <MatrixSection t={t} animSpeed={tweaks.animSpeed} showAnnotations={tweaks.showAnnotations} />
        <CallGraphSection t={t} showAnnotations={tweaks.showAnnotations} />
        <FlameGraphSection t={t} showAnnotations={tweaks.showAnnotations} />
        <IkLlamaSection animSpeed={tweaks.animSpeed} showAnnotations={tweaks.showAnnotations} />
        <Footer t={t} />
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection title="主題">
          <TweakRadio label="模式" value={tweaks.theme} onChange={v => setTweak("theme", v)}
            options={[{value:"dark",label:"深色"}, {value:"light",label:"淺色"}]} />
          <TweakColor label="強調色" value={tweaks.accent} onChange={v => setTweak("accent", v)}
            options={[
              { value: "amber", color: "#ffb627" },
              { value: "lime",  color: "#c6f24e" },
              { value: "cyan",  color: "#4dd2ff" },
              { value: "pink",  color: "#ff85c1" },
              { value: "violet",color: "#b794f6" },
            ]} />
        </TweakSection>

        <TweakSection title="字型 / 字級">
          <TweakSelect label="正文字型" value={tweaks.sansFamily} onChange={v => setTweak("sansFamily", v)}
            options={["Noto Sans TC", "Space Grotesk", "system-ui"]} />
          <TweakSelect label="等寬字型" value={tweaks.monoFamily} onChange={v => setTweak("monoFamily", v)}
            options={["JetBrains Mono", "ui-monospace", "Menlo"]} />
          <TweakSlider label="字級倍率" value={tweaks.fontScale} min={0.85} max={1.3} step={0.05}
            onChange={v => setTweak("fontScale", v)} format={v => `${(v * 100).toFixed(0)}%`} />
        </TweakSection>

        <TweakSection title="動畫 / 內容">
          <TweakSlider label="動畫速度" value={tweaks.animSpeed} min={0.25} max={3} step={0.25}
            onChange={v => setTweak("animSpeed", v)} format={v => `${v.toFixed(2)}×`} />
          <TweakRadio label="語言" value={tweaks.lang} onChange={v => setTweak("lang", v)}
            options={[
              { value: "zh-Hant", label: "繁" },
              { value: "zh-Hans", label: "简" },
              { value: "en", label: "EN" },
            ]} />
          <TweakToggle label="顯示速記註解" value={tweaks.showAnnotations} onChange={v => setTweak("showAnnotations", v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function Hero({ t }) {
  return (
    <section className="hero" data-screen-label="00 Hero">
      <div className="hero-inner">
        <div className="hero-eyebrow">{t.hero.eyebrow}</div>
        <h1 className="hero-title">
          {t.hero.titleEn}
          <span className="zh">{t.hero.titleZh}</span>
        </h1>
        <p className="hero-sub">{t.hero.sub}</p>
        <div className="hero-meta">
          {t.hero.meta.map((m, i) => (
            <span key={i}>{m.k}<strong>{m.v}</strong></span>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntroSection({ t, animSpeed, showAnnotations }) {
  return (
    <Section id="intro" label="Intro" num="00"
      eyebrow={t.intro.eyebrow}
      title={t.intro.title}
      lede={t.intro.lede}
    >
      <StackFlow animSpeed={animSpeed} showAnnotations={showAnnotations} />
      <div style={{ height: 24 }} />
      <EventLifecycle animSpeed={animSpeed} showAnnotations={showAnnotations} />
      <div style={{ height: 24 }} />
      <div className="grid-3">
        {t.intro.cards.map((c, i) => (
          <div key={i} className="card" style={{
            borderTop: `3px solid ${["var(--accent)", "var(--cool)", "var(--violet)"][i]}`,
          }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              0{i + 1}
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>
              {c.t}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.7 }}>
              {c.d}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Footer({ t }) {
  return (
    <footer style={{ padding: "48px 56px", borderTop: "1px solid var(--line)", color: "var(--text-mute)", fontSize: 12, fontFamily: "var(--mono)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span>perf 視覺化教學儀表板 · 2026</span>
        <span>基於 <a href="https://hackmd.io/@sysprog/linux-perf" style={{ color: "var(--text-dim)" }}>sysprog/linux-perf</a></span>
      </div>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
