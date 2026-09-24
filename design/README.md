# Scroll presentation

The image in `scroll-final.png` is captured from the implemented desktop layout.

The sequence follows progress through the pinned hero:

- The five-card arch fades away first.
- Both phones begin in the selected finish. The screen-facing phone uses the original pair artwork; the rear-facing phone is the 3D model from the opening pose onward.
- The screen-facing phone moves left and fades behind the main phone. The model rotates continuously without a visible artwork swap.
- The phone gradually moves to the right and rotates from a rear three-quarter view to an upright rear view. The metal side rail narrows as the back turns toward the viewer, with no sideways roll.
- The backdrop, display frame, and left-hand copy appear during the move, retaining the selected color theme.
- The final composition holds for the last portion of the scroll. Scrolling upward reverses the presentation.

On mobile, the copy sits above the display frame and the phone settles below it with a smaller rightward shift.

The phone is one Three.js model in `app/ThreePhone.tsx`. Its rounded frame, rear and front, raised camera deck, three lens barrels, flash, and side buttons are separate meshes. The approved 1024 × 1536 rear renders in `public/assets/iphone-rear-*-v2.png` are mapped onto the rear and camera surfaces. New matching side and front references cover the rail and display. One set of geometry serves all five colors; textures and metal finish interpolate when the selected color changes. The model turns 34 degrees around its vertical axis. The curtain waits until it is ready so the opening pose already uses this same model.

The side and front reference PNGs were made with built-in image generation, conditioned on the approved Burgundy rear image. The prompts called for a straight orthographic burgundy volume-button side with a visible camera protrusion, and a matching straight-on front display with a continuous satin metal rim, black pill cutout, and burgundy silk wallpaper. Both were composed as full-height single phones with no labels or extra devices; the model crops to the phone surfaces.
