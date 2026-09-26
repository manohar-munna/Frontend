"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { createSkateOptics } from "./skate-optics";
import { createPhoneReference, projectPhoneReference, type PhoneReference } from "./phone-reference";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type FinishName = "Burgundy" | "Pearl" | "Graphite" | "Sage" | "Midnight";
// The original pair photographs are the single source for every finish.
const pairSources: Record<FinishName, string> = { Burgundy: "/assets/iphone-burgundy.png", Pearl: "/assets/iphone-pearl.png", Graphite: "/assets/iphone-pair.png", Sage: "/assets/iphone-sage.png", Midnight: "/assets/iphone-midnight.png" };
const names = Object.keys(pairSources) as FinishName[];
const D = 62;
const CAMERA_SHIFT_X = 22;
const CAMERA_SHIFT_Y = -14;
type Photos = { reference: Record<FinishName, THREE.Texture> };

const IRIS_BLADE_COUNT = 6;
const IRIS_ARC_STEPS = 384;
const IRIS_RADIAL_STEPS = 16;
const IRIS_OUTER_RADIUS = 42.2;

function makeIrisBlade(index: number) {
  const row = IRIS_ARC_STEPS + 1;
  const faceCount = row * (IRIS_RADIAL_STEPS + 1);
  const vertexCount = faceCount + row * 2;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const triangles: number[] = [];
  for (let radial = 0; radial < IRIS_RADIAL_STEPS; radial++) {
    for (let arc = 0; arc < IRIS_ARC_STEPS; arc++) {
      const a = radial * row + arc;
      const b = a + row;
      triangles.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  for (let arc = 0; arc < IRIS_ARC_STEPS; arc++) {
    const a = faceCount + arc * 2;
    triangles.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  for (let radial = 0; radial <= IRIS_RADIAL_STEPS; radial++) {
    for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
      const vertex = radial * row + arc;
      const s = radial / IRIS_RADIAL_STEPS;
      const t = arc / IRIS_ARC_STEPS;
      const shade = 0.62 + 0.035 * (1 - s) + 0.025 * (1 - t);
      colors.set([shade, shade * 0.995, shade * 1.025], vertex * 3);
      uvs.set([s * 120, t * 120], vertex * 2);
    }
  }
  for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
    const vertex = faceCount + arc * 2;
    colors.set([0.64, 0.64, 0.67, 0.26, 0.26, 0.28], vertex * 3);
    uvs.set([arc * 4, 0, arc * 4, 2], vertex * 2);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(triangles);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 47);
  writeIrisClosedBlade(geometry, index);
  // Map the standalone cutout in each leaf's own coordinates. UVs never
  // change during opening, so its metal grain and bevel cannot stretch.
  const angle = -index * (Math.PI * 2 / IRIS_BLADE_COUNT);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let vertex = 0; vertex < position.count; vertex++) {
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    uv.setXY(vertex, 0.5 + (cosine * x - sine * y) / 100, 0.5 + (sine * x + cosine * y) / 100);
  }
  uv.needsUpdate = true;
  return geometry;
}

function writeIrisClosedBlade(geometry: THREE.BufferGeometry, index: number) {
  const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
  const row = IRIS_ARC_STEPS + 1;
  const faceCount = row * (IRIS_RADIAL_STEPS + 1);
  const sector = (Math.PI * 2) / IRIS_BLADE_COUNT;
  const apertureRadius = 4.2;
  const setPoint = (vertex: number, radial: number, arc: number) => {
    const t = arc / IRIS_ARC_STEPS;
    // Each long leaf spans half the diaphragm. Its trailing end sits above
    // the next leaf while its leading end passes below the previous one.
    const tipCurl = 0.31 * THREE.MathUtils.smoothstep(t, 0.71, 1);
    const angle = (index - 1 + 3 * t) * sector + tipCurl;
    // A broad, nearly straight inner edge lets adjacent rigid leaves form
    // the opening themselves without an imposed polygon over the glass.
    const taper = Math.pow(Math.abs(2 * t - 1), 8);
    const leafCurve = Math.sin(t * Math.PI);
    const innerAngle = angle + leafCurve * 0.24;
    // The central edge stays one continuous machined curve. The old hexagon
    // radius introduced tiny corners that became visible in the macro zoom.
    const inside = apertureRadius + (IRIS_OUTER_RADIUS - apertureRadius) * taper;
    const innerX = Math.cos(innerAngle) * inside;
    const innerY = Math.sin(innerAngle) * inside;
    const outerX = Math.cos(angle - leafCurve * 0.08) * IRIS_OUTER_RADIUS;
    const outerY = Math.sin(angle - leafCurve * 0.08) * IRIS_OUTER_RADIUS;
    const bow = radial * radial * (3 - 2 * radial);
    const x = THREE.MathUtils.lerp(innerX, outerX, bow);
    const y = THREE.MathUtils.lerp(innerY, outerY, bow);
    // The raised leading edge and tilted face expose a real sidewall at the
    // overlaps while remaining below the circular retaining ring.
    const z = 1.9 * t + (1 - radial) * 0.42;
    attribute.setXYZ(vertex, x, y, z);
  };
  for (let radial = 0; radial <= IRIS_RADIAL_STEPS; radial++) {
    for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
      setPoint(radial * row + arc, radial / IRIS_RADIAL_STEPS, arc);
    }
  }
  for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
    setPoint(faceCount + arc * 2, 0, arc);
    const x = attribute.getX(faceCount + arc * 2);
    const y = attribute.getY(faceCount + arc * 2);
    const z = attribute.getZ(faceCount + arc * 2);
    attribute.setXYZ(faceCount + arc * 2 + 1, x, y, z - 2.1);
  }
  attribute.needsUpdate = true;
  geometry.computeVertexNormals();
}

function makeIrisSeam(blade: THREE.BufferGeometry) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((IRIS_ARC_STEPS + 1) * 2 * 3);
  const uvs = new Float32Array((IRIS_ARC_STEPS + 1) * 2 * 2);
  const triangles: number[] = [];
  for (let arc = 0; arc < IRIS_ARC_STEPS; arc++) {
    const a = arc * 2;
    triangles.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
    uvs.set([0, arc / IRIS_ARC_STEPS, 1, arc / IRIS_ARC_STEPS], arc * 4);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(triangles);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 47);
  updateIrisSeam(geometry, blade);
  return geometry;
}

function updateIrisSeam(geometry: THREE.BufferGeometry, blade: THREE.BufferGeometry) {
  const seam = geometry.getAttribute("position") as THREE.BufferAttribute;
  const face = blade.getAttribute("position") as THREE.BufferAttribute;
  const row = IRIS_ARC_STEPS + 1;
  for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
    const a = arc;
    const b = row * 3 + arc;
    seam.setXYZ(arc * 2, face.getX(a), face.getY(a), face.getZ(a) + 0.16);
    seam.setXYZ(arc * 2 + 1,
      THREE.MathUtils.lerp(face.getX(a), face.getX(b), 0.76),
      THREE.MathUtils.lerp(face.getY(a), face.getY(b), 0.76),
      THREE.MathUtils.lerp(face.getZ(a), face.getZ(b), 0.76) + 0.16);
  }
  seam.needsUpdate = true;
}

function makeIrisContactShadow(blade: THREE.BufferGeometry) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((IRIS_ARC_STEPS + 1) * 2 * 3);
  const uvs = new Float32Array((IRIS_ARC_STEPS + 1) * 2 * 2);
  const triangles: number[] = [];
  const face = blade.getAttribute("position") as THREE.BufferAttribute;
  const row = IRIS_ARC_STEPS + 1;
  for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
    const t = arc / IRIS_ARC_STEPS;
    const x = face.getX(arc);
    const y = face.getY(arc);
    const dx = x - face.getX(row + arc);
    const dy = y - face.getY(row + arc);
    const length = Math.hypot(dx, dy) || 1;
    const width = 0.8 + 2.8 * Math.pow(Math.sin(t * Math.PI), 0.7);
    const z = face.getZ(arc) + 0.1;
    const inner = 0.15;
    positions.set([x + dx / length * inner, y + dy / length * inner, z,
      x + dx / length * (inner + width), y + dy / length * (inner + width), z - 0.08], arc * 6);
    uvs.set([0, t, 1, t], arc * 4);
    if (arc < IRIS_ARC_STEPS) {
      const a = arc * 2;
      triangles.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(triangles);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  return geometry;
}

function makeIrisOverlapEdge(blade: THREE.BufferGeometry) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((IRIS_ARC_STEPS + 1) * 2 * 3);
  const triangles: number[] = [];
  for (let arc = 0; arc < IRIS_ARC_STEPS; arc++) {
    const a = arc * 2;
    triangles.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(triangles);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 47);
  updateIrisOverlapEdge(geometry, blade);
  return geometry;
}

function updateIrisOverlapEdge(geometry: THREE.BufferGeometry, blade: THREE.BufferGeometry) {
  const edge = geometry.getAttribute("position") as THREE.BufferAttribute;
  const face = blade.getAttribute("position") as THREE.BufferAttribute;
  const row = IRIS_ARC_STEPS + 1;
  for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
    const a = arc;
    const b = row + arc;
    edge.setXYZ(arc * 2, face.getX(a), face.getY(a), face.getZ(a) + 0.27);
    edge.setXYZ(arc * 2 + 1,
      THREE.MathUtils.lerp(face.getX(a), face.getX(b), 0.19),
      THREE.MathUtils.lerp(face.getY(a), face.getY(b), 0.19),
      THREE.MathUtils.lerp(face.getZ(a), face.getZ(b), 0.19) + 0.27);
  }
  edge.needsUpdate = true;
}

function makeIrisLip(blade: THREE.BufferGeometry) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((IRIS_ARC_STEPS + 1) * 2 * 3);
  const triangles: number[] = [];
  for (let arc = 0; arc < IRIS_ARC_STEPS; arc++) {
    const a = arc * 2;
    triangles.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(triangles);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 47);
  updateIrisLip(geometry, blade);
  return geometry;
}

function updateIrisLip(geometry: THREE.BufferGeometry, blade: THREE.BufferGeometry) {
  const lip = geometry.getAttribute("position") as THREE.BufferAttribute;
  const face = blade.getAttribute("position") as THREE.BufferAttribute;
  const row = IRIS_ARC_STEPS + 1;
  for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
    const a = arc;
    const b = row + arc;
    lip.setXYZ(arc * 2, face.getX(a), face.getY(a), face.getZ(a) + 0.23);
    lip.setXYZ(arc * 2 + 1,
      THREE.MathUtils.lerp(face.getX(a), face.getX(b), 0.11),
      THREE.MathUtils.lerp(face.getY(a), face.getY(b), 0.11),
      THREE.MathUtils.lerp(face.getZ(a), face.getZ(b), 0.11) + 0.23);
  }
  lip.needsUpdate = true;
}

function clipIrisMaterial(material: THREE.Material, bladeOffset: THREE.Vector2) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBladeOffset = { value: bladeOffset };
    shader.vertexShader = shader.vertexShader.replace("void main() {", "uniform vec2 uBladeOffset; varying vec2 vIrisLocal; void main() { vIrisLocal = position.xy + uBladeOffset;");
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", `varying vec2 vIrisLocal; void main() { if (dot(vIrisLocal, vIrisLocal) > ${IRIS_OUTER_RADIUS.toFixed(1)} * ${IRIS_OUTER_RADIUS.toFixed(1)}) discard;`);
  };
}

function makeOpticalGlass(texture: THREE.Texture) {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const sceneReveal = { value: 0 };
  material.userData.sceneReveal = sceneReveal;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSceneReveal = sceneReveal;
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", "uniform float uSceneReveal; void main() {");
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      #include <map_fragment>
      // Reflections belong to the curved glass shoulder, outside the image.
      vec2 glassPoint = (vMapUv - .5) * 2.;
      float glassRadius = length(glassPoint);
      float shoulder = smoothstep(.75, .83, glassRadius) * (1. - smoothstep(.96, 1., glassRadius));
      float softbox = exp(-pow((glassPoint.y + .36 * glassPoint.x - .72) * 15., 2.));
      float returnLight = exp(-pow((glassPoint.y + .28 * glassPoint.x + .76) * 20., 2.));
      diffuseColor.rgb += shoulder * (vec3(.31, .29, .27) * softbox + vec3(.10, .085, .18) * returnLight);
      // Warm and violet reflections continue over the existing recessed
      // optic, outside the photo. No extra ring meshes or screen overlay.
      float keySide = exp(-pow((glassPoint.x + .66) * 4.5, 2.) - pow((glassPoint.y - .57) * 4.5, 2.));
      float returnSide = exp(-pow((glassPoint.x - .81) * 6., 2.) - pow((glassPoint.y + .28) * 4.5, 2.));
      float coating = exp(-pow((glassRadius - .87) * 26., 2.)) + .35 * exp(-pow((glassRadius - .96) * 45., 2.));
      diffuseColor.rgb += uSceneReveal * shoulder * (coating + .22)
        * (vec3(.95, .58, .27) * keySide + vec3(.50, .18, .66) * returnSide);
    `);
  };
  return material;
}

type ModelState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  environment: THREE.WebGLRenderTarget;
  camera: THREE.PerspectiveCamera;
  phone: THREE.Group;
  detailMaterials: THREE.Material[];
  opticalGlass: THREE.MeshBasicMaterial;
  skate: ReturnType<typeof createSkateOptics>;
  scenePhotos: THREE.Texture[];
  sensorTexture: THREE.Texture;
  bladeTexture: THREE.Texture;
  irisAssembly: THREE.Group;
  irisBlades: { group: THREE.Group; offset: THREE.Vector2; geometry: THREE.BufferGeometry; material: THREE.MeshPhysicalMaterial; seam: THREE.BufferGeometry; seamMaterial: THREE.ShaderMaterial; edge: THREE.BufferGeometry; edgeMaterial: THREE.MeshBasicMaterial; lip: THREE.BufferGeometry; lipMaterial: THREE.MeshPhysicalMaterial; contactShadow: THREE.BufferGeometry; contactMaterial: THREE.ShaderMaterial }[];
  irisMotion: number;
  shutterRings: THREE.MeshPhysicalMaterial[];
  photos: Photos;
  reference: PhoneReference;
  current: FinishName;
  animation: number;
  disposed: boolean;
  render: (immediate?: boolean) => void;
  select: (name: FinishName) => void;
};

function setPhonePose(state: ModelState, turn: number, lensPhase: number, shutterPhase: number, compact: boolean, apertureOpen = 0, scenePeek = 0, lensTravel = 0, sceneExpansion = 0) {
  // The photographic scene fully covers the 3D phone from this point on.
  if (sceneExpansion >= 1) return;
  state.reference.uMacro.value = THREE.MathUtils.smoothstep(shutterPhase, 0.67, 0.76);
  // Turning the rear toward the left reveals the phone's left rail and makes
  // the outward-facing optical axis project to the right of the chassis.
  state.phone.rotation.y = THREE.MathUtils.degToRad(-34 * (1 - turn) + 27 * lensPhase * (1 - shutterPhase));
  state.phone.rotation.z = THREE.MathUtils.degToRad(5 * lensPhase * (1 - shutterPhase));
  state.phone.updateMatrixWorld(true);
  const focus = new THREE.Vector3(state.reference.uPupil.value.x, state.reference.uPupil.value.y, D / 2 + 38.1).applyMatrix4(state.phone.matrixWorld);
  const close = shutterPhase * shutterPhase * (3 - 2 * shutterPhase);
  const targetX = focus.x + (compact ? -20 : 0);
  const targetY = focus.y - (compact ? 18 : 10);
  const cameraX = THREE.MathUtils.lerp(0, targetX, close);
  const verticalFrame = THREE.MathUtils.smoothstep(shutterPhase, 0, 0.8);
  const cameraY = THREE.MathUtils.lerp(0, targetY, verticalFrame);
  state.camera.position.set(cameraX, cameraY, THREE.MathUtils.lerp(2600, compact ? 1430 : 1320, close));
  // Keep useful depth precision at every scale. A fixed 0.5 near plane
  // quantized the distant camera deck and lens faces into competing depths.
  state.camera.near = Math.max(0.5, (state.camera.position.z - 80) * 0.45);
  state.camera.lookAt(cameraX, cameraY, 0);
  state.camera.zoom = THREE.MathUtils.lerp(1, compact ? 2.35 : 3.8, close);
  const canvas = state.renderer.domElement;
  const mount = canvas.parentElement!;
  const virtualRect = mount.getBoundingClientRect();
  const panel = mount.closest(".color-panel") as HTMLElement | null;
  if (panel) {
    const bounds = panel.getBoundingClientRect();
    const width = panel.clientWidth;
    const height = panel.clientHeight;
    const scaleX = virtualRect.width / mount.clientWidth;
    const scaleY = virtualRect.height / mount.clientHeight;
    const contentLeft = bounds.left + panel.clientLeft;
    const contentTop = bounds.top + panel.clientTop;
    const cropX = (contentLeft - virtualRect.left) / virtualRect.width;
    const cropY = (contentTop - virtualRect.top) / virtualRect.height;
    const cropWidth = width / virtualRect.width;
    const cropHeight = height / virtualRect.height;
    // The 500%-wide mount defines the virtual projection, but only the panel
    // is visible. Render that crop into a panel-sized buffer instead of
    // allocating and clearing the entire off-screen virtual canvas.
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.transform = `translate3d(${(contentLeft - virtualRect.left) / scaleX}px, ${(contentTop - virtualRect.top) / scaleY}px, 0) scale(${1 / scaleX}, ${1 / scaleY})`;
    const pixelRatio = state.renderer.getPixelRatio();
    if (canvas.width !== Math.floor(width * pixelRatio) || canvas.height !== Math.floor(height * pixelRatio)) {
      state.renderer.setSize(width, height, false);
    }
    state.renderer.setScissorTest(false);
    const viewX = -1020 + cropX * 6000;
    const viewY = -1310 + cropY * 3930;
    const viewWidth = cropWidth * 6000;
    const viewHeight = cropHeight * 3930;
    state.camera.setViewOffset(3600, 1310, viewX, viewY, viewWidth, viewHeight);
    state.camera.updateProjectionMatrix();
    const coverRadius = Math.hypot(width / 2, height / 2) + 18;
    const focalPixels = state.camera.projectionMatrix.elements[5] * height / 2;
    // Stop the physical dive exactly when the small pupil covers the viewport.
    // Continuing toward the surface magnified the skater into a cropped blur.
    const entryZ = focus.z + focalPixels * 16.5 / coverRadius;
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, entryZ, lensTravel);
    state.camera.near = Math.max(0.5, (state.camera.position.z - 80) * 0.45);
    state.camera.updateProjectionMatrix();
    state.camera.updateMatrixWorld(true);
    if (lensTravel > 0) {
      const projected = focus.clone().project(state.camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const targetX = THREE.MathUtils.lerp((compact ? 0.37 : 0.225) * width, width / 2, lensTravel);
      const targetY = THREE.MathUtils.lerp((compact ? 0.53 : 0.445) * height, height / 2, lensTravel);
      state.camera.setViewOffset(3600, 1310, viewX + (x - targetX) / width * viewWidth, viewY + (y - targetY) / height * viewHeight, viewWidth, viewHeight);
      state.camera.updateProjectionMatrix();
    }
    state.skate.paint(width, height, window.innerWidth);
    const uniforms = state.skate.material.uniforms;
    uniforms.uCanvasRect.value.set(0, 0, width, height);
    uniforms.uPanelSize.value.set(width, height);
    uniforms.uReveal.value = scenePeek;
    uniforms.uExpansion.value = sceneExpansion;
    uniforms.uTravel.value = lensTravel;
    uniforms.uPreviewScale.value = height / (2 * coverRadius);
  }
  // Preserve the simple dark housing and central optic as the camera moves
  // from the photographic phone surface into the modeled aperture.
  state.opticalGlass.opacity = 1;
  state.opticalGlass.userData.sceneReveal.value = scenePeek * (1 - sceneExpansion);
  const closure = THREE.MathUtils.smoothstep(shutterPhase, 0.43, 0.76);
  const reopening = THREE.MathUtils.smoothstep(shutterPhase, 0.76, 1);
  state.irisAssembly.visible = closure > 0.001;
  state.irisAssembly.rotation.z = 0.2 * (closure - reopening);
  const motion = closure + reopening + apertureOpen;
  const radius = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(IRIS_OUTER_RADIUS, 4.2, closure), 19.6, reopening), IRIS_OUTER_RADIUS + 7, apertureOpen);
  if (Math.abs(state.irisMotion - motion) > 0.0001) {
    const travel = radius - 4.2;
    for (let index = 0; index < state.irisBlades.length; index++) {
      const blade = state.irisBlades[index];
      const direction = (index + 0.5) * (Math.PI * 2 / IRIS_BLADE_COUNT);
      blade.offset.set(Math.cos(direction) * travel, Math.sin(direction) * travel);
      blade.group.position.set(blade.offset.x, blade.offset.y, 0);
    }
    state.irisMotion = motion;
  }
  for (const blade of state.irisBlades) {
    blade.seamMaterial.uniforms.uOpacity.value = 0.86;
    blade.lipMaterial.opacity = 0.68;
  }
  for (const ring of state.shutterRings) ring.opacity = THREE.MathUtils.smoothstep(shutterPhase, 0.3, 0.72);
  state.render();
}

export default function ThreePhone({ color, turn, lensPhase, shutterPhase, compact, apertureOpen = 0, scenePeek = 0, lensTravel = 0, sceneExpansion = 0, layoutReady, onReady }: { color: string; turn: number; lensPhase: number; shutterPhase: number; compact: boolean; apertureOpen?: number; scenePeek?: number; lensTravel?: number; sceneExpansion?: number; layoutReady: boolean; onReady?: (ready: boolean) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const layoutReadyRef = useRef(false);
  const latest = useRef({ color, turn, lensPhase, shutterPhase, compact, apertureOpen, scenePeek, lensTravel, sceneExpansion });
  latest.current = { color, turn, lensPhase, shutterPhase, compact, apertureOpen, scenePeek, lensTravel, sceneExpansion };
  const stateRef = useRef<ModelState | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const container = mount;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      onReady?.(false);
      return;
    }
    // Match the display's pixel density; MSAA handles edge coverage without
    // multiplying fragment work by supersampling every 1x screen at 1.5–2x.
    const gl = renderer.getContext();
    const debugRenderer = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = String(gl.getParameter(debugRenderer?.UNMASKED_RENDERER_WEBGL || gl.RENDERER));
    const softwareRenderer = /swiftshader|llvmpipe|software/i.test(rendererName);
    const integratedRenderer = /intel.*(uhd|iris|hd graphics)/i.test(rendererName);
    const pixelRatio = softwareRenderer ? 1 : Math.min(devicePixelRatio || 1, integratedRenderer ? 1.5 : 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    mount.appendChild(renderer.domElement);

    let cancelled = false;
    let renderFrame = 0;
    let state: ModelState | null = null;
    const loader = new THREE.TextureLoader();
    const sources = ["/assets/sensor-glass.webp", "/assets/iris-blade-cutout-v5.webp", "/assets/skate-city-v1.png", "/assets/skate-rider-v1.png", "/assets/skate-board-v1.png", ...names.map((name) => pairSources[name])];

    async function start() {
      const loaded = await Promise.all(sources.map((src) => loader.loadAsync(src)));
      if (cancelled) {
        loaded.forEach((texture) => texture.dispose());
        return;
      }
      loaded.forEach((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
      });
      const photos: Photos = { reference: Object.fromEntries(names.map((name, index) => [name, loaded[5 + index]])) as Photos["reference"] };
      const initial = (latest.current.color in pairSources ? latest.current.color : "Burgundy") as FinishName;
      const scene = new THREE.Scene();
      // Studio panels light the moving aperture. The shell keeps the original
      // photograph's finish and reflections throughout the turn.
      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const environment = pmrem.fromScene(room, 0.04);
      room.dispose();
      pmrem.dispose();
      // A tight depth range keeps the raised camera faces from competing for
      // the same depth-buffer values as the deck and rear glass.
      const camera = new THREE.PerspectiveCamera(28.3, 1200 / 1310, 100, 3200);
      camera.position.set(0, 0, 2600);
      camera.setViewOffset(1200, 1310, 180, 0, 1200, 1310);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.65);
      key.position.set(-400, 650, 1200);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xe3d3d8, 1.1);
      fill.position.set(630, 150, 500);
      scene.add(fill);
      const phone = new THREE.Group();
      phone.position.y = 15;
      scene.add(phone);
      const detailMaterials: THREE.Material[] = [];
      const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        phone.add(mesh);
        return mesh;
      };
      const bladeTexture = loaded[1];
      const sensorTexture = loaded[0];
      const opticalGlass = makeOpticalGlass(sensorTexture);
      const scenePhotos = loaded.slice(2, 5);
      const skate = createSkateOptics(scenePhotos.map((texture) => texture.image as HTMLImageElement), scenePhotos[0]);
      const sceneInLens = add(skate.geometry, skate.material, -170 + CAMERA_SHIFT_X, 465 + CAMERA_SHIFT_Y, D / 2 + 36.4);
      sceneInLens.renderOrder = 4;
      const innerHousing = new THREE.MeshBasicMaterial({ color: 0x030406, side: THREE.DoubleSide });
      const barrelBlack = new THREE.MeshBasicMaterial({ color: 0x080a0d, side: THREE.DoubleSide });
      detailMaterials.push(innerHousing, barrelBlack);
      add(new THREE.CircleGeometry(44, 256), innerHousing, -170 + CAMERA_SHIFT_X, 465 + CAMERA_SHIFT_Y, D / 2 + 36.7);
      const opticGeometry = new THREE.SphereGeometry(22, 128, 64, 0, Math.PI * 2, 0, Math.PI / 2);
      opticGeometry.rotateX(Math.PI / 2);
      const opticPosition = opticGeometry.getAttribute("position");
      const opticUv = opticGeometry.getAttribute("uv");
      for (let i = 0; i < opticPosition.count; i++) {
        opticUv.setXY(i, opticPosition.getX(i) / 44 + 0.5, opticPosition.getY(i) / 44 + 0.5);
      }
      const optic = add(opticGeometry, opticalGlass, -170 + CAMERA_SHIFT_X, 465 + CAMERA_SHIFT_Y, D / 2 + 36.9);
      optic.scale.z = 0.04;
      const irisWell = add(new THREE.CylinderGeometry(46.2, 46.2, 3.7, 128, 1, true), barrelBlack, -170 + CAMERA_SHIFT_X, 465 + CAMERA_SHIFT_Y, D / 2 + 39.1);
      irisWell.rotation.x = Math.PI / 2;

      // Six independent cutout leaves reveal the original recessed glass.
      // Each leaf keeps its own photo texture, 3D thickness, edge, and shadow.
      const irisAssembly = new THREE.Group();
      irisAssembly.position.set(-170 + CAMERA_SHIFT_X, 465 + CAMERA_SHIFT_Y, D / 2 + 38.4);
      phone.add(irisAssembly);
      const bladePalette = [0xe0e0e2, 0xd8d8db, 0xe4e4e6, 0xdadade, 0xe1e1e4, 0xd6d6da];
      const irisBlades = bladePalette.map((color, index) => {
        const group = new THREE.Group();
        const offset = new THREE.Vector2();
        irisAssembly.add(group);
        const geometry = makeIrisBlade(index);
        const material = new THREE.MeshPhysicalMaterial({ color, map: bladeTexture, alphaTest: 0.5, vertexColors: true, metalness: 0.18, roughness: 0.84, clearcoat: 0, bumpMap: bladeTexture, bumpScale: 0.05, envMap: environment.texture, envMapIntensity: 0.06, side: THREE.DoubleSide, depthWrite: true });
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uBladeOffset = { value: offset };
          shader.vertexShader = shader.vertexShader.replace("void main() {", "uniform vec2 uBladeOffset; varying vec2 vIrisClip; void main() { vIrisClip = position.xy + uBladeOffset;");
          shader.fragmentShader = shader.fragmentShader.replace("void main() {", `varying vec2 vIrisClip; void main() { if (dot(vIrisClip, vIrisClip) > ${IRIS_OUTER_RADIUS.toFixed(1)} * ${IRIS_OUTER_RADIUS.toFixed(1)}) discard;`);
        };
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        group.add(mesh);
        mesh.renderOrder = 5 + index;
        const seam = makeIrisSeam(geometry);
        const seamMaterial = new THREE.ShaderMaterial({
          uniforms: { uOpacity: { value: 0 }, uBladeOffset: { value: offset } },
          vertexShader: `uniform vec2 uBladeOffset; varying vec2 vUv; varying vec2 vIrisLocal; void main() { vUv = uv; vIrisLocal = position.xy + uBladeOffset; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform float uOpacity; varying vec2 vUv; varying vec2 vIrisLocal; void main() { if (dot(vIrisLocal, vIrisLocal) > ${IRIS_OUTER_RADIUS.toFixed(1)} * ${IRIS_OUTER_RADIUS.toFixed(1)}) discard; float falloff = pow(1.0 - vUv.x, 1.45); gl_FragColor = vec4(vec3(0.001, 0.001, 0.002), uOpacity * falloff); }`,
          side: THREE.DoubleSide, transparent: true, depthWrite: false,
        });
        const seamMesh = new THREE.Mesh(seam, seamMaterial);
        seamMesh.frustumCulled = false;
        seamMesh.renderOrder = 11 + index;
        group.add(seamMesh);
        const edge = makeIrisOverlapEdge(geometry);
        const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0x4b4b50, side: THREE.DoubleSide, transparent: true, opacity: 0.38, depthWrite: false });
        clipIrisMaterial(edgeMaterial, offset);
        const edgeMesh = new THREE.Mesh(edge, edgeMaterial);
        edgeMesh.frustumCulled = false;
        edgeMesh.renderOrder = 17 + index;
        group.add(edgeMesh);
        const lip = makeIrisLip(geometry);
        const lipMaterial = new THREE.MeshPhysicalMaterial({ color: 0x35363a, metalness: 0.52, roughness: 0.62, envMap: environment.texture, envMapIntensity: 0.35, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false });
        clipIrisMaterial(lipMaterial, offset);
        const lipMesh = new THREE.Mesh(lip, lipMaterial);
        lipMesh.frustumCulled = false;
        lipMesh.renderOrder = 23 + index;
        group.add(lipMesh);
        const contactShadow = makeIrisContactShadow(geometry);
        const contactMaterial = new THREE.ShaderMaterial({
          uniforms: { uBladeOffset: { value: offset }, uOpacity: { value: 0.7 } },
          vertexShader: `uniform vec2 uBladeOffset; varying vec2 vUv; varying vec2 vIrisLocal; void main() { vUv = uv; vIrisLocal = position.xy + uBladeOffset; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform float uOpacity; varying vec2 vUv; varying vec2 vIrisLocal; void main() { if (dot(vIrisLocal, vIrisLocal) > ${IRIS_OUTER_RADIUS.toFixed(1)} * ${IRIS_OUTER_RADIUS.toFixed(1)}) discard; float edge = pow(1.0 - vUv.x, 2.3); float tip = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y)); gl_FragColor = vec4(vec3(0.001, 0.001, 0.002), uOpacity * edge * tip); }`,
          side: THREE.DoubleSide, transparent: true, depthWrite: false,
        });
        const shadowMesh = new THREE.Mesh(contactShadow, contactMaterial);
        shadowMesh.frustumCulled = false;
        shadowMesh.renderOrder = 29 + index;
        group.add(shadowMesh);
        return { group, offset, geometry, material, seam, seamMaterial, edge, edgeMaterial, lip, lipMaterial, contactShadow, contactMaterial };
      });
      const shutterRings = [
        new THREE.MeshPhysicalMaterial({ color: 0x090b0e, metalness: 0.62, roughness: 0.32, clearcoat: 0.6, transparent: true, opacity: 0, depthWrite: false }),
        new THREE.MeshPhysicalMaterial({ color: 0x26272b, metalness: 0.54, roughness: 0.36, clearcoat: 0.32, transparent: true, opacity: 0, depthWrite: false }),
      ];
      // The existing retaining surfaces catch the same off-axis source at
      // their own depths. Highlights move slightly as the viewer approaches.
      for (const [index, material] of shutterRings.entries()) {
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uPhotoReveal = skate.material.uniforms.uReveal;
          shader.uniforms.uLensTravel = skate.material.uniforms.uTravel;
          shader.vertexShader = shader.vertexShader.replace("void main() {", "varying vec2 vRimPoint; void main() { vRimPoint = position.xy;");
          shader.fragmentShader = shader.fragmentShader.replace("void main() {", "varying vec2 vRimPoint; uniform float uPhotoReveal; uniform float uLensTravel; void main() {");
          shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `
            #include <emissivemap_fragment>
            vec2 rimDirection = normalize(vRimPoint);
            float angle = .08 * uLensTravel + ${index === 0 ? "0." : ".025"};
            vec2 key = vec2(-.71 + angle, .71);
            vec2 bounce = vec2(.94, -.34 - angle);
            float keyGlare = exp(-dot(rimDirection - key, rimDirection - key) * 180.);
            float returnGlare = exp(-dot(rimDirection - bounce, rimDirection - bounce) * 220.);
            float polishedFace = pow(max(normal.z, 0.), 3.);
            totalEmissiveRadiance += uPhotoReveal * polishedFace
              * (vec3(1.7, 1.2, .68) * keyGlare + vec3(.38, .24, .51) * returnGlare);
          `);
        };
      }
      // Recessed glass, interleaved leaves, and forward retaining ring occupy
      // separate depth planes, so the macro zoom keeps a visible well.
      add(new THREE.TorusGeometry(52.5, 0.65, 16, 256), shutterRings[0], -170 + CAMERA_SHIFT_X, 465 + CAMERA_SHIFT_Y, D / 2 + 44);
      add(new THREE.TorusGeometry(46, 0.75, 12, 192), shutterRings[1], -170 + CAMERA_SHIFT_X, 465 + CAMERA_SHIFT_Y, D / 2 + 42.8);

      const reference = createPhoneReference(photos.reference[initial]);
      const apertureParts = [...phone.children];
      const pupil = projectPhoneReference(phone, reference);
      for (const child of apertureParts) {
        child.position.x += pupil.x - (-170 + CAMERA_SHIFT_X);
        child.position.y += pupil.y - (465 + CAMERA_SHIFT_Y);
      }

      const render = (immediate = false) => {
        if (cancelled) return;
        if (immediate) {
          if (renderFrame) cancelAnimationFrame(renderFrame);
          renderFrame = 0;
          renderer.render(scene, camera);
          return;
        }
        if (renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
          renderFrame = 0;
          if (!cancelled) renderer.render(scene, camera);
        });
      };
      state = {
        renderer, scene, environment, camera, phone, detailMaterials, opticalGlass, skate, scenePhotos, sensorTexture, bladeTexture, irisAssembly, irisBlades, irisMotion: -1, shutterRings, photos, reference, current: initial, animation: 0, disposed: false, render,
        select(name) {
          if (name === this.current) return;
          if (this.animation) cancelAnimationFrame(this.animation);
          const from = this.current;
          this.current = name;
          reference.uReferenceFrom.value = photos.reference[from];
          reference.uReferenceTo.value = photos.reference[name];
          reference.uReferenceBlend.value = 0;
          const started = performance.now();
          const tick = (now: number) => {
            if (this.disposed) return;
            const p = Math.min(1, (now - started) / 420);
            const eased = p * p * (3 - 2 * p);
            reference.uReferenceBlend.value = eased;
            render();
            this.animation = p < 1 ? requestAnimationFrame(tick) : 0;
          };
          this.animation = requestAnimationFrame(tick);
        },
      };
      stateRef.current = state;
      // The six opaque leaves use custom physical shaders. Compile them while
      // loading so the first scroll into the aperture cannot block a frame.
      irisAssembly.visible = true;
      await renderer.compileAsync(scene, camera);
      irisAssembly.visible = false;
      if (cancelled) return;
      const resize = () => {
        if (state) setPhonePose(state, latest.current.turn, latest.current.lensPhase, latest.current.shutterPhase, latest.current.compact, latest.current.apertureOpen, latest.current.scenePeek, latest.current.lensTravel, latest.current.sceneExpansion);
      };
      resize();
      renderer.initTexture(skate.texture);
      renderer.initTexture(bladeTexture);
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      if (latest.current.color !== initial) state.select(latest.current.color as FinishName);
      setPhonePose(state, latest.current.turn, latest.current.lensPhase, latest.current.shutterPhase, latest.current.compact, latest.current.apertureOpen, latest.current.scenePeek, latest.current.lensTravel, latest.current.sceneExpansion);
      state.render(true);
      container.dataset.ready = "true";
      onReady?.(true);
      state.scene.userData.resizeObserver = resizeObserver;
    }
    start().catch((error) => {
      console.error("Phone model could not load", error);
      onReady?.(false);
    });

    return () => {
      cancelled = true;
      if (renderFrame) cancelAnimationFrame(renderFrame);
      if (state) {
        state.disposed = true;
        if (state.animation) cancelAnimationFrame(state.animation);
        (state.scene.userData.resizeObserver as ResizeObserver | undefined)?.disconnect();
        state.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (object.name === "Canonical product surface") (object.material as THREE.Material).dispose();
          }
        });
        for (const material of state.detailMaterials) material.dispose();
        state.opticalGlass.dispose();
        state.skate.material.dispose();
        state.skate.texture.dispose();
        state.scenePhotos.forEach((texture) => texture.dispose());
        state.sensorTexture.dispose();
        state.bladeTexture.dispose();
        state.environment.dispose();
        for (const blade of state.irisBlades) {
          blade.material.dispose();
          blade.seamMaterial.dispose();
          blade.edgeMaterial.dispose();
          blade.lipMaterial.dispose();
          blade.contactMaterial.dispose();
        }
        for (const ring of state.shutterRings) ring.dispose();
        for (const texture of Object.values(state.photos.reference)) texture.dispose();
      }
      stateRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [onReady]);

  useEffect(() => {
    const state = stateRef.current;
    if (state && color in pairSources) state.select(color as FinishName);
  }, [color]);

  useLayoutEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    setPhonePose(state, turn, lensPhase, shutterPhase, compact, apertureOpen, scenePeek, lensTravel, sceneExpansion);
    if (layoutReady && !layoutReadyRef.current) state.render(true);
    layoutReadyRef.current = layoutReady;
  }, [turn, lensPhase, shutterPhase, compact, apertureOpen, scenePeek, lensTravel, sceneExpansion, layoutReady]);

  return <div ref={mountRef} className="three-phone" aria-hidden="true" />;
}
