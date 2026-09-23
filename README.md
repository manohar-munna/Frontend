# iPhone 18 Pro — concept experience

An independent, interactive product website concept built with Next.js App Router. The phone imagery and interface assets were created for this project. It is not an official Apple website or product announcement.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Interactions

- A burgundy curtain opens after the connected welcome lettering draws as one slow stroke and fades. A center seam appears, the curtains part, then the rock and main phone rise into view. Five color cards then orbit from behind the rock, growing into the finished arch.
- Five phone colors autoplay around a continuous arch with two distinct cards on each side. Each change crossfades the phone and sends a soft ripple from its center; cards can also be selected directly.
- The camera section changes composition as the page scrolls.
- Finish controls show dedicated transparent phone renders for each color.
- Navigation and layouts adapt to smaller screens.
- Reduced-motion preferences are respected.

The three original concept boards are in `design-concepts/`. The five phone renders and main mossy rock in `public/assets/` are standalone transparent PNGs; the lettering, cards, arch, and stage are built in SVG/CSS.
