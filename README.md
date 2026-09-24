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
- The opening pair uses transparent artwork. During the scroll, it hands off to one reusable Three.js phone model. Its rounded frame, rear glass, camera island, individual lenses, and side buttons are 3D geometry. The selected finish recolors the same model as it rotates 38 degrees into a rear view.
- The layout stacks on smaller screens. Autoplay pauses during the scroll presentation and resumes when returning to the hero.
- Reduced-motion preferences are respected.

The original concept boards are in `design-concepts/`. The final scroll composition is in [design/scroll-final.png](design/scroll-final.png), with sequence notes in [design/README.md](design/README.md). The 3D model is defined in `app/ThreePhone.tsx`. The earlier rear renders remain in `public/assets/` as design references. Opening phone artwork and the mossy rock are transparent PNGs; lettering, cards, arch, and stage are built in SVG/CSS. The former overview, camera, finishes, and footer sections have been removed.
