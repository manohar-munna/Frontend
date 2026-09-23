"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ColorHero from "./ColorHero";

type Finish = "burgundy" | "pearl" | "graphite" | "sage";

const finishes: { id: Finish; name: string; color: string }[] = [
  { id: "burgundy", name: "Burgundy", color: "#64263c" },
  { id: "pearl", name: "Pearl", color: "#e5e0d9" },
  { id: "graphite", name: "Graphite", color: "#41443f" },
  { id: "sage", name: "Sage", color: "#77877b" },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return diagonal ? (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add("is-visible"); observer.unobserve(el); }
    }, { threshold: 0.13 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function Home() {
  const [finish, setFinish] = useState<Finish>("burgundy");
  const [cameraStep, setCameraStep] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const cameraStepsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setCameraStep(Number((visible.target as HTMLElement).dataset.step));
    }, { rootMargin: "-25% 0px -25% 0px", threshold: [0, 0.2, 0.5, 0.8] });
    cameraStepsRef.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" onClick={() => setMenuOpen(false)} aria-label="iPhone 18 Pro home">iPhone <span>18 Pro</span></a>
        <nav className={`nav-links ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
          <a href="#overview" onClick={() => setMenuOpen(false)}>Overview</a>
          <a href="#design" onClick={() => setMenuOpen(false)}>Design</a>
          <a href="#camera" onClick={() => setMenuOpen(false)}>Camera</a>
          <a href="#finishes" onClick={() => setMenuOpen(false)}>Finishes</a>
        </nav>
        <button className="header-cta" onClick={() => scrollToSection("design")}>Explore <Arrow diagonal /></button>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><span /><span /></button>
      </header>

      <ColorHero onExplore={scrollToSection} />

      <section id="overview" className="overview-section section-shell">
        <div className="section-index"><span>01 / 04</span><span>OVERVIEW</span></div>
        <Reveal className="overview-heading"><p className="eyebrow">The feeling comes first</p><h2>Extraordinary,<br /><em>by design.</em></h2></Reveal>
        <div className="overview-grid">
          <Reveal className="overview-intro" delay={100}><p>Every curve, every reflection, every interaction considered. An experience that feels as remarkable as it looks.</p><button className="text-link" onClick={() => scrollToSection("design")}>Explore the design <Arrow /></button></Reveal>
          <Reveal className="overview-art" delay={180}><div className="overview-art-orb" /><Image src="/assets/iphone-rear.png" alt="Graphite phone floating over a sage backdrop" fill sizes="(max-width: 700px) 100vw, 55vw" /></Reveal>
        </div>
        <div className="section-bottom"><span>FORM MEETS FEELING</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>

      <section id="design" className="design-section section-shell">
        <div className="section-index"><span>02 / 04</span><span>DESIGN</span></div>
        <div className="design-top">
          <Reveal><p className="eyebrow">In every detail</p><h2>Designed to feel<br /><em>remarkable.</em></h2></Reveal>
          <Reveal delay={120}><p className="design-summary">A quiet balance of presence and precision. Crafted surfaces catch the light, while every edge invites a closer look.</p></Reveal>
        </div>
        <div className="design-showcase">
          <Reveal className="design-tile edge-tile"><span className="tile-index">01 — FORM</span><div className="edge-visual"><Image src="/assets/iphone-rear.png" alt="Side and edge of a graphite titanium phone" fill sizes="50vw" /></div><div className="tile-caption"><h3>Form, refined.</h3><p>A silhouette that speaks softly and leaves an impression.</p></div></Reveal>
          <Reveal className="design-tile texture-tile" delay={100}><span className="tile-index">02 — MATERIAL</span><div className="texture-visual"><Image src="/assets/iphone-rear.png" alt="Close view of the phone's finish" fill sizes="50vw" /><div className="texture-callout"><span className="texture-dot" /> <span>Made to feel different.</span></div></div><div className="tile-caption"><h3>Texture with intent.</h3><p>Depth and character, revealed in every reflection.</p></div></Reveal>
        </div>
      </section>

      <section id="camera" className="camera-section">
        <div className="section-shell camera-heading"><div className="section-index"><span>03 / 04</span><span>CAMERA</span></div><Reveal><p className="eyebrow">A closer look</p><h2>See beyond<br /><em>the moment.</em></h2><p className="camera-lead">Explore the form of the camera through a sequence of small, considered details.</p></Reveal></div>
        <div className="camera-story">
          <div className="camera-stage"><div className={`camera-stage-art step-${cameraStep}`}><div className="camera-ring ring-one" /><div className="camera-ring ring-two" /><Image src="/assets/iphone-rear.png" alt="Camera detail of the iPhone 18 Pro concept" fill sizes="(max-width: 700px) 100vw, 60vw" /></div><div className="stage-counter">0{cameraStep + 1} <span>/ 03</span></div><div className="stage-caption">AN EXPERIENCE IN FOCUS</div></div>
          <div className="camera-steps">
            {[
              { label: "01 — DISCOVER", title: "A new angle.", text: "The product moves as you move, bringing each detail naturally into view." },
              { label: "02 — FOCUS", title: "Look closer.", text: "The camera becomes the centre of the experience, with space for the details to breathe." },
              { label: "03 — REVEAL", title: "Every detail, considered.", text: "A composed finish to the journey, designed to leave a lasting impression." },
            ].map((step, index) => <div key={step.label} className={`camera-step ${cameraStep === index ? "active" : ""}`} data-step={index} ref={(el) => { cameraStepsRef.current[index] = el; }}><span className="step-label">{step.label}</span><h3>{step.title}</h3><p>{step.text}</p><div className="step-progress"><span /></div></div>)}
          </div>
        </div>
      </section>

      <section id="finishes" className={`finishes-section finish-${finish} section-shell`}>
        <div className="section-index"><span>04 / 04</span><span>FINISHES</span></div>
        <div className="finishes-content"><Reveal className="finishes-copy"><p className="eyebrow">Make it yours</p><h2>Find your<br /><em>finish.</em></h2><p>Four considered tones. One unmistakable presence.</p><div className="finish-picker" role="group" aria-label="Phone finish">{finishes.map((item) => <button key={item.id} className={`finish-option ${finish === item.id ? "active" : ""}`} onClick={() => setFinish(item.id)} aria-pressed={finish === item.id}><span className="finish-dot" style={{ backgroundColor: item.color }} /><span>{item.name}</span></button>)}</div><span className="current-finish">Selected finish <strong>{finishes.find((item) => item.id === finish)?.name}</strong></span></Reveal><div className="finish-display"><div className="finish-halo" /><Image src={finish === "graphite" ? "/assets/iphone-pair.png" : `/assets/iphone-${finish}.png`} alt={`${finishes.find((item) => item.id === finish)?.name} iPhone 18 Pro concept finish`} fill sizes="(max-width: 700px) 90vw, 48vw" /></div></div>
      </section>

      <footer className="site-footer"><div className="footer-main"><p>iPhone 18 Pro</p><button onClick={() => scrollToSection("top")}>Back to top <Arrow diagonal /></button></div><div className="footer-bottom"><span>AN INDEPENDENT DESIGN CONCEPT</span><span>MADE TO BE EXPLORED</span></div></footer>
    </main>
  );
}
