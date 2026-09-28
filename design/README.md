# Presentation notes

## Scroll sequence

The presentation follows progress through the pinned hero:

1. The five-card arch fades away. The rear phone is the native Three.js model from the opening pose onward; the screen-facing companion uses the original pair artwork.
2. The companion moves left and fades behind the main phone. The same rear model moves right and rotates toward an upright rear view, with copy and a frame appearing around it.
3. The phone moves left and tilts before the view approaches the main camera. Its six-blade iris remains visible around the small skateboard scene inside the lens.
4. The view enters the iris. Spherical image distortion, glass shading, and glare fade progressively during the zoom, revealing the flat photo before the scene fills the frame.
5. After a short full-frame beat, the photo settles into a portrait phone. A decorative camera interface, subtle island lens, and display details appear. Separate rider and board layers provide an interactive depth effect.

Scrolling upward reverses the sequence. The selected finish also controls the presentation background. On smaller screens, copy and display details rearrange around the phone.

## Phone continuity

[ThreePhone.tsx](../app/ThreePhone.tsx) defines one reusable phone model for all five finishes. Its frame, rear and front surfaces, raised camera deck, lens barrels, and side controls use 3D geometry. Photographic textures supply surface detail, including the flash and sensor.

The opening rear phone and scrolling rear phone share geometry, textures, lighting, and placement. The original rear artwork is a fallback when WebGL is unavailable. The curtain waits for renderer readiness before revealing the opening pose.

[skate-optics.ts](../app/skate-optics.ts) handles the scene's optical treatment inside the iris. [ColorHero.tsx](../app/ColorHero.tsx) coordinates the transition into the full-frame scene and final display.

## Design captures

These images record stages of the design and do not cover every frame of the current experience:

- [Hero and 3D phone](hero-3d.png)
- [Rear phone presentation](scroll-final.png)
- [Camera close-up](camera-detail.png)
- [Camera sequence reference](phase-two-camera-sequence.png)

The original boards are in [design-concepts/](../design-concepts/).
