import ColorHero from "./ColorHero";

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="iPhone 18 Pro home">
          iPhone <span>18 Pro</span>
        </a>
        <a className="header-cta" href="#story">
          Explore <span aria-hidden="true">↗</span>
        </a>
      </header>
      <ColorHero />
    </main>
  );
}
