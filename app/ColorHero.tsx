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
const START = COUNT * 2;

function WelcomeLettering() {
  return (
    <svg viewBox="0 0 550 155" role="img" aria-label="welcome" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <path pathLength="1" d="M25 76 C22 112 31 129 46 108 L67 77 C61 106 70 129 84 110 L109 77" />
      <path pathLength="1" d="M108 103 C130 91 148 72 152 86 C156 98 126 106 116 104 C122 130 153 125 170 101" />
      <path pathLength="1" d="M169 101 C190 76 213 26 198 22 C176 15 175 100 184 116 C192 131 207 111 216 99" />
      <path pathLength="1" d="M256 86 C236 69 215 87 219 108 C224 126 247 124 266 101" />
      <path pathLength="1" d="M299 79 C278 74 269 113 284 121 C306 132 322 85 302 80 C311 97 326 104 339 94" />
      <path pathLength="1" d="M338 94 C349 78 350 83 348 98 L346 119 C355 98 369 77 379 84 C388 92 371 117 378 121 C391 93 406 76 416 85 C425 96 405 118 416 122 C431 127 447 101 458 91" />
      <path pathLength="1" d="M456 103 C477 90 495 72 499 86 C503 99 472 106 461 104 C468 130 503 126 525 98" />
    </svg>
  );
}

export default function ColorHero({ onExplore }: { onExplore: (section: string) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(START);
  const activeRef = useRef(0);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(0);
  const [baseIndex, setBaseIndex] = useState(0);
  const [ripple, setRipple] = useState<{ index: number; key: number } | null>(null);
  const [position, setPosition] = useState(START);
  const [resetting, setResetting] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: 1100, height: 700 });
  const [curtainOpening, setCurtainOpening] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [entranceDone, setEntranceDone] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setIntroDone(true);
      setSceneReady(true);
      setEntranceDone(true);
      setPlaying(false);
      return;
    }
    const timers = [
      setTimeout(() => setCurtainOpening(true), 1050),
      setTimeout(() => setSceneReady(true), 2150),
      setTimeout(() => setIntroDone(true), 2450),
      setTimeout(() => setEntranceDone(true), 4050),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => setPanelSize({ width: panel.clientWidth, height: panel.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => { if (rippleTimer.current) clearTimeout(rippleTimer.current); }, []);

  const advance = useCallback((distance: number) => {
    if (!distance) return;
    const previous = activeRef.current;
    const nextPosition = positionRef.current + distance;
    const nextActive = ((nextPosition % COUNT) + COUNT) % COUNT;
    positionRef.current = nextPosition;
    activeRef.current = nextActive;
    setPosition(nextPosition);
    setActive(nextActive);
    if (rippleTimer.current) {
      clearTimeout(rippleTimer.current);
      setBaseIndex(previous);
    }
    setRipple({ index: nextActive, key: Date.now() });
    rippleTimer.current = setTimeout(() => {
      setBaseIndex(nextActive);
      setRipple(null);
      rippleTimer.current = null;
    }, 1060);
  }, []);

  useEffect(() => {
    if (!entranceDone || !playing) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && panelRef.current && panelRef.current.getBoundingClientRect().bottom > 0) advance(1);
    }, 3200);
    return () => clearInterval(interval);
  }, [advance, entranceDone, playing]);

  const normalize = () => {
    const current = positionRef.current;
    if (current >= COUNT * 3 || current < COUNT * 2) {
      const next = ((current % COUNT) + COUNT) % COUNT + START;
      positionRef.current = next;
      setResetting(true);
      setPosition(next);
      requestAnimationFrame(() => requestAnimationFrame(() => setResetting(false)));
    }
  };

  const theme = colors[active];
  const base = colors[baseIndex];
  useEffect(() => {
    document.documentElement.style.setProperty("--header-ink", theme.ink);
  }, [theme.ink]);
  const themeStyle = {
    "--hero-outer": base.outer,
    "--hero-stage": base.stage,
    "--hero-glow": theme.glow,
    "--hero-ink": theme.ink,
  } as CSSProperties;

  return (
    <>
      {!introDone && (
        <div className={`opening-curtain ${curtainOpening ? "is-opening" : ""}`} aria-hidden="true">
          <div className="curtain-half curtain-left" />
          <div className="curtain-half curtain-right" />
          <span className="curtain-word"><WelcomeLettering /></span>
        </div>
      )}
      <section id="top" className={`reel-hero color-hero ${sceneReady ? "scene-ready" : ""} ${entranceDone ? "entrance-complete" : ""}`} style={themeStyle} aria-label="Explore iPhone 18 Pro colors">
        {ripple && <div key={`outer-${ripple.key}`} className="hero-ripple hero-ripple-outer" style={{ backgroundColor: colors[ripple.index].outer }} />}
        <div ref={panelRef} className="reel-panel color-panel">
          {ripple && <div key={`stage-${ripple.key}`} className="hero-ripple hero-ripple-stage" style={{ backgroundColor: colors[ripple.index].stage }} />}
          <div className="color-glow" />
          <div className="reel-panel-top">
            <span className="reel-mark">iPhone 18 Pro</span>
            <span className="color-count">0{active + 1} <span>/ 0{COUNT}</span></span>
            <button className="reel-mini-action" onClick={() => onExplore("overview")} aria-label="Explore the site">↗</button>
          </div>

          <div className="color-rail" aria-label="Phone color carousel">
            {Array.from({ length: COUNT * 5 }, (_, virtualIndex) => {
              const relative = virtualIndex - position;
              const distance = Math.abs(relative);
              const x = relative * panelSize.width * 0.235;
              const y = relative * relative * panelSize.height * 0.043;
              const entryX = sceneReady ? 0 : relative < 0 ? -panelSize.width : panelSize.width;
              const color = colors[virtualIndex % COUNT];
              const style = {
                transform: `translate3d(calc(-50% + ${x + entryX}px), ${y}px, 0) rotate(${relative * 9}deg) scale(${Math.max(0.78, 1 - distance * 0.055)})`,
                opacity: distance > 3.45 ? 0 : sceneReady ? 1 : 0,
                pointerEvents: distance <= 2.7 && sceneReady ? "auto" : "none",
                transitionDelay: sceneReady && !entranceDone ? `${0.65 + Math.min(distance, 3) * 0.09}s` : "0s",
              } as CSSProperties;
              return (
                <button
                  type="button"
                  key={virtualIndex}
                  className={`color-card ${resetting ? "no-transition" : ""}`}
                  style={style}
                  onClick={() => advance(relative)}
                  onTransitionEnd={(event) => {
                    if (event.target === event.currentTarget && event.propertyName === "transform") normalize();
                  }}
                  aria-label={`Show ${color.name} iPhone`}
                  aria-hidden={distance > 2.7}
                  tabIndex={distance > 2.7 ? -1 : 0}
                >
                  <Image src={color.image} alt="" fill loading="eager" sizes="(max-width: 700px) 110px, 180px" />
                  <span>{color.name}</span>
                </button>
              );
            })}
          </div>

          <div className="hero-rock" aria-hidden="true"><Image src="/assets/moss-rock.png" alt="" fill priority sizes="(max-width: 700px) 100vw, 85vw" /></div>
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
          <div className="color-hint"><button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause color animation" : "Play color animation"}>{playing ? "Ⅱ" : "▶"}</button><span>{playing ? "COLORS IN MOTION" : "MOTION PAUSED"}</span></div>
        </div>
        <div className="color-footer"><span>THE NEW PRO, IN COLOR</span><span>AN INDEPENDENT CONCEPT</span></div>
      </section>
    </>
  );
}

