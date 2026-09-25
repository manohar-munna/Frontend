import * as THREE from "three";

/** The same three photograph layers used by the interactive display scene. */
export function createSkateOptics(images: HTMLImageElement[], cityTexture: THREE.Texture) {
  const canvas = document.createElement("canvas");
  // Keep GPU texture storage stable when changing viewport orientation.
  canvas.width = canvas.height = 2048;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  let previous = "";
  const paint = (width: number, height: number, viewport: number) => {
    const key = `${width}:${height}:${viewport}`;
    if (key === previous) return;
    previous = key;
    const context = canvas.getContext("2d")!;
    context.resetTransform();
    context.clearRect(0, 0, 2048, 2048);
    context.scale(2048 / width, 2048 / height);
    const [, rider, board] = images;
    const mobile = width < 670;
    const subjectWidth = (mobile ? Math.min(viewport * 1.04, 470) : Math.min(700, Math.max(470, viewport * 0.49))) * (mobile ? 0.9 : 0.68);
    const left = width * (mobile ? 0.5 : 0.54) - subjectWidth / 2;
    const top = height * (mobile ? 0.2 : 0.01);
    const boardWidth = subjectWidth * (mobile ? 0.69 : 0.65);
    const boardHeight = boardWidth * 1024 / 1536;
    const boardX = left + subjectWidth * (mobile ? 0.18 : 0.2);
    const boardY = top + subjectWidth * (mobile ? 0.69 : 0.7);
    context.save();
    context.translate(boardX + boardWidth / 2, boardY + boardHeight * 0.45);
    context.rotate(13 * Math.PI / 180);
    context.drawImage(board, -boardWidth / 2, -boardHeight * 0.45, boardWidth, boardHeight);
    context.restore();
    context.drawImage(rider, left, top, subjectWidth, subjectWidth * 1.5);
    texture.needsUpdate = true;
  };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPhoto: { value: texture },
      uCity: { value: cityTexture },
      uPanelSize: { value: new THREE.Vector2(1, 1) },
      uCityAspect: { value: images[0].width / images[0].height },
      uReveal: { value: 0 },
      uCanvasRect: { value: new THREE.Vector4() },
      uPhotoRect: { value: new THREE.Vector4() },
      uTravel: { value: 0 },
    },
    vertexShader: `varying vec4 vClip; varying vec2 vUv;
      void main() { vUv = uv; vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = vClip; }`,
    fragmentShader: `uniform sampler2D uPhoto; uniform sampler2D uCity; uniform vec2 uPanelSize; uniform float uCityAspect; uniform float uReveal; uniform float uTravel;
      uniform vec4 uCanvasRect; uniform vec4 uPhotoRect; varying vec4 vClip; varying vec2 vUv;
      void main() {
        vec2 screen = vClip.xy / vClip.w * .5 + .5;
        screen.y = 1. - screen.y;
        vec2 panel = uCanvasRect.xy + screen * uCanvasRect.zw;
        vec2 photo = (panel - uPhotoRect.xy) / uPhotoRect.zw;
        vec2 backgroundUv = mix(vUv, vec2(panel.x / uPanelSize.x, 1. - panel.y / uPanelSize.y), uTravel);
        float frameAspect = mix(1., uPanelSize.x / uPanelSize.y, uTravel);
        vec2 cover = vec2(min(1., frameAspect / uCityAspect), min(1., uCityAspect / frameAspect));
        backgroundUv = (backgroundUv - .5) * cover + .5;
        vec3 background = texture2D(uCity, backgroundUv).rgb;
        vec4 foreground = texture2D(uPhoto, vec2(photo.x, 1. - photo.y));
        float inside = step(0., photo.x) * step(0., photo.y) * step(photo.x, 1.) * step(photo.y, 1.);
        vec3 color = mix(background, foreground.rgb, foreground.a * inside);
        float glassShade = mix(.82 + .18 * (1. - pow(length(vUv - .5) * 2., 3.)), 1., uTravel);
        gl_FragColor = vec4(color * glassShade, uReveal);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
  });
  return { material, texture, paint };
}
