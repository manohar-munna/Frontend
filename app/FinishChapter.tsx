"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type FinishOption = {
  readonly name: string;
  readonly image: string;
  readonly outer: string;
  readonly stage: string;
  readonly glow: string;
  readonly ink: string;
};

type FinishChapterProps = {
  colors: readonly FinishOption[];
  active: number;
  outgoing: number | null;
  onSelect: (index: number) => void;
};

const finishNotes: Record<string, string> = {
  Burgundy: "A rich, warm finish with a deep red glow.",
  Pearl: "Soft light across a quiet, pale surface.",
  Graphite: "A darker shade with a restrained metallic sheen.",
  Sage: "A muted green inspired by natural light.",
  Midnight: "A deep blue that comes alive at the edges.",
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};

export default function FinishChapter({ colors, active, outgoing, onSelect }: FinishChapterProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [controlsReady, setControlsReady] = useState(false);
  const selected = colors[active];

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    if (!section || !inner) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactLayout = window.matchMedia("(max-width: 700px)");
    let frame = 0;
    let lastControlsReady = false;
    let lastProgress = -1;
    let lastCompact = compactLayout.matches;
    let lastReducedMotion = reducedMotion.matches;

    const measure = () => {
      frame = 0;
      const bounds = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const compact = compactLayout.matches;
      const distance = Math.max(1, bounds.height - viewportHeight);
      const progress = reducedMotion.matches ? 1 : clamp01(-bounds.top / distance);
      if (Math.abs(progress - lastProgress) < 0.0001 && compact === lastCompact && reducedMotion.matches === lastReducedMotion) return;
      lastProgress = progress;
      lastCompact = compact;
      lastReducedMotion = reducedMotion.matches;
      const phone = smoothstep((progress - (compact ? 0.02 : 0.035)) / (compact ? 0.25 : 0.31));
      const copy = smoothstep((progress - (compact ? 0 : 0.12)) / (compact ? 0.2 : 0.32));
      const detail = compact
        ? smoothstep((progress - 0.28) / 0.1) * (1 - smoothstep((progress - 0.49) / 0.1))
        : smoothstep((progress - 0.29) / 0.11) * (1 - smoothstep((progress - 0.49) / 0.1));
      const spread = smoothstep((progress - 0.5) / 0.15) * (1 - smoothstep((progress - 0.76) / 0.14));
      const light = smoothstep((progress - 0.25) / 0.08) * (1 - smoothstep((progress - 0.49) / 0.09));
      const controls = smoothstep((progress - (compact ? 0.68 : 0.69)) / (compact ? 0.23 : 0.22));
      const ready = reducedMotion.matches || progress >= (compact ? 0.8 : 0.74);

      inner.style.setProperty("--finish-progress", progress.toFixed(4));
      inner.style.setProperty("--finish-phone-opacity", (0.35 + phone * 0.65).toFixed(4));
      inner.style.setProperty("--finish-phone-x", `${((1 - phone) * (compact ? 24 : 70)).toFixed(1)}px`);
      inner.style.setProperty("--finish-phone-y", `${((1 - phone) * 65 - detail * 12).toFixed(1)}px`);
      inner.style.setProperty("--finish-phone-scale", (1 + (1 - phone) * (compact ? 0.14 : 0.32) + detail * 0.06 - spread * 0.18).toFixed(4));
      inner.style.setProperty("--finish-phone-turn", `${((1 - phone) * 5.5).toFixed(2)}deg`);
      inner.style.setProperty("--finish-copy-opacity", (compact ? 0.2 + copy * 0.8 : copy).toFixed(4));
      inner.style.setProperty("--finish-copy-y", `${((1 - copy) * (compact ? 24 : 48)).toFixed(1)}px`);
      inner.style.setProperty("--finish-detail-opacity", detail.toFixed(4));
      inner.style.setProperty("--finish-detail-y", `${((1 - detail) * 22).toFixed(1)}px`);
      inner.style.setProperty("--finish-controls-opacity", controls.toFixed(4));
      inner.style.setProperty("--finish-controls-y", `${((1 - controls) * 28).toFixed(1)}px`);
      inner.style.setProperty("--finish-orbit-turn", `${(progress * 48).toFixed(2)}deg`);
      inner.style.setProperty("--finish-spread", spread.toFixed(4));
      inner.style.setProperty("--finish-light-opacity", (light * 0.22).toFixed(4));
      inner.style.setProperty("--finish-light-x", `${(-75 + smoothstep((progress - 0.26) / 0.31) * 150).toFixed(2)}%`);
      inner.style.setProperty("--finish-caption-opacity", Math.max(detail, spread).toFixed(4));
      inner.dataset.beat = progress < 0.5 ? "light" : "color";
      for (let index = 0; index < 3; index++) {
        const line = smoothstep((progress - (compact ? 0 : 0.1) - index * 0.045) / 0.22);
        inner.style.setProperty(`--finish-line-${index}`, line.toFixed(4));
      }

      if (ready !== lastControlsReady) {
        lastControlsReady = ready;
        setControlsReady(ready);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    compactLayout.addEventListener("change", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      compactLayout.removeEventListener("change", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const style = {
    "--finish-stage": selected.stage,
    "--finish-outer": selected.outer,
    "--finish-glow": selected.glow,
    "--finish-ink": selected.ink,
    "--finish-artwork": `url("${selected.image}")`,
  } as CSSProperties;

  return (
    <section ref={sectionRef} id="finishes" className="finish-chapter" style={style} data-controls-ready={controlsReady} aria-labelledby="finish-title">
      <div ref={innerRef} className="finish-chapter-inner">
        <div className="finish-chapter-eyebrow"><span>04 / THE FINISH</span><span>FIVE POINTS OF VIEW</span></div>
        <span className="finish-chapter-progress" aria-hidden="true" />
        <div className="finish-chapter-stage">
          <div className="finish-chapter-copy">
            <p className="finish-chapter-overline">DESIGNED TO FEEL PERSONAL</p>
            <h2 id="finish-title"><span className="finish-chapter-line"><span>A finish for</span></span><span className="finish-chapter-line"><span>every</span></span><span className="finish-chapter-line"><em>point of view.</em></span></h2>
            <p className="finish-chapter-description">The moment stays with you. Choose the color that makes it yours.</p>
            <div className="finish-chapter-selection" aria-live="polite" aria-atomic="true">
              <span className="finish-chapter-number">0{active + 1} <span>/ 0{colors.length}</span></span>
              <span className="finish-chapter-selection-text"><strong>{selected.name}</strong><small>{finishNotes[selected.name]}</small></span>
            </div>
          </div>
          <div className="finish-chapter-visual" role="img" aria-label={`${selected.name} iPhone 18 Pro concept, rear and front views`}>
            <span className="finish-chapter-orbit" aria-hidden="true" />
            <span className="finish-chapter-monogram" aria-hidden="true">18</span>
            <div className="finish-chapter-lineup" aria-hidden="true">
              {colors.filter((_, index) => index !== active).map((color, index) => (
                <div key={color.name} className="finish-chapter-lineup-phone" style={{ "--finish-slot": [-2, -1, 1, 2][index], zIndex: index === 0 || index === 3 ? 0 : 1 } as CSSProperties}>
                  <Image src={color.image} alt="" fill sizes="(max-width: 700px) 55vw, 30vw" />
                </div>
              ))}
            </div>
            <div className="finish-chapter-device">
              {outgoing !== null && outgoing !== active && (
                <Image key={`out-${colors[outgoing].name}`} className="finish-chapter-phone is-outgoing" src={colors[outgoing].image} alt="" fill sizes="(max-width: 760px) 92vw, 48vw" />
              )}
              <Image key={selected.name} className="finish-chapter-phone is-current" src={selected.image} alt="" fill sizes="(max-width: 760px) 92vw, 48vw" />
              <span className="finish-chapter-light" aria-hidden="true" />
              <span key={`glint-${selected.name}`} className="finish-chapter-color-glint" aria-hidden="true" />
            </div>
            <div className="finish-chapter-detail" aria-hidden="true"><span>01 / SURFACE STUDY</span><strong>Made for the light.</strong><small>Rich color. Fine detail.</small></div>
            <div className="finish-chapter-beat" aria-hidden="true"><span className="is-light">01 — Into the light.</span><span className="is-color">02 — Five ways to make it yours.</span></div>
            <span className="finish-chapter-visual-label">iPHONE 18 PRO <span>•</span> {selected.name.toUpperCase()}</span>
          </div>
        </div>
        <span className="finish-chapter-cue" aria-hidden="true">SCROLL TO REVEAL <span>↓</span></span>
        <div className="finish-chapter-controls">
          <div className="finish-chapter-swatches" role="group" aria-label="Choose a phone finish" aria-hidden={!controlsReady}>
            {colors.map((color, index) => (
              <button key={color.name} className={`finish-chapter-swatch ${index === active ? "is-selected" : ""}`} style={{ "--finish-swatch-index": index } as CSSProperties} type="button" onClick={() => onSelect(index)} aria-label={`Choose ${color.name}`} aria-pressed={index === active} tabIndex={controlsReady ? 0 : -1}>
                <span className="finish-chapter-swatch-color" style={{ backgroundColor: color.outer }} />
                <span className="finish-chapter-swatch-label"><small>0{index + 1}</small>{color.name}</span>
              </button>
            ))}
          </div>
          <a className="finish-chapter-return" href="#story" tabIndex={controlsReady ? 0 : -1} aria-hidden={!controlsReady}>Revisit the camera <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
  );
}
