# Chapter 04 storyboard — The finish

## Purpose

Continue directly after the skateboard camera display. The next chapter returns attention from the captured image to the physical phone and gives all five finishes a calm, tactile showcase. The user should understand that this is a new chapter as soon as the pinned camera section scrolls away.

## Frames

1. **Handoff.** The display phone and its camera controls leave at the normal scroll boundary. The finish chapter pins on desktop. Its rule, chapter label, progress line, and a faint phone pair establish the next scene.
2. **Product reveal, 0–35%.** An oversized, slightly tilted phone pair pulls back and straightens. Two soft light fields travel behind it and broaden as the finishes spread, while a soft floor shadow grounds the product. The headline reveals one masked line at a time. The product keeps its original proportions throughout. Light-field movement uses transforms and opacity, with no animated blur or perpetual animation loop.
3. **Surface detail, 25–59%.** A soft diagonal highlight sweeps across the phone silhouette as the pair moves slightly closer. The surface-study callout enters, then recedes. The highlight uses the artwork's alpha mask, so light never becomes a rectangular overlay.
4. **Color spread, 38–100%.** The selected product remains a front-and-back pair. The four surrounding finishes each show a single rear view, cropped from the existing rear photographs, with small names below them. They move outward from behind the selected pair, with the inner pair leading the outer pair. Their fade begins after separation, so they never appear as a stack over the main phone. On exit, they fade away while still spread apart, then return behind the selected product. Images also fade in after decoding if loading finishes late. A short caption introduces the five options.
5. **Explore and hold, 69–100%.** The selected finish name and numbered swatches rise in with staggered offsets. Choosing a swatch updates the artwork, background, accent, and shared hero selection, with a brief glint over the new phone. A small link returns to the camera story. Scrolling upward reverses the reveal.

## Reference

Reviewed [Apple's iPhone 18 Pro presentation](https://www.apple.com/iphone-18-pro/) for product-led motion: large product framing, progressive detail reveals, and a focused finish viewer. This chapter adapts those pacing ideas to the project's supplied artwork and five concept finishes.

## Motion and constraints

- On desktop, the section holds a viewport-height stage while scroll position drives the reveal. On mobile, its content flows naturally and still responds to scroll position. The existing camera timing and phone continuity stay intact.
- Use the supplied transparent pair assets. Both chapters share the actual controlled page scroll position. A bounded input queue and eased speed limits protect the short optical and finish beats during fast scrolling. Finish motion uses CSS transforms/opacity and avoids React state updates per frame; animation-frame work stops when the page settles.
- On narrow screens, stack copy, product, and swatches; keep every finish available without horizontal page overflow.
- Respect reduced-motion preference by showing the settled phone, headline, and controls immediately, with no fan spread, light sweep, or crossfade.
- This is visual concept copy; make no new hardware claims.
