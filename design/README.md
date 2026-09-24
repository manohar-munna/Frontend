# Scroll presentation

The image in `scroll-final.png` is captured from the implemented desktop layout.

The sequence follows progress through the pinned hero:

- The five-card arch fades away first.
- Both phones begin in the selected finish, using complementary masks of the original pair image.
- The screen-facing phone moves left and fades behind the main phone. The main phone stays fully visible, without a second render fading over it.
- The phone gradually moves to the right and turns from a rear three-quarter view into its final display angle.
- The backdrop, display frame, and left-hand copy appear during the move, retaining the selected color theme.
- The final composition holds for the last portion of the scroll. Scrolling upward reverses the presentation.

On mobile, the copy sits above the display frame and the phone settles below it with a smaller rightward shift.

The main phone remains the same source image and DOM layer from the hero through the final pose. Its image canvas is measured independently of its container so transparent margins and responsive sizing do not change alignment. CSS perspective supplies a modest turn of the original artwork; this is not a mesh model. The earlier standalone front and rear renders are retained as assets but are no longer used by this sequence.
