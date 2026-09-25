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
  // A convex glass cap, recessed below the blade faces. The preview is mapped
  // through its spherical coordinates, rather than pasted onto a flat circle.
  const geometry = new THREE.SphereGeometry(16.5, 192, 64, 0, Math.PI * 2, 0, Math.PI / 2);
  geometry.rotateX(Math.PI / 2);
  const vertices = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < vertices.count; i++) {
    uv.setXY(i, vertices.getX(i) / 33 + 0.5, vertices.getY(i) / 33 + 0.5);
    vertices.setZ(i, vertices.getZ(i) * (1.7 / 16.5));
  }
  geometry.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPhoto: { value: texture },
      uCity: { value: cityTexture },
      uPanelSize: { value: new THREE.Vector2(1, 1) },
      uCityAspect: { value: images[0].width / images[0].height },
      uReveal: { value: 0 },
      uCanvasRect: { value: new THREE.Vector4() },
      uExpansion: { value: 0 },
      uTravel: { value: 0 },
      uPreviewScale: { value: 0.82 },
    },
    vertexShader: `varying vec4 vClip; varying vec2 vUv;
      void main() { vUv = uv; vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = vClip; }`,
    fragmentShader: `uniform sampler2D uPhoto; uniform sampler2D uCity; uniform vec2 uPanelSize; uniform float uCityAspect; uniform float uReveal; uniform float uExpansion; uniform float uPreviewScale; uniform float uTravel;
      uniform vec4 uCanvasRect; varying vec4 vClip; varying vec2 vUv;
      void main() {
        vec2 screen = vClip.xy / vClip.w * .5 + .5;
        screen.y = 1. - screen.y;
        vec2 panel = uCanvasRect.xy + screen * uCanvasRect.zw;
        // The scene stays on the recessed optic throughout the dive. Its
        // refraction and composition settle progressively as we approach.
        vec2 p = (vUv - .5) * 2.;
        float r2 = min(dot(p, p), 1.);
        // Refraction relaxes as we approach the optic, before it fills the
        // viewport. Glass reflections have a separate, slightly later exit.
        float spherical = 1. - smoothstep(.12, .78, uTravel);
        float glassPresence = 1. - smoothstep(.82, 1., uTravel);
        // Radial compression and off-axis refraction bend the skyline and
        // skater together across the glass, strongest at the curved shoulder.
        vec2 bent = p * (.64 + .36 * r2);
        bent.y += .22 * p.x * p.x * (1. - p.y * p.y);
        vec2 lensUv = mix(p, bent, spherical) * .5 + .5;
        vec2 previewPhoto = (vec2(lensUv.x, 1. - lensUv.y) - .5) / (uPreviewScale * vec2(uPanelSize.x / uPanelSize.y, 1.)) + .5;
        // Finish the framing during the push as well, so arriving at the
        // photograph never triggers a second flattening or rescaling beat.
        float framing = max(uExpansion, smoothstep(.55, 1., uTravel));
        vec2 photo = mix(previewPhoto, panel / uPanelSize, framing);
        vec2 backgroundUv = mix(lensUv, vec2(panel.x / uPanelSize.x, 1. - panel.y / uPanelSize.y), framing);
        float frameAspect = mix(1., uPanelSize.x / uPanelSize.y, framing);
        vec2 cover = vec2(min(1., frameAspect / uCityAspect), min(1., uCityAspect / frameAspect));
        backgroundUv = (backgroundUv - .5) * cover + .5;
        vec3 background = texture2D(uCity, backgroundUv).rgb;
        vec4 foreground = texture2D(uPhoto, vec2(photo.x, 1. - photo.y));
        float inside = step(0., photo.x) * step(0., photo.y) * step(photo.x, 1.) * step(photo.y, 1.);
        vec3 color = mix(background, foreground.rgb, foreground.a * inside);
        // Fresnel falloff, a broad softbox crescent, and a muted purple
        // return reflection give the glass thickness without washing it out.
        vec3 glassNormal = normalize(vec3(p * .94, sqrt(max(.001, 1. - r2 * .8836))));
        float shoulder = smoothstep(.55, 1., sqrt(r2));
        float transmission = (.38 + .62 * pow(glassNormal.z, .65)) * (1. - .42 * shoulder);
        // The same off-axis source catches successive glass shoulders. Keep
        // the centre clear, with localized coating reflections on the edges.
        float radius = sqrt(r2);
        float keySide = exp(-pow((p.x + .66) * 4.5, 2.) - pow((p.y - .57) * 4.5, 2.));
        float returnSide = exp(-pow((p.x - .81) * 6., 2.) - pow((p.y + .28) * 4.5, 2.));
        float crescent = exp(-pow((radius - .91) * 27., 2.));
        float innerReturn = exp(-pow((radius - .77) * 32., 2.));
        float rim = crescent + .32 * innerReturn;
        vec3 reflection = rim * (vec3(1.15, .72, .38) * keySide + vec3(.62, .29, .76) * returnSide);
        reflection += vec3(.72, .60, .48) * keySide * .22
          + vec3(.14, .06, .23) * returnSide * .18;
        // Fine coating variation and narrow highlights remain attached to the
        // glass even once the transmitted photograph has become rectilinear.
        float coating = sin(p.x * 17. + p.y * 11.) * sin(p.y * 23. - p.x * 9.);
        float polish = exp(-pow((p.y + .63 * p.x - .29) * 90., 2.))
          * exp(-pow((p.x + .59) * 6., 2.));
        float pinpoint = exp(-dot(p - vec2(-.66, .57), p - vec2(-.66, .57)) * 1200.);
        float returnPin = exp(-dot(p - vec2(.81, -.28), p - vec2(.81, -.28)) * 1600.);
        reflection += vec3(.65, .69, .76) * polish + vec3(1.8, 1.65, 1.4) * pinpoint
          + vec3(1.1, .64, 1.4) * returnPin + coating * .0015;
        color = color * mix(1., transmission, glassPresence) + reflection * glassPresence;
        // The photograph disappears into the dark glass shoulder instead of
        // leaving a hard circular decal edge over the original optical layer.
        float glassEdge = mix(1., 1. - smoothstep(.93, 1., radius), glassPresence);
        gl_FragColor = vec4(color, uReveal * glassEdge);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
  });
  return { material, texture, geometry, paint };
}
