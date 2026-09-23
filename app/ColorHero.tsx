"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const colors = [
  { name: "Burgundy", image: "/assets/iphone-burgundy.png", outer: "#672738", stage: "#2c101c", glow: "#8e3951", ink: "#fff4f1" },
  { name: "Pearl", image: "/assets/iphone-pearl.png", outer: "#d6d0ca", stage: "#b9b2ac", glow: "#f2eee8", ink: "#2d2527" },
  { name: "Graphite", image: "/assets/iphone-pair.png", outer: "#57585a", stage: "#202124", glow: "#67696a", ink: "#f8f7f3" },
  { name: "Sage", image: "/assets/iphone-sage.png", outer: "#718579", stage: "#243e34", glow: "#5b806d", ink: "#f4f7f1" },
] as const;

const COUNT = colors.length;
const START = COUNT;

export default function ColorHero({ onExplore }: { onExplore: (section: string) => void }) {
  const heroRef = useRef<HTMLElement>(null);
  const trackIndexRef = useRef<number>(START);
  const activeRef = useRef(0);
  const wheelStepsRef = useRef(0);
  const lastWheelRef = useRef(0);
  const [active, setActive] = useState(0);
  const [trackIndex, setTrackIndex] = useState<number>(START);
  const [jumping, setJumping] = useState(false);
  const [trackGeometry, setTrackGeometry] = useState({ width: 172, gap: 115 });
  const [curtainOpening, setCurtainOpening] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const introDoneRef = useRef(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      introDoneRef.current = true;
      setIntroDone(true);
      return;
    }
    const openTimer = setTimeout(() => setCurtainOpening(true), 1050);
    const finishTimer = setTimeout(() => {
      introDoneRef.current = true;
      setIntroDone(true);
    }, 2400);
    return () => { clearTimeout(openTimer); clearTimeout(finishTimer); };
  }, []);

  useEffect(() => {
    const measure = () => {
      const card = heroRef.current?.querySelector<HTMLElement>(".color-card");
      const track = heroRef.current?.querySelector<HTMLElement>(".color-track");
      if (!card || !track) return;
      setTrackGeometry({ width: card.getBoundingClientRect().width, gap: parseFloat(getComputedStyle(track).gap) || 0 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const move = useCallback((distance: number) => {
    if (distance === 0) return;
    const next = trackIndexRef.current + distance;
    trackIndexRef.current = next;
    const nextActive = ((next % COUNT) + COUNT) % COUNT;
    activeRef.current = nextActive;
    setTrackIndex(next);
    setActive(nextActive);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onWheel = (event: WheelEvent) => {
      const rect = hero.getBoundingClientRect();
      if (rect.top < -30 || rect.bottom < window.innerHeight * .7) return;
      if (!introDoneRef.current) { event.preventDefault(); return; }
      if (Math.abs(event.deltaY) < 8) return;
      const direction = event.deltaY > 0 ? 1 : -1;
      if (direction > 0 && wheelStepsRef.current >= COUNT) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelRef.current < 850) return;
      lastWheelRef.current = now;
      wheelStepsRef.current = Math.max(0, wheelStepsRef.current + direction);
      move(direction);
    };
    hero.addEventListener("wheel", onWheel, { passive: false });
    return () => hero.removeEventListener("wheel", onWheel);
  }, [move]);

  const normalizeTrack = () => {
    const current = trackIndexRef.current;
    if (current < COUNT || current >= COUNT * 2) {
      const normalized = ((current % COUNT) + COUNT) % COUNT + COUNT;
      setJumping(true);
      trackIndexRef.current = normalized;
      setTrackIndex(normalized);
      requestAnimationFrame(() => requestAnimationFrame(() => setJumping(false)));
    }
  };

  const selectColor = (index: number) => {
    const current = activeRef.current;
    let distance = index - current;
    if (distance > COUNT / 2) distance -= COUNT;
    if (distance < -COUNT / 2) distance += COUNT;
    move(distance);
    wheelStepsRef.current = Math.max(wheelStepsRef.current, index);
  };

  const theme = colors[active];
  useEffect(() => {
    document.documentElement.style.setProperty("--header-ink", theme.ink);
  }, [theme.ink]);
  const themeStyle = {
    "--hero-outer": theme.outer,
    "--hero-stage": theme.stage,
    "--hero-glow": theme.glow,
    "--hero-ink": theme.ink,
  } as CSSProperties;

  return (
    <>
      {!introDone && (
        <div className={`opening-curtain ${curtainOpening ? "is-opening" : ""}`} aria-hidden="true">
          <div className="curtain-half curtain-left" />
          <div className="curtain-half curtain-right" />
          <span className="curtain-word">welcome</span>
        </div>
      )}
      <section ref={heroRef} id="top" className="reel-hero color-hero" style={themeStyle} aria-label="Explore iPhone 18 Pro colors">
        <div className="reel-panel color-panel">
          <div className="color-glow" />
          <div className="reel-panel-top">
            <span className="reel-mark">iPhone 18 Pro</span>
            <span className="color-count">0{active + 1} <span>/ 0{COUNT}</span></span>
            <button className="reel-mini-action" onClick={() => onExplore("overview")} aria-label="Explore the site">↗</button>
          </div>

          <div className="color-rail" aria-label="Phone color carousel">
            <div className={`color-track ${jumping ? "no-transition" : ""}`} style={{ transform: `translate3d(${-((trackIndex * (trackGeometry.width + trackGeometry.gap)) + trackGeometry.width / 2)}px, -50%, 0)` }} onTransitionEnd={(event) => {
              if (event.target === event.currentTarget && event.propertyName === "transform") normalizeTrack();
            }}>
              {[0, 1, 2].flatMap((copy) => colors.map((color, index) => (
                <button
                  type="button"
                  key={`${copy}-${color.name}`}
                  className="color-card"
                  onClick={() => selectColor(index)}
                  aria-label={`Show ${color.name} iPhone`}
                  aria-hidden={copy !== 1}
                  tabIndex={copy === 1 ? 0 : -1}
                >
                  <Image src={color.image} alt="" fill sizes="(max-width: 700px) 130px, 180px" />
                  <span>{color.name}</span>
                </button>
              )))}
            </div>
          </div>

          <div className="color-product" aria-live="polite">
            {colors.map((color, index) => (
              <Image
                key={color.name}
                src={color.image}
                alt={index === active ? `${color.name} iPhone 18 Pro concept pair` : ""}
                fill
                priority={index === 0}
                sizes="(max-width: 700px) 85vw, 43vw"
                className={index === active ? "visible" : ""}
              />
            ))}
          </div>
          <div className="color-product-caption" key={theme.name}>{theme.name}</div>
          <button className="color-explore" onClick={() => onExplore("finishes")}>Explore finishes <span>↗</span></button>
          <div className="color-heading"><span>iPhone 18 Pro</span><h1>Choose your perspective.</h1></div>
          <div className="color-hint"><span>SCROLL TO CHANGE COLOR</span><span>↓</span></div>
        </div>
        <div className="color-footer"><span>THE NEW PRO, IN COLOR</span><span>AN INDEPENDENT CONCEPT</span></div>
      </section>
    </>
  );
}
