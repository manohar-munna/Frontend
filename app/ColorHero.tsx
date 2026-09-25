"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ThreePhone from "./ThreePhone";

const colors = [
  { name: "Burgundy", image: "/assets/iphone-burgundy.png", outer: "#672738", stage: "#2c101c", glow: "#8e3951", ink: "#fff4f1", cameraStage: "#45202e", cameraPanel: "#171118", cameraAccent: "#dca8b9" },
  { name: "Pearl", image: "/assets/iphone-pearl.png", outer: "#d6d0ca", stage: "#b9b2ac", glow: "#f2eee8", ink: "#2d2527", cameraStage: "#77736e", cameraPanel: "#242321", cameraAccent: "#e5d9cd" },
  { name: "Graphite", image: "/assets/iphone-pair.png", outer: "#57585a", stage: "#202124", glow: "#67696a", ink: "#f8f7f3", cameraStage: "#37383b", cameraPanel: "#17181a", cameraAccent: "#c6c8ca" },
  { name: "Sage", image: "/assets/iphone-sage.png", outer: "#718579", stage: "#243e34", glow: "#5b806d", ink: "#f4f7f1", cameraStage: "#345143", cameraPanel: "#14211b", cameraAccent: "#a9cbb5" },
  { name: "Midnight", image: "/assets/iphone-midnight.png", outer: "#344c70", stage: "#10233f", glow: "#315b91", ink: "#f2f6ff", cameraStage: "#213d64", cameraPanel: "#101725", cameraAccent: "#9db9e5" },
] as const;

const COUNT = colors.length;
const START = COUNT * 4;
const WHEEL_DURATION = 2800;
const ENTRANCE_TRAVEL = 2;

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
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
  const productRef = useRef<HTMLDivElement>(null);
  const skaterRef = useRef<HTMLButtonElement>(null);
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
      const gap = target - current;
      // A gentle wheel movement gets enough frames to show the short optical
      // beats. A deliberate long scroll raises the playback rate, while the
      // per-frame cap still prevents jumping over the iris and lens entirely.
      const intent = smoothstep(clamp01((Math.abs(gap) - 0.025) / 0.22));
      const maxRate = mix(0.25, 0.85, intent) * elapsed / 1000;
      const easedStep = Math.abs(gap) * (1 - Math.exp(-elapsed / 48));
      current += Math.sign(gap) * Math.min(Math.abs(gap), easedStep, maxRate);
      if (Math.abs(target - current) < 0.00025) current = target;
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

  // Preserve the original phone journey, then spend the remaining scroll
  // distance moving through the optics and settling the photo into a display.
  const cameraProgress = clamp01(scrollProgress * (5 / 3));
  const carouselVisible = cameraProgress <= 0.04 * 0.54;
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
  const phaseOne = clamp01(cameraProgress / 0.54);
  const lensPhase = smoothstep(clamp01((cameraProgress - 0.54) / 0.18));
  const shutterPhase = smoothstep(clamp01((cameraProgress - 0.75) / 0.23));
  const scenePeek = smoothstep(clamp01((scrollProgress - 0.59) / 0.035));
  const apertureOpen = 0;
  const sceneExpansion = smoothstep(clamp01((scrollProgress - 0.785) / 0.04));
  const lensTravel = smoothstep(clamp01((scrollProgress - 0.65) / 0.135));
  const depthReveal = smoothstep(clamp01((scrollProgress - 0.84) / 0.035));
  const phoneSettle = smoothstep(clamp01((scrollProgress - 0.825) / 0.06));
  const displayReveal = smoothstep(clamp01((phoneSettle - 0.62) / 0.38));
  const cameraCopyFade = 1 - smoothstep(clamp01((scrollProgress - 0.615) / 0.035));
  const lensReveal = smoothstep(clamp01((lensPhase - 0.05) / 0.28));
  const reveal = smoothstep(clamp01((phaseOne - 0.06) / 0.34));
  const motion = smoothstep(clamp01((phaseOne - 0.13) / 0.74));
  const storyOpacity = smoothstep(clamp01((phaseOne - 0.2) / 0.28));
  const companionExit = smoothstep(clamp01((phaseOne - 0.045) / 0.26));
  const railOpacity = 1 - smoothstep(clamp01((phaseOne - 0.01) / 0.1));
  const mobile = panelSize.width < 670;
  const phoneWidth = Math.min(panelSize.width * (mobile ? 0.72 : 0.28), panelSize.height * (mobile ? 0.68 / 2.1 : 0.43));
  const phoneHeight = Math.min(panelSize.height * (mobile ? 0.68 : 0.83), phoneWidth * 2.1);
  const phoneWidthSettle = Math.pow(phoneSettle, 0.72);
  const sceneWidth = mix(panelSize.width, phoneWidth, phoneWidthSettle);
  const sceneHeight = mix(panelSize.height, phoneHeight, phoneSettle);
  const sceneLeft = (panelSize.width - sceneWidth) / 2;
  const sceneTop = (panelSize.height - sceneHeight) / 2;
  const frameOpacity = smoothstep(clamp01((phoneSettle - 0.72) / 0.28));
  const showModel = modelReady && entranceDone;
  // These are different silhouettes, so any alpha blend draws two outlines.
  // Switch at the aligned resting pose before the model starts its turn.
  const modelVisible = showModel && scrollProgress >= 0.018;
  const modelBlend = modelVisible ? 1 : 0;
  const photoOpacity = modelVisible ? 0 : 1;
  // The 3D rear remains the same object from the opening pose through the turn.
  const assetScale = Math.min(productSize.width / 1200, productSize.height / 1310);
  const artWidth = 1200 * assetScale;
  const artHeight = 1310 * assetScale;
  // Match the resting 3D rear to the pair photograph, then release the offset before the turn.
  const photoAlignment = 1 - smoothstep(clamp01((scrollProgress - 0.02) / 0.05));
  const endScale = panelSize.height * (mobile ? 0.37 : 0.66) / (artHeight * (1136 / 1310));
  const baseScale = mix(1, endScale, motion);
  const productScale = baseScale * mix(1, mobile ? 1.43 : 1.17, lensPhase);
  const shift = panelSize.width * (mobile ? 0.03 : 0.225) * motion
    + artWidth * 0.15 * (baseScale - 1 + motion)
    - panelSize.width * (mobile ? 0.19 : 0.49) * lensPhase;
  const topBase = mobile ? 40 : 41;
  const topShift = panelSize.height * (mix(topBase, mobile ? 65 : 49, motion) - topBase) / 100
    - panelSize.height * (mobile ? 0.09 : 0) * lensPhase;
  const turn = smoothstep(clamp01((phaseOne - 0.29) / 0.6));
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
    "--hero-camera-stage": theme.cameraStage,
    "--hero-camera-panel": theme.cameraPanel,
    "--hero-camera-accent": theme.cameraAccent,
    "--hero-display-accent": theme.name === "Pearl" ? "#754f61" : theme.cameraAccent,
    "--hero-phone-frame": theme.cameraStage,
    "--hero-skate-outer": theme.outer,
    "--hero-skate-stage": theme.stage,
    "--hero-skate-camera-panel": theme.cameraPanel,
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
          <div className="skate-outer-backdrop" style={{ opacity: smoothstep(clamp01(lensTravel / 0.35)) }} />
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
          <div ref={productRef} className="color-product" role="img" aria-label={`${theme.name} iPhone 18 Pro concept`} style={sceneReady ? { top: `${topBase}%`, opacity: sceneExpansion < 1 ? 1 : 0, transform: `translate(calc(-50% + ${shift}px), calc(-50% + ${topShift}px)) scale(${productScale})` } : undefined}>
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
                  opacity: photoOpacity,
                }}>
                  <div className="product-layer-source">
                    {colors.map((color, index) => ({ color, index })).filter(({ index }) => part === "companion" || !showModel || index === active || index === outgoing).map(({ color, index }) => (
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
              <div className="three-phone-layer" style={{ opacity: modelBlend, width: "500%", height: "300%", left: "-200%", top: "-100%", transform: `translate3d(${-artWidth * 0.008 * photoAlignment}px, ${artHeight * 0.018 * photoAlignment}px, 0)` }}>
                <ThreePhone color={theme.name} turn={turn} lensPhase={lensPhase} shutterPhase={shutterPhase} apertureOpen={apertureOpen} scenePeek={scenePeek} lensTravel={lensTravel} sceneExpansion={sceneExpansion} compact={mobile} layoutReady={entranceDone} onReady={handleModelReady} />
              </div>
            </div>
          </div>
          {entranceDone && <div className="color-product-caption" key={theme.name} style={{ opacity: 1 - reveal, animation: reveal > 0 ? "none" : undefined }}>{theme.name}</div>}
          <div className="color-heading" style={{ opacity: 1 - reveal }}><h1>Choose your perspective.</h1></div>
          <div className="scroll-scene" aria-hidden={storyOpacity < 0.75}>
            <div className="scroll-scene-backdrop" style={{ opacity: storyOpacity }} />
            <div className="scroll-scene-glow" style={{ opacity: storyOpacity }} />
            <div className="shutter-backdrop" style={{ opacity: smoothstep(clamp01((shutterPhase - 0.28) / 0.55)) }} />
            <div className="scroll-copy" style={{ opacity: smoothstep(clamp01((phaseOne - 0.4) / 0.35)) * (1 - lensReveal), transform: `translateY(${Number(((1 - motion) * 42).toFixed(2))}px)` }}>
              <p className="scroll-kicker">01 / THE FORM</p>
              <h2>Every angle,<br /><em>considered.</em></h2>
              <p className="scroll-description">A new perspective on the finish that defines the Pro.</p>
              <span className="scroll-rule" />
            </div>
            <div className="design-placeholder" style={{ opacity: smoothstep(clamp01((phaseOne - 0.34) / 0.4)) * (1 - lensReveal) }}>
              <span>{theme.name.toUpperCase()}</span><span>18 / PRO</span>
            </div>
          </div>
          <div className="camera-info-screen" style={{ opacity: smoothstep(clamp01((shutterPhase - 0.08) / 0.27)) * (1 - smoothstep(clamp01((scrollProgress - 0.65) / 0.025))) }} />
          <div className="shutter-copy" style={{ opacity: smoothstep(clamp01((shutterPhase - 0.4) / 0.45)) * cameraCopyFade, transform: `translateY(${Number(((1 - shutterPhase) * 26).toFixed(2))}px)` }}>
            <p className="shutter-kicker">02 / THE CAMERA</p>
            <h2>Light, under <br /><em>control.</em></h2>
            <p className="shutter-description">The 48MP Fusion Main camera brings the scene into focus. Watch its six-blade aperture open to meet the light.</p>
            <div className="shutter-specs"><span><strong>48MP</strong>Fusion Main</span><span><strong>ƒ/1.48–ƒ/4</strong>Variable aperture</span></div>
          </div>
          <div className="skate-end-backdrop" style={{ opacity: sceneExpansion >= 1 ? 1 : 0 }} />
          <section className="display-details" style={{ opacity: displayReveal, transform: `translateY(${(1 - displayReveal) * 22}px)` }} aria-label="Display details" aria-hidden={displayReveal < 0.99}>
            <div className="display-details-intro">
              <p className="display-details-kicker">03 / THE DISPLAY</p>
              <h2>Every frame<br /><em>{" "}feels closer.</em></h2>
              <p className="display-details-description">An expansive OLED canvas gives every moment crisp detail, rich contrast, and fluid motion.</p>
            </div>
            <div className="display-details-specs">
              <p className="display-details-kicker">MADE TO BE SEEN</p>
              <div><strong>OLED</strong><span>Deep contrast</span></div>
              <div><strong>Adaptive</strong><span>Fluid refresh</span></div>
              <div><strong>Edge to edge</strong><span>More of the moment</span></div>
            </div>
          </section>
          <div className="skate-portal" style={{ left: sceneLeft, top: sceneTop, width: sceneWidth, height: sceneHeight, borderRadius: `${phoneSettle * 32}px`, opacity: sceneExpansion >= 1 ? 1 : 0, pointerEvents: depthReveal > 0.95 ? "auto" : "none" }} aria-hidden={sceneExpansion < 1}>
            <div className="skate-canvas" style={{ width: sceneWidth, height: sceneHeight, left: 0, top: 0 }}>
            <div className="skate-background">
              <Image src="/assets/skate-city-v1.png" alt="" fill unoptimized sizes="100vw" style={{ objectFit: "cover", objectPosition: "center center" }} />
            </div>
            <button
              ref={skaterRef}
              type="button"
              className={`skate-subject ${depthReveal > 0.95 ? "is-interactive" : ""}`}
              style={{
                left: `${mix(mobile ? 50 : 54, 50, phoneWidthSettle)}%`,
                top: `${mix(mobile ? 20 : 1, mobile ? 13 : 15, phoneSettle)}%`,
                transform: `translateX(-50%) scale(${mix(mobile ? 0.9 : 0.68, mobile ? 0.48 : 0.34, phoneWidthSettle)})`,
                opacity: scenePeek,
              } as CSSProperties}
              aria-label="Move the skateboarder in the photo"
              tabIndex={depthReveal > 0.95 ? 0 : -1}
              onClick={(event) => {
                const element = event.currentTarget;
                element.classList.add("is-tapped");
                window.setTimeout(() => element.classList.remove("is-tapped"), 850);
              }}
              onPointerMove={(event) => {
                if (depthReveal < 0.95) return;
                const element = skaterRef.current;
                if (!element) return;
                const bounds = element.getBoundingClientRect();
                const x = clamp01((event.clientX - bounds.left) / bounds.width) * 2 - 1;
                const y = clamp01((event.clientY - bounds.top) / bounds.height) * 2 - 1;
                element.style.setProperty("--rider-x", `${(x * 14).toFixed(1)}px`);
                element.style.setProperty("--rider-y", `${(y * 9).toFixed(1)}px`);
                element.style.setProperty("--board-x", `${(x * 22).toFixed(1)}px`);
                element.style.setProperty("--board-y", `${(y * 13).toFixed(1)}px`);
                element.style.setProperty("--rider-angle", `${(x * 2.8).toFixed(2)}deg`);
                element.style.setProperty("--rider-tilt-y", `${(x * 5).toFixed(2)}deg`);
                element.style.setProperty("--rider-tilt-x", `${(y * -4).toFixed(2)}deg`);
                element.style.setProperty("--board-angle", `${(x * -4.5).toFixed(2)}deg`);
                element.style.setProperty("--board-tilt-x", `${(y * 7).toFixed(2)}deg`);
              }}
              onPointerLeave={() => {
                const element = skaterRef.current;
                if (!element) return;
                for (const key of ["--rider-x", "--rider-y", "--board-x", "--board-y"]) element.style.setProperty(key, "0px");
                for (const key of ["--rider-angle", "--rider-tilt-y", "--rider-tilt-x", "--board-angle", "--board-tilt-x"]) element.style.setProperty(key, "0deg");
              }}
            >
              <div className="skate-board-layer" style={{ marginTop: `${-depthReveal * 18}px` }}><Image src="/assets/skate-board-v1.png" alt="" unoptimized width={1536} height={1024} sizes="(max-width: 700px) 75vw, 34vw" /></div>
              <div className="skate-rider-layer" style={{ marginTop: `${-depthReveal * 18}px` }}><Image src="/assets/skate-rider-v1.png" alt="" unoptimized width={1024} height={1536} sizes="(max-width: 700px) 90vw, 50vw" /></div>
            </button>
            <div className="skate-camera-ui" style={{ opacity: displayReveal * 0.84 }} aria-hidden="true">
              <span className="skate-camera-grid" />
              <div className="skate-camera-top"><span className="skate-camera-flash">ϟ</span><span className="skate-camera-top-center">⌃</span><span className="skate-camera-settings">◎</span></div>
              <div className="skate-camera-bottom">
                <div className="skate-camera-zoom"><span>0.5</span><strong>1×</strong></div>
                <div className="skate-camera-modes"><span>CINEMATIC</span><span>VIDEO</span><strong>PHOTO</strong><span>PORTRAIT</span><span>PANO</span></div>
                <div className="skate-camera-controls"><span className="skate-camera-shutter" /></div>
                <span className="skate-camera-home" />
              </div>
            </div>
            </div>
          </div>
          <div className="skate-phone-frame" style={{ left: sceneLeft - 8, top: sceneTop - 8, width: sceneWidth + 16, height: sceneHeight + 16, borderRadius: `${Math.max(24, phoneSettle * 42)}px`, opacity: frameOpacity }} aria-hidden="true">
            <span className="skate-phone-island" style={{ opacity: smoothstep(clamp01((phoneSettle - 0.72) / 0.22)) }}><span className="skate-island-lens" /></span>
          </div>
        </div>
        </div>
      </section>
    </>
  );
}

