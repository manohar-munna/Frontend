# iPhone 18 Pro — concept experience

An independent, interactive product website concept built with Next.js App Router. The phone imagery and interface assets were created for this project. It is not an official Apple website or product announcement.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Interactions

- A burgundy curtain opens after connected welcome lettering draws and fades. The rock and main phone rise into view, followed by a 3.2-second carousel entrance that travels two card positions into a five-card arch.
- Five phone colors autoplay around a continuous arch with two distinct cards on each side. Each change crossfades the phone and sends a soft ripple from its center; cards can also be selected directly.
- The hero stays pinned during scrolling. Both phones retain the selected finish. The screen-facing phone slides left and fades behind the main phone, which moves right and turns into its display frame. Scrolling back reverses the sequence.
- The pair is split into complementary CSS masks on a shared image canvas. Early in the scroll, a new transparent rear render for the selected color takes over within the same calibrated perspective. Its rear surface turns through a 38-degree yaw into a sharp, upright rear view. The five new renders are served at high image quality. This is a surface-based rendering, not a downloadable mesh model.
- The layout stacks on smaller screens. Autoplay pauses during the scroll presentation and resumes when returning to the hero.
- Reduced-motion preferences are respected.

The original concept boards are in `design-concepts/`. The final scroll composition is in [design/scroll-final.png](design/scroll-final.png), with sequence notes in [design/README.md](design/README.md). The five new rear renders are `public/assets/iphone-rear-*-v2.png`. Phone renders and the mossy rock in `public/assets/` are transparent PNGs; lettering, cards, arch, and stage are built in SVG/CSS. The former overview, camera, finishes, and footer sections have been removed.
