"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const colors = [
  { name: "Burgundy", image: "/assets/iphone-burgundy.png", outer: "#672738", stage: "#2c101c", glow: "#8e3951", ink: "#fff4f1" },
  { name: "Pearl", image: "/assets/iphone-pearl.png", outer: "#d6d0ca", stage: "#b9b2ac", glow: "#f2eee8", ink: "#2d2527" },
  { name: "Graphite", image: "/assets/iphone-pair.png", outer: "#57585a", stage: "#202124", glow: "#67696a", ink: "#f8f7f3" },
  { name: "Sage", image: "/assets/iphone-sage.png", outer: "#718579", stage: "#243e34", glow: "#5b806d", ink: "#f4f7f1" },
  { name: "Midnight", image: "/assets/iphone-midnight.png", outer: "#344c70", stage: "#10233f", glow: "#315b91", ink: "#f2f6ff" },
] as const;

const COUNT = colors.length;
const START = COUNT * 4;
const WHEEL_DURATION = 3200;
const ENTRANCE_TRAVEL = 2;

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const smoothstep = (progress: number) => progress * progress * (3 - 2 * progress);

function WelcomeLettering() {
  return (
    <svg viewBox="0 0 550 155" role="img" aria-label="welcome" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
      <path pathLength="1" d="M25 76 C22 112 31 129 46 108 L67 77 C61 106 70 129 84 110 L109 77 C112 87 111 97 108 103 C130 91 148 72 152 86 C156 98 126 106 116 104 C122 130 153 125 170 101 C190 76 213 26 198 22 C176 15 175 100 184 116 C192 131 207 111 216 99 C225 84 241 77 253 84 C258 87 252 91 247 88 C235 81 220 91 220 106 C220 121 245 125 266 101 C276 83 291 76 299 79 C278 74 269 113 284 121 C306 132 322 85 302 80 C311 97 326 104 339 94 C349 78 350 83 348 98 L346 119 C355 98 369 77 379 84 C388 92 371 117 378 121 C391 93 406 76 416 85 C425 96 405 118 416 122 C431 127 447 101 458 91 C460 98 460 101 456 103 C477 90 495 72 499 86 C503 99 472 106 461 104 C468 130 503 126 525 98" />
    </svg>
  );
}

export default function ColorHero() {
  const heroRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(START);
  const activeRef = useRef(0);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [baseIndex, setBaseIndex] = useState(0);
  const [ripple, setRipple] = useState<{ index: number; key: number } | null>(null);
  const [position, setPosition] = useState(START);
  const [resetting, setResetting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: 1100, height: 700 });
  const [wordFading, setWordFading] = useState(false);
  const [showSeam, setShowSeam] = useState(false);
  const [curtainOpening, setCurtainOpening] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [wheelStarted, setWheelStarted] = useState(false);
  const [wheelProgress, setWheelProgress] = useState(0);
  const [entranceDone, setEntranceDone] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [autoplayEpoch, setAutoplayEpoch] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    let current = 0;
    let target = 0;
    let lastTime = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = (now: number) => {
      const elapsed = Math.min(64, lastTime ? now - lastTime : 16);
      lastTime = now;
      current += (target - current) * (1 - Math.exp(-elapsed / 140));
      if (Math.abs(target - current) < 0.0001) current = target;
      setScrollProgress(current);
      frame = current === target ? 0 : requestAnimationFrame(animate);
    };
    const measure = () => {
      const hero = heroRef.current;
      if (!hero) return;
      const distance = Math.max(1, hero.offsetHeight - window.innerHeight);
      target = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / distance));
      if (reducedMotion) {
        setScrollProgress(target);
      } else if (!frame) {
        lastTime = 0;
        frame = requestAnimationFrame(animate);
      }
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setIntroDone(true);
      setSceneReady(true);
      setWheelStarted(true);
      setWheelProgress(1);
      setEntranceDone(true);
      setAutoPlay(false);
      return;
    }
    const timers = [
      setTimeout(() => setWordFading(true), 4450),
      setTimeout(() => setShowSeam(true), 5050),
      setTimeout(() => setCurtainOpening(true), 5500),
      setTimeout(() => setIntroDone(true), 7100),
      setTimeout(() => setSceneReady(true), 7150),
      setTimeout(() => setWheelStarted(true), 10150),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!wheelStarted || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (now: number) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / WHEEL_DURATION, 1);
      setWheelProgress(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
      else setEntranceDone(true);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [wheelStarted]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => setPanelSize({ width: panel.clientWidth, height: panel.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (rippleTimer.current) clearTimeout(rippleTimer.current);
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
  }, []);

  const advance = useCallback((distance: number) => {
    if (!distance) return;
    const previous = activeRef.current;
    const nextPosition = positionRef.current + distance;
    const nextActive = ((nextPosition % COUNT) + COUNT) % COUNT;
    positionRef.current = nextPosition;
    activeRef.current = nextActive;
    setPosition(nextPosition);
    setOutgoing(previous);
    setActive(nextActive);
    if (rippleTimer.current) {
      clearTimeout(rippleTimer.current);
      setBaseIndex(previous);
    }
    setRipple({ index: nextActive, key: Date.now() });
    rippleTimer.current = setTimeout(() => {
      setBaseIndex(nextActive);
      setRipple(null);
      setOutgoing(null);
      rippleTimer.current = null;
    }, 1330);
  }, []);

  const carouselVisible = scrollProgress <= 0.04;
  useEffect(() => {
    if (!entranceDone || !autoPlay || !carouselVisible) return;
    const tick = () => {
      if (document.visibilityState === "visible" && panelRef.current && panelRef.current.getBoundingClientRect().bottom > 0) advance(1);
      autoAdvanceTimer.current = setTimeout(tick, 3200);
    };
    autoAdvanceTimer.current = setTimeout(tick, 3200);
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    };
  }, [advance, entranceDone, autoPlay, autoplayEpoch, carouselVisible]);

  const selectCard = (distance: number) => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = null;
    setAutoplayEpoch((epoch) => epoch + 1);
    advance(distance);
  };

  const normalize = () => {
    const current = positionRef.current;
    if (current >= START + COUNT || current < START) {
      const next = ((current % COUNT) + COUNT) % COUNT + START;
      positionRef.current = next;
      setResetting(true);
      setPosition(next);
      requestAnimationFrame(() => requestAnimationFrame(() => setResetting(false)));
    }
  };

  const theme = colors[active];
  const base = colors[baseIndex];
  const reveal = smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.06) / 0.34)));
  const motion = smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.13) / 0.74)));
  const storyOpacity = smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.28)));
  const pairOpacity = 1 - smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.22) / 0.16)));
  const railOpacity = 1 - smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.01) / 0.1)));
  const shift = panelSize.width * (panelSize.width < 670 ? 0.03 : 0.225) * motion;
  const phoneShift = shift - panelSize.width * 0.05 * (1 - motion);
  const phoneTop = mix(panelSize.width < 670 ? 40 : 41, panelSize.width < 670 ? 65 : 49, motion);
  const phoneHeight = mix(panelSize.width < 670 ? 55 : 66, panelSize.width < 670 ? 37 : 66, motion);
  useEffect(() => {
    document.documentElement.style.setProperty("--header-ink", theme.ink);
  }, [theme.ink]);
  const themeStyle = {
    "--hero-outer": base.outer,
    "--hero-stage": base.stage,
    "--hero-border-stage": `color-mix(in srgb, ${theme.stage}, ${colors[0].stage} ${storyOpacity * 100}%)`,
    "--hero-border-outer": `color-mix(in srgb, ${theme.outer}, ${colors[0].outer} ${storyOpacity * 100}%)`,
    "--hero-glow": theme.glow,
    "--hero-ink": theme.ink,
  } as CSSProperties;

  return (
    <>
      {!introDone && (
        <div className={`opening-curtain ${wordFading ? "is-word-fading" : ""} ${showSeam ? "has-seam" : ""} ${curtainOpening ? "is-opening" : ""}`} aria-hidden="true">
          <div className="curtain-half curtain-left" />
          <div className="curtain-half curtain-right" />
          <span className="curtain-seam" />
          <span className="curtain-word"><WelcomeLettering /></span>
        </div>
      )}
      <section ref={heroRef} id="top" className={`reel-hero color-hero ${sceneReady ? "scene-ready" : ""} ${entranceDone ? "entrance-complete" : ""} ${scrollProgress > 0.001 ? "is-scrolling" : ""}`} style={themeStyle} aria-label="Explore iPhone 18 Pro colors and design">
        <span id="story" className="story-anchor" aria-hidden="true" />
        <div className="color-stage">
          {ripple && <div key={`outer-${ripple.key}`} className="hero-ripple hero-ripple-outer" style={{ backgroundColor: colors[ripple.index].outer }} />}
          <div className="scroll-outer-wash" style={{ opacity: storyOpacity }} />
          <div ref={panelRef} className="reel-panel color-panel">
          {ripple && <div key={`stage-${ripple.key}`} className="hero-ripple hero-ripple-stage" style={{ backgroundColor: colors[ripple.index].stage }} />}
          <div className="color-glow" />
          <div className="reel-panel-top" style={{ opacity: 1 - reveal }}>
            <span className="color-count">0{active + 1} <span>/ 0{COUNT}</span></span>
          </div>

          <div className="color-rail" aria-label="Phone color carousel">
            {mounted && Array.from({ length: COUNT * 5 }, (_, index) => START - COUNT * 2 + index).map((virtualIndex) => {
              // Move two card slots along the final arc. Ending at the real position
              // keeps every card on the same path when autoplay takes over.
              const travel = ENTRANCE_TRAVEL * (1 - smoothstep(wheelProgress));
              const arcPosition = position - travel;
              const arcRelative = virtualIndex - arcPosition;
              const relative = virtualIndex - position;
              const distance = Math.abs(arcRelative);
              const lift = smoothstep(Math.min(wheelProgress / 0.78, 1));
              const x = arcRelative * panelSize.width * 0.235 * mix(0.78, 1, lift);
              const y = arcRelative * arcRelative * panelSize.height * 0.043 + panelSize.height * 0.52 * (1 - lift);
              const scale = Math.max(0.78, 1 - distance * 0.055) * mix(0.78, 1, lift);
              const rotation = arcRelative * 9;
              const color = colors[virtualIndex % COUNT];
              const xOffset = `${x < 0 ? "-" : "+"} ${Number(Math.abs(x).toFixed(3))}px`;
              const style = {
                transform: `translate3d(calc(-50% ${xOffset}), ${Number(y.toFixed(3))}px, 0px) rotate(${Number(rotation.toFixed(3))}deg) scale(${Number(scale.toFixed(4))})`,
                opacity: wheelStarted ? Math.min(1, wheelProgress * 3) * Math.max(0, Math.min(1, 3 - distance)) * railOpacity : 0,
                pointerEvents: entranceDone && scrollProgress < 0.04 && Math.abs(relative) <= 2 ? "auto" : "none",
              } as CSSProperties;
              return (
                <button
                  type="button"
                  key={virtualIndex}
                  className={`color-card ${resetting || !entranceDone ? "no-transition" : ""}`}
                  style={style}
                  onClick={() => selectCard(relative)}
                  onTransitionEnd={(event) => {
                    if (event.target === event.currentTarget && event.propertyName === "transform") normalize();
                  }}
                  aria-label={`Show ${color.name} iPhone`}
                  aria-hidden={!entranceDone || !carouselVisible || Math.abs(relative) > 2}
                  tabIndex={!entranceDone || !carouselVisible || Math.abs(relative) > 2 ? -1 : 0}
                >
                  <Image src={color.image} alt="" fill loading="eager" sizes="(max-width: 700px) 110px, 180px" />
                  <span>{color.name}</span>
                </button>
              );
            })}
          </div>

          <div className="hero-rock" aria-hidden="true" style={sceneReady ? { opacity: 1 - reveal } : undefined}><Image src="/assets/moss-rock.png" alt="" fill priority sizes="(max-width: 700px) 100vw, 85vw" /></div>
          <div className="color-product" aria-live="polite" style={sceneReady ? { opacity: pairOpacity, transform: `translate(calc(-50% + ${Number(shift.toFixed(2))}px), -50%) scale(${Number((1 - motion * 0.17).toFixed(4))})` } : undefined}>
            {colors.map((color, index) => (
              <Image
                key={color.name}
                src={color.image}
                alt={index === active ? `${color.name} iPhone 18 Pro concept pair` : ""}
                fill
                priority={index === 0}
                sizes="(max-width: 700px) 85vw, 43vw"
                className={index === active ? "visible" : index === outgoing ? "outgoing" : ""}
              />
            ))}
          </div>
          {entranceDone && <div className="color-product-caption" key={theme.name} style={{ opacity: 1 - reveal, animation: reveal > 0 ? "none" : undefined }}>{theme.name}</div>}
          <div className="color-heading" style={{ opacity: 1 - reveal }}><h1>Choose your perspective.</h1></div>
          <div className="scroll-scene" aria-hidden={storyOpacity < 0.75}>
            <div className="scroll-scene-backdrop" style={{ opacity: storyOpacity }} />
            <div className="scroll-scene-glow" style={{ opacity: storyOpacity }} />
            <div className="scroll-copy" style={{ opacity: smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.4) / 0.35))), transform: `translateY(${Number(((1 - motion) * 42).toFixed(2))}px)` }}>
              <p className="scroll-kicker">01 / THE FORM</p>
              <h2>Every angle,<br /><em>considered.</em></h2>
              <p className="scroll-description">A new perspective on the finish that defines the Pro.</p>
              <span className="scroll-rule" />
            </div>
            <div className="design-placeholder" style={{ opacity: smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.34) / 0.4))) }}>
              <span>BURGUNDY</span><span>18 / PRO</span>
            </div>
            <div className="scroll-phone-position" style={{ top: `${phoneTop}%`, height: `${phoneHeight}%`, transform: `translate3d(calc(-50% + ${Number(phoneShift.toFixed(2))}px), -50%, 0)`, opacity: smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.11) / 0.05))) }}>
              <div className="scroll-phone-object" role="img" aria-label="Burgundy iPhone rear rotating into its display" style={{ transform: `rotateY(${Number((144 + motion * 58).toFixed(2))}deg) rotateZ(${Number((motion * 4).toFixed(2))}deg)` }}>
                <div className="scroll-phone-core" />
                <div className="scroll-phone-edge scroll-phone-edge-left" />
                <div className="scroll-phone-edge scroll-phone-edge-right" />
                <div className="scroll-phone-face scroll-phone-front"><Image src="/assets/iphone-burgundy-front-3d.png" alt="" fill priority sizes="(max-width: 700px) 60vw, 30vw" /></div>
                <div className="scroll-phone-face scroll-phone-back"><Image src="/assets/iphone-burgundy-back-3d.png" alt="" fill priority sizes="(max-width: 700px) 60vw, 30vw" /></div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>
    </>
  );
}

