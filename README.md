# iPhone 18 Pro — concept experience

An independent, interactive product website concept built with Next.js App Router. The phone imagery and interface assets were created for this project. It is not an official Apple website or product announcement.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Interactions

- A burgundy welcome curtain opens onto the product hero.
- Each scroll gesture changes the phone finish and fades the stage to its matching color. The cards form a continuous, linear loop and can also be selected directly.
- The camera section changes composition as the page scrolls.
- Finish controls show dedicated transparent phone renders for each color.
- Navigation and layouts adapt to smaller screens.
- Reduced-motion preferences are respected.

The three original concept boards are in `design-concepts/`. The four phone renders in `public/assets/` are standalone transparent PNGs; the card surfaces and stage are built in CSS.
