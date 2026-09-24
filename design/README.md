# Scroll presentation

The image in `scroll-final.png` is captured from the implemented desktop layout.

The sequence follows progress through the pinned hero:

- The five-card arch fades away first.
- Both phones begin in the selected finish, using complementary masks of the original pair image.
- The screen-facing phone moves left and fades behind the main phone. The main phone stays fully visible, without a second render fading over it.
- The phone gradually moves to the right and rotates from a rear three-quarter view to an upright rear view. The metal side rail narrows as the back turns toward the viewer, with no sideways roll.
- The backdrop, display frame, and left-hand copy appear during the move, retaining the selected color theme.
- The final composition holds for the last portion of the scroll. Scrolling upward reverses the presentation.

On mobile, the copy sits above the display frame and the phone settles below it with a smaller rightward shift.

The main phone retains the original selected-color artwork from the hero through the final pose. Its image canvas is measured independently of its container so transparent margins and responsive sizing do not change alignment. The rear glass and metal rail are separate texture surfaces. Their vertices rotate through 38 degrees around the vertical axis, and perspective matrices project them onto the screen. Camera calibration makes the initial pose match the source image exactly, then resolves into a square rear view. The rail disappears as it turns out of view. This is a surface-based rendering, not a downloadable mesh model. The earlier standalone front and rear renders are retained as assets but are no longer used by this sequence.
