"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const features = [
  { name: "Camera", asset: "/assets/camera-module.png", section: "camera" },
  { name: "Titanium", asset: "/assets/titanium-edge.png", section: "design" },
  { name: "Display", asset: "/assets/display-glass.png", section: "overview" },
  { name: "Finishes", asset: "/assets/iphone-rear.png", section: "finishes" },
  { name: "Form", asset: "/assets/iphone-pair.png", section: "design" },
] as const;

const slots = ["far-left", "left", "center", "right", "far-right"] as const;

function slotFor(index: number, active: number) {
  const distance = (index - active + features.length) % features.length;
  return slots[(distance + 2) % features.length];
}

export default function HeroExperience({ onExplore }: { onExplore: (section: string) => void }) {
  const [active, setActive] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const activeRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    let timeout: ReturnType<typeof setTimeout>;
    const advance = () => {
      if (activeRef.current === features.length - 1) {
        setClearing(true);
        timeout = setTimeout(() => {
          activeRef.current = 0;
          setActive(0);
          setClearing(false);
          timeout = setTimeout(advance, 1900);
        }, 1500);
      } else {
        activeRef.current += 1;
        setActive(activeRef.current);
        timeout = setTimeout(advance, 1900);
      }
    };
    timeout = setTimeout(advance, 1900);
    return () => clearTimeout(timeout);
  }, [reducedMotion]);

  const chooseFeature = (index: number) => {
    activeRef.current = index;
    setActive(index);
    setClearing(false);
  };

  return (
    <section id="top" className={`reel-hero reel-scene-${active} ${clearing ? "reel-clearing" : ""}`} aria-label="Explore iPhone 18 Pro features">
      <div className="reel-outer-note"><span>18 PRO / CONCEPT</span><span>BUILT TO BE EXPLORED</span></div>
      <div className="reel-panel">
        <div className="reel-panel-grain" />
        <div className="reel-panel-top">
          <span className="reel-mark">iPhone 18 Pro</span>
          <span className="reel-mini-nav" aria-label="Feature selection">
            {features.map((feature, index) => (
              <button key={feature.name} onClick={() => chooseFeature(index)} className={active === index ? "active" : ""} aria-label={`Show ${feature.name}`} aria-pressed={active === index}>{index + 1}</button>
            ))}
          </span>
          <button className="reel-mini-action" onClick={() => onExplore("overview")} aria-label="Explore the site">↗</button>
        </div>

        <div className="reel-rail" aria-label="Feature carousel">
          {features.map((feature, index) => (
            <button
              key={feature.name}
              className={`reel-feature-card slot-${slotFor(index, active)} ${active === index ? "active" : ""}`}
              onClick={() => chooseFeature(index)}
              aria-label={`Select ${feature.name}`}
              aria-pressed={active === index}
              type="button"
            >
              <Image src={feature.asset} alt="" fill sizes="(max-width: 700px) 100px, 160px" />
              <span>{feature.name}</span>
            </button>
          ))}
        </div>

        <div className="reel-rock" />
        <div className="reel-product" aria-live="polite">
          <Image src="/assets/iphone-rear.png" alt="Graphite iPhone 18 Pro concept back" fill priority sizes="(max-width: 700px) 60vw, 30vw" className="reel-phone-back" />
          <Image src="/assets/display-glass.png" alt="iPhone 18 Pro concept display" fill sizes="(max-width: 700px) 60vw, 30vw" className="reel-phone-front" />
          <span className="reel-product-name" key={active}>{features[active].name}</span>
        </div>
        <button className="reel-product-cta" onClick={() => onExplore(features[active].section)} aria-label={`Explore ${features[active].name}`}>
          <span>EXPLORE</span><span>↗</span>
        </button>
        <h1>Choose your perspective.</h1>
      </div>
      <div className="reel-bottom-note"><span>DESIGNED TO MOVE YOU</span><span>SCROLL TO DISCOVER ↓</span></div>
    </section>
  );
}
