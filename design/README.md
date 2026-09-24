# Scroll presentation

The image in `scroll-final.png` is captured from the implemented desktop layout.

The sequence follows progress through the pinned hero:

- The five-card arch fades away first.
- Both phones begin in the selected finish, using complementary masks of the original pair image.
- The screen-facing phone moves left and fades behind the main phone. The opening pair then hands off to the reusable 3D model before it begins to rotate.
- The phone gradually moves to the right and rotates from a rear three-quarter view to an upright rear view. The metal side rail narrows as the back turns toward the viewer, with no sideways roll.
- The backdrop, display frame, and left-hand copy appear during the move, retaining the selected color theme.
- The final composition holds for the last portion of the scroll. Scrolling upward reverses the presentation.

On mobile, the copy sits above the display frame and the phone settles below it with a smaller rightward shift.

The scroll phone is one procedural Three.js model in `app/ThreePhone.tsx`. Its rounded frame and back, raised camera island, three lens assemblies, flash, logo, and side buttons are separate meshes. Five material palettes and a subtle generated finish texture give the same geometry each selected color. The model turns 38 degrees around its vertical axis; the side stays attached and narrows naturally as it faces straight back. The earlier 1024 × 1536 transparent rear renders in `public/assets/iphone-rear-*-v2.png` remain as design references and are no longer used by the page.
