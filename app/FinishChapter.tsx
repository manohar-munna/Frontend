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

export default function FinishChapter({ colors, active, outgoing, onSelect }: FinishChapterProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const selected = colors[active];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const style = {
    "--finish-stage": selected.stage,
    "--finish-outer": selected.outer,
    "--finish-glow": selected.glow,
    "--finish-ink": selected.ink,
  } as CSSProperties;

  return (
    <section ref={sectionRef} id="finishes" className={`finish-chapter ${visible ? "is-visible" : ""}`} style={style} aria-labelledby="finish-title">
      <div className="finish-chapter-inner">
        <div className="finish-chapter-eyebrow"><span>04 / THE FINISH</span><span>FIVE POINTS OF VIEW</span></div>
        <div className="finish-chapter-stage">
          <div className="finish-chapter-copy">
            <p className="finish-chapter-overline">DESIGNED TO FEEL PERSONAL</p>
            <h2 id="finish-title">A finish for<br />every <em>point of view.</em></h2>
            <p className="finish-chapter-description">The moment stays with you. Choose the color that makes it yours.</p>
            <div className="finish-chapter-selection" aria-live="polite" aria-atomic="true">
              <span className="finish-chapter-number">0{active + 1} <span>/ 0{colors.length}</span></span>
              <span className="finish-chapter-selection-text"><strong>{selected.name}</strong><small>{finishNotes[selected.name]}</small></span>
            </div>
          </div>
          <div className="finish-chapter-visual" role="img" aria-label={`${selected.name} iPhone 18 Pro concept, rear and front views`}>
            <span className="finish-chapter-orbit" aria-hidden="true" />
            <span className="finish-chapter-monogram" aria-hidden="true">18</span>
            {outgoing !== null && outgoing !== active && (
              <Image key={`out-${colors[outgoing].name}`} className="finish-chapter-phone is-outgoing" src={colors[outgoing].image} alt="" fill sizes="(max-width: 760px) 92vw, 48vw" />
            )}
            <Image key={selected.name} className="finish-chapter-phone is-current" src={selected.image} alt="" fill sizes="(max-width: 760px) 92vw, 48vw" />
            <span className="finish-chapter-visual-label">iPHONE 18 PRO <span>•</span> {selected.name.toUpperCase()}</span>
          </div>
        </div>
        <div className="finish-chapter-controls">
          <div className="finish-chapter-swatches" role="group" aria-label="Choose a phone finish">
            {colors.map((color, index) => (
              <button key={color.name} className={`finish-chapter-swatch ${index === active ? "is-selected" : ""}`} type="button" onClick={() => onSelect(index)} aria-label={`Choose ${color.name}`} aria-pressed={index === active}>
                <span className="finish-chapter-swatch-color" style={{ backgroundColor: color.outer }} />
                <span className="finish-chapter-swatch-label"><small>0{index + 1}</small>{color.name}</span>
              </button>
            ))}
          </div>
          <a className="finish-chapter-return" href="#story">Revisit the camera <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
  );
}
