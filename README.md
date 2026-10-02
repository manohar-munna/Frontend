# iPhone 18 Pro — concept experience

An independent interactive product website built with Next.js App Router, React, TypeScript, and Three.js. It explores five phone finishes through a scroll-driven camera and display presentation.

This is a visual concept, not an official Apple website or product announcement. The hardware details and camera interface are illustrative.

## Run locally

Requires Node.js 20.9 or newer and npm. Run these commands from the project root:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables or external services are required.

## Production build

```bash
npm run build
npm run start
```

## The experience

1. **Entrance and finishes.** Welcome lettering and a curtain reveal the phone above a mossy rock. A 2.8-second entrance brings the five-card carousel into place. Burgundy, Pearl, Graphite, Sage, and Midnight can be selected directly or explored through autoplay.
2. **Phone presentation.** The hero stays pinned as the companion phone slides away and the rear phone moves and rotates. The opening rear phone and the scrolling rear phone are the same Three.js object, avoiding an artwork-to-model swap. The selected finish carries through the presentation.
3. **Camera close-up.** The view approaches the main lens and reveals a six-blade iris. The skateboard scene appears inside the opening with spherical distortion, glass detail, and glare across the lens layers.
4. **Inside the photo.** As the view enters the iris, the distortion gradually relaxes into a flat image. The scene expands to fill the presentation frame for a short beat.
5. **Display reveal.** The photo settles into a portrait phone with a subtle island camera, a decorative camera interface, and display details beside it on larger screens. Separate rider and board layers add an interactive depth effect.
6. **Finish chapter.** Scrolling reveals the selected phone pair, a short surface detail beat, and then five finish swatches. Selecting a finish updates the color-matched studio and shares the selection with the opening carousel.

Scrolling upward reverses the sequence. Autoplay pauses during the scroll presentation. The layout adapts to smaller screens and respects reduced-motion preferences. If WebGL is unavailable, the opening phone uses the original artwork.

## Project structure

| Path | Purpose |
| --- | --- |
| [app/page.tsx](app/page.tsx) | Page entry point and header |
| [app/ColorHero.tsx](app/ColorHero.tsx) | Entrance, carousel, scroll phases, and display interface |
| [app/FinishChapter.tsx](app/FinishChapter.tsx) | Interactive finish showcase after the skateboard display |
| [app/ThreePhone.tsx](app/ThreePhone.tsx) | Phone geometry, finish textures, lens, and WebGL rendering |
| [app/skate-optics.ts](app/skate-optics.ts) | Lens distortion, glass, and photo transition |
| [app/color-hero.css](app/color-hero.css) | Presentation styles and responsive layouts |
| [app/globals.css](app/globals.css) | Global styles |
| [public/assets/](public/assets/) | Phone artwork, surface textures, rock, and skateboard layers |
| [design/README.md](design/README.md) | Sequence notes and design captures |
| [design/finish-chapter-storyboard.md](design/finish-chapter-storyboard.md) | Storyboard for the finish chapter |
| [design-concepts/](design-concepts/) | Original concept boards |

The renderer uses a canvas cropped to the visible presentation area, adaptive pixel density, and rendering on visual changes. Textures and shaders are prepared before the opening reveal.
