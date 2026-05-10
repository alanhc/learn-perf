// Shared helpers + small primitives used across sections
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function clsx(...args) {
  return args.filter(Boolean).join(" ");
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Section wrapper
function Section({ id, label, num, eyebrow, title, lede, children }) {
  return (
    <section
      className="section"
      id={id}
      data-screen-label={`${num} ${label}`}
    >
      <div className="section-eyebrow">{eyebrow}</div>
      <h2 className="section-title" data-comment-anchor={`${id}-title`}>{title}</h2>
      <p className="section-lede">{lede}</p>
      {children}
    </section>
  );
}

// Small bar — used in many sections
function HBar({ value, max, color = "var(--accent)", height = 8, label, valueLabel }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ width: "100%" }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
          <span>{label}</span>
          <span style={{ color: "var(--text)" }}>{valueLabel ?? value}</span>
        </div>
      )}
      <div style={{ height, background: "var(--bg-input)", borderRadius: height / 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: height / 2, transition: "width .3s ease" }} />
      </div>
    </div>
  );
}

function Annot({ children, show = true, prefix = "註" }) {
  if (!show) return null;
  return (
    <div className="annot">
      <strong>[{prefix}]</strong> {children}
    </div>
  );
}

function Card({ title, children, dot = true, style }) {
  return (
    <div className="card" style={style}>
      {title && (
        <div className="card-title">
          {dot && <span className="dot" />} {title}
        </div>
      )}
      {children}
    </div>
  );
}

// Animation tick at speed-scaled rate
function useTick(fps = 30, running = true, speedMul = 1) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const interval = 1000 / (fps * speedMul);
    const id = setInterval(() => setTick(t => t + 1), interval);
    return () => clearInterval(id);
  }, [fps, running, speedMul]);
  return tick;
}

Object.assign(window, { Section, HBar, Annot, Card, clsx, lerp, useTick });
