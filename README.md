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
- One reusable Three.js phone is visible from the opening pose through the final rear view. Its rounded chassis, rear and front surfaces, raised camera deck, lens barrels, flash, side rail, and controls have 3D geometry. High-resolution rear photography and matching side and front references provide the finish detail. The same model changes textures and metal color for all five finishes.
- The curtain waits for the model to render before opening, keeping the artwork-to-model fallback out of sight on slower loads. If WebGL is unavailable, the original phone artwork remains visible.
- The layout stacks on smaller screens. Autoplay pauses during the scroll presentation and resumes when returning to the hero.
- Reduced-motion preferences are respected.

The original concept boards are in `design-concepts/`. The final scroll composition is in [design/scroll-final.png](design/scroll-final.png), with sequence notes in [design/README.md](design/README.md). The 3D model is defined in `app/ThreePhone.tsx`. Its photographic surfaces are in `public/assets/iphone-rear-*-v2.png`, `public/assets/iphone-side-burgundy-v3.png`, and `public/assets/iphone-front-burgundy-v3.png`. Opening phone artwork and the mossy rock are transparent PNGs; lettering, cards, arch, and stage are built in SVG/CSS. The former overview, camera, finishes, and footer sections have been removed.
