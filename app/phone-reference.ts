import * as THREE from "three";

export function createPhoneReference(texture: THREE.Texture) {
  return {
    uReferenceFrom: { value: texture },
    uReferenceTo: { value: texture },
    uReferenceBlend: { value: 1 },
    uMacro: { value: 0 },
    uPupil: { value: new THREE.Vector2() },
  };
}

export type PhoneReference = ReturnType<typeof createPhoneReference>;

/**
 * Reconstruct the visible shell from one photograph. Each source texel belongs
 * to one surface: body, raised camera deck, lens, or folded side rail. Projecting
 * the photo independently onto overlapping CAD meshes duplicates their edges
 * when they turn. This continuous relief has no hidden copy of a camera below it.
 */
export function projectPhoneReference(phone: THREE.Group, reference: PhoneReference) {
  const camera = new THREE.PerspectiveCamera(28.3, 1200 / 1310, 100, 3200);
  camera.position.set(0, 0, 2600);
  camera.setViewOffset(1200, 1310, 180, 0, 1200, 1310);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  phone.rotation.y = THREE.MathUtils.degToRad(-34);
  phone.scale.set(1, 1, 1);
  phone.updateMatrixWorld(true);
  const inverse = phone.matrixWorld.clone().invert();
  const eye = camera.position.clone().applyMatrix4(inverse);
  const ray = new THREE.Vector3();
  const pointAt = (u: number, v: number, z: number) => {
    // Match the DOM artboard registration, including the canvas crop offset.
    ray.set((u + 0.008) * 2 - 1, (v + 0.011) * 2 - 1, 0)
      .unproject(camera).applyMatrix4(inverse).sub(eye);
    return ray.clone().multiplyScalar((z - eye.z) / ray.z).add(eye);
  };
  const smooth = THREE.MathUtils.smoothstep;
  const pupil = pointAt(254 / 1200, 1 - 210 / 1310, 69.1);
  reference.uPupil.value.set(pupil.x, pupil.y);
  // A fixed mesh and fixed source UVs preserve the finish at every scroll pose.
  const geometry = new THREE.PlaneGeometry(1, 1, 192, 480);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const u = THREE.MathUtils.lerp(0.14, 0.56, uvs.getX(i));
    const v = THREE.MathUtils.lerp(0.025, 0.98, uvs.getY(i));
    const x = u * 1200;
    const y = (1 - v) * 1310;
    // Work in coordinates aligned with the photographed deck's sloping edges.
    const deckY = y + (x - 300) * 0.19;
    const qx = Math.max(Math.abs(x - 309) - 78, 0);
    const qy = Math.max(Math.abs(deckY - 269) - 119, 0);
    const deck = 1 - smooth(Math.hypot(qx, qy), 24, 35);
    let lens = 0;
    for (const [cx, cy] of [[254, 210], [354, 270], [255, 351]]) {
      const radius = Math.hypot((x - cx) / 51, (y - cy + (x - cx) * 0.13) / 62);
      lens = Math.max(lens, 1 - smooth(radius, 0.78, 1.08));
    }
    const rail = smooth(x, 615, 664);
    const z = 52.8 + 8 * deck + 8.3 * lens - 64 * rail;
    const point = pointAt(u, v, z);
    positions.setXYZ(i, point.x, point.y, point.z);
    uvs.setXY(i, u, v);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.ShaderMaterial({
    uniforms: reference,
    vertexShader: `varying vec2 vUv; varying vec2 vSurface;
      void main() { vUv = uv; vSurface = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uReferenceFrom;
      uniform sampler2D uReferenceTo;
      uniform float uReferenceBlend;
      uniform float uMacro;
      uniform vec2 uPupil;
      varying vec2 vUv;
      varying vec2 vSurface;
      vec4 sampleFinish(sampler2D image) {
        vec4 color = texture2D(image, vUv, -0.35);
        // Filter the thin silhouette independently to prevent shimmering on
        // small screens while preserving the finish's photographic detail.
        color.a = texture2D(image, vUv).a;
        return color;
      }
      void main() {
        // Same rear/companion boundary as the DOM asset. Never sample the
        // companion display onto the turning rear phone's side.
        if (vUv.x > (vUv.y > .86 ? .56 : .5525)) discard;
        vec4 color = sampleFinish(uReferenceTo);
        if (uReferenceBlend < .999)
          color = mix(sampleFinish(uReferenceFrom), color, uReferenceBlend);
        float pupil = 1.0 - smoothstep(44.0, 46.0, length(vSurface - uPupil));
        color.a *= 1.0 - pupil * uMacro;
        if (color.a < .005) discard;
        gl_FragColor = color;
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const shell = new THREE.Mesh(geometry, material);
  shell.name = "Canonical product surface";
  shell.renderOrder = 2;
  phone.add(shell);
  return pupil;
}
