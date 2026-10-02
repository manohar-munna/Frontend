# Chapter 04 storyboard — The finish

## Purpose

Continue directly after the skateboard camera display. The next chapter returns attention from the captured image to the physical phone and gives all five finishes a calm, tactile showcase. The user should understand that this is a new chapter as soon as the pinned camera section scrolls away.

## Frames

1. **Handoff.** The display phone and its camera controls leave at the normal scroll boundary. A narrow chapter rule and `04 / THE FINISH` appear against the currently selected finish's deep background. There is no second 3D phone or canvas.
2. **Material reveal.** A large image of the same selected phone pair sits in a soft radial pool of light. The headline `A finish for every point of view.` anchors the left side. The selected finish name, index, and a short color note sit alongside the image.
3. **Explore.** Five numbered, labeled swatches form a horizontal selector. Choosing one updates the phone artwork, background, accent, and the shared hero selection. The product change crossfades in one fixed image slot to avoid any apparent alignment jump.
4. **Hold.** The selected pair remains still. A small link returns to the beginning of the camera story. Scrolling back naturally returns to the skateboard display at the same selected finish.

## Motion and constraints

- This is a separate, naturally scrolling section, so the existing camera timing and phone continuity stay intact.
- Use the supplied transparent pair assets. Avoid new WebGL work and large scroll handlers.
- On narrow screens, stack copy, product, and swatches; keep every finish available without horizontal page overflow.
- Respect reduced-motion preference by removing crossfade and entrance movement.
- This is visual concept copy; make no new hardware claims.
