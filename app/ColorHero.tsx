"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ThreePhone from "./ThreePhone";

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

function HelloLettering() {
  return (
    <svg viewBox="0 0 286 156" role="img" aria-label="hello" fill="none" stroke="currentColor" strokeWidth="6.8" strokeLinecap="round" strokeLinejoin="round">
      <path pathLength="1" d="M29 108 C44 100 50 94 53 81 C56 63 57 43 64 43 C72 42 76 47 72 59 C69 72 58 94 51 112 C54 100 62 80 71 80 C80 81 74 99 77 107 C80 117 91 111 98 96 C102 86 108 80 115 81 C126 82 119 96 105 101 C101 102 99 101 98 100 C102 114 112 117 122 112 C137 105 145 85 150 63 C152 54 154 42 161 42 C171 43 166 59 158 78 C150 96 144 110 147 113 C152 119 165 104 172 94 C180 81 184 59 189 46 C192 40 200 42 200 51 C200 66 185 92 181 105 C178 115 188 118 196 109 C202 104 207 95 211 88 C218 79 231 77 237 84 C244 92 240 107 232 112 C222 118 212 111 212 101 C212 90 222 79 232 80 C240 81 240 88 244 89 C250 90 255 83 258 76" />
    </svg>
  );
}

export default function ColorHero() {
  const heroRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLDivElement>(null);
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
  const [productSize, setProductSize] = useState({ width: 560, height: 504 });
  const [wordFading, setWordFading] = useState(false);
  const [showSeam, setShowSeam] = useState(false);
  const [introCued, setIntroCued] = useState(false);
  const [curtainOpening, setCurtainOpening] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [wheelStarted, setWheelStarted] = useState(false);
  const [wheelProgress, setWheelProgress] = useState(0);
  const [entranceDone, setEntranceDone] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [autoplayEpoch, setAutoplayEpoch] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const modelReady = modelStatus === "ready";
  const handleModelReady = useCallback((ready: boolean) => setModelStatus(ready ? "ready" : "unavailable"), []);

  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload") return;

    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      setScrollProgress(0);
    };
    resetScroll();
    window.addEventListener("pageshow", resetScroll);
    return () => {
      window.removeEventListener("pageshow", resetScroll);
      history.scrollRestoration = previousRestoration;
    };
  }, []);

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
      setTimeout(() => setIntroCued(true), 5500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!introCued || modelStatus === "loading") return;
    setCurtainOpening(true);
    const timers = [
      setTimeout(() => setIntroDone(true), 1600),
      setTimeout(() => setSceneReady(true), 1650),
      setTimeout(() => setWheelStarted(true), 4650),
    ];
    return () => timers.forEach(clearTimeout);
  }, [introCued, modelStatus]);

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
    const measure = () => {
      setPanelSize({ width: panel.clientWidth, height: panel.clientHeight });
      const product = productRef.current;
      if (product) setProductSize({ width: product.clientWidth, height: product.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    if (productRef.current) observer.observe(productRef.current);
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

  const selectCard = useCallback((distance: number) => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = null;
    setAutoplayEpoch((epoch) => epoch + 1);
    advance(distance);
  }, [advance]);

  const normalize = useCallback(() => {
    const current = positionRef.current;
    if (current >= START + COUNT || current < START) {
      const next = ((current % COUNT) + COUNT) % COUNT + START;
      positionRef.current = next;
      setResetting(true);
      setPosition(next);
      requestAnimationFrame(() => requestAnimationFrame(() => setResetting(false)));
    }
  }, []);

  const theme = colors[active];
  const base = colors[baseIndex];
  const reveal = smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.06) / 0.34)));
  const motion = smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.13) / 0.74)));
  const storyOpacity = smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.28)));
  const companionExit = smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.045) / 0.26)));
  const railOpacity = 1 - smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.01) / 0.1)));
  const mobile = panelSize.width < 670;
  // The 3D rear remains the same object from the opening pose through the turn.
  const assetScale = Math.min(productSize.width / 1200, productSize.height / 1310);
  const artWidth = 1200 * assetScale;
  const artHeight = 1310 * assetScale;
  const endScale = panelSize.height * (mobile ? 0.37 : 0.66) / (artHeight * (1136 / 1310));
  const productScale = mix(1, endScale, motion);
  const shift = panelSize.width * (mobile ? 0.03 : 0.225) * motion
    + artWidth * 0.15 * (productScale - 1 + motion);
  const topBase = mobile ? 40 : 41;
  const topShift = panelSize.height * (mix(topBase, mobile ? 65 : 49, motion) - topBase) / 100;
  const turn = smoothstep(Math.max(0, Math.min(1, (scrollProgress - 0.29) / 0.6)));
  const railCards = useMemo(() => mounted && Array.from({ length: COUNT * 5 }, (_, index) => START - COUNT * 2 + index).map((virtualIndex) => {
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
      opacity: wheelStarted ? Math.min(1, wheelProgress * 3) * Math.max(0, Math.min(1, 3 - distance)) : 0,
      pointerEvents: entranceDone && carouselVisible && Math.abs(relative) <= 2 ? "auto" : "none",
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
  }), [mounted, wheelProgress, position, panelSize, wheelStarted, entranceDone, carouselVisible, resetting, selectCard, normalize]);
  useEffect(() => {
    document.documentElement.style.setProperty("--header-ink", theme.ink);
  }, [theme.ink]);
  const themeStyle = {
    "--hero-outer": base.outer,
    "--hero-stage": base.stage,
    "--hero-border-stage": theme.stage,
    "--hero-border-outer": theme.outer,
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
          <span className="curtain-word"><HelloLettering /></span>
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

          <div className="color-rail" aria-label="Phone color carousel" style={{ opacity: railOpacity }}>
            {railCards}
          </div>

          <div className="hero-rock" aria-hidden="true" style={sceneReady ? { opacity: 1 - reveal } : undefined}><Image src="/assets/moss-rock.png" alt="" fill priority sizes="(max-width: 700px) 100vw, 85vw" /></div>
          <div ref={productRef} className="color-product" role="img" aria-label={`${theme.name} iPhone 18 Pro concept`} style={sceneReady ? { top: `${topBase}%`, transform: `translate(calc(-50% + ${shift}px), calc(-50% + ${topShift}px)) scale(${productScale})` } : undefined}>
            <div className="product-artboard" style={{ width: artWidth, height: artHeight }}>
              <svg className="phone-surface-masks" width="0" height="0" aria-hidden="true">
                <defs>
                  <clipPath id="phone-rear-surface" clipPathUnits="objectBoundingBox">
                    <path d="M0 0 H.44 V.045 Q.5125 .045 .5125 .14 V.86 Q.5125 .95 .44 .95 H0 Z" />
                  </clipPath>
                  <clipPath id="phone-rail-surface" clipPathUnits="objectBoundingBox">
                    <path clipRule="evenodd" d="M0 0 H.56 V.14 L.5525 .15 V1 H0 Z M0 0 H.44 V.045 Q.5125 .045 .5125 .14 V.86 Q.5125 .95 .44 .95 H0 Z" />
                  </clipPath>
                </defs>
              </svg>
              {(["companion", "rail", "main"] as const).map((part) => (
                <div key={part} className={`product-layer product-${part}`} style={part === "companion" ? {
                  opacity: 1 - companionExit,
                  transform: `translate3d(${-artWidth * 0.3 * companionExit}px, ${artHeight * 0.015 * companionExit}px, 0)`,
                } : {
                  opacity: modelReady ? 0 : 1,
                }}>
                  <div className="product-layer-source">
                    {colors.map((color, index) => ({ color, index })).filter(({ index }) => part === "companion" || !modelReady || index === active || index === outgoing).map(({ color, index }) => (
                      <Image
                        key={color.name}
                        src={color.image}
                        alt=""
                        fill
                        priority={index === 0}
                        sizes="(max-width: 700px) 85vw, 43vw"
                        style={part === "companion" && (index === 1 || index === 2) ? { filter: "saturate(0)" } : undefined}
                        className={index === active ? "visible" : index === outgoing ? "outgoing" : ""}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="three-phone-layer" style={{ opacity: modelReady ? 1 : 0 }}>
                <ThreePhone color={theme.name} turn={turn} onReady={handleModelReady} />
              </div>
            </div>
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
              <span>{theme.name.toUpperCase()}</span><span>18 / PRO</span>
            </div>
          </div>
        </div>
        </div>
      </section>
    </>
  );
}

