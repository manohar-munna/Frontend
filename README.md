# iPhone 18 Pro — concept experience

An independent, interactive product website concept built with Next.js App Router. The phone imagery and interface assets were created for this project. It is not an official Apple website or product announcement.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Interactions

- A burgundy curtain opens after the hand-drawn welcome lettering writes itself one letter at a time. The rock and main phone rise into view, followed by cards entering from both sides.
- Five phone colors autoplay around a continuous arch with two distinct cards on each side. Each change crossfades the phone and sends a soft ripple from its center; cards can also be selected directly or paused.
- The camera section changes composition as the page scrolls.
- Finish controls show dedicated transparent phone renders for each color.
- Navigation and layouts adapt to smaller screens.
- Reduced-motion preferences are respected.

The three original concept boards are in `design-concepts/`. The five phone renders and mossy rock in `public/assets/` are standalone transparent PNGs; the lettering, cards, arch, and stage are built in SVG/CSS.
