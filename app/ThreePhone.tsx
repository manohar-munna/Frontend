"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type FinishName = "Burgundy" | "Pearl" | "Graphite" | "Sage" | "Midnight";
type Finish = { rear: string; bounds: [number, number, number, number]; frame: string; camera: string };

const finishes: Record<FinishName, Finish> = {
  Burgundy: { rear: "/assets/iphone-rear-burgundy-v2.png", bounds: [207, 129, 816, 1404], frame: "#783245", camera: "#6d293b" },
  Pearl: { rear: "/assets/iphone-rear-pearl-v2.png", bounds: [204, 94, 824, 1430], frame: "#c8beb6", camera: "#d6ccc5" },
  Graphite: { rear: "/assets/iphone-rear-graphite-v2.png", bounds: [207, 129, 816, 1404], frame: "#50504f", camera: "#464746" },
  Sage: { rear: "/assets/iphone-rear-sage-v2.png", bounds: [207, 127, 818, 1406], frame: "#748677", camera: "#67796c" },
  Midnight: { rear: "/assets/iphone-rear-midnight-v2.png", bounds: [206, 128, 817, 1405], frame: "#304969", camera: "#283f60" },
};

const names = Object.keys(finishes) as FinishName[];
const W = 540;
const H = 1136;
const D = 62;
const R = 86;
const bitmapSize = [1024, 1536] as const;

function roundedShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function roundedPrism(width: number, height: number, depth: number, radius: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(width - bevel * 2, height - bevel * 2, radius - bevel), {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 14,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2 + bevel);
  return geometry;
}

function faceUvs(geometry: THREE.BufferGeometry, offsetX = 0, offsetY = 0) {
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    uvs.setXY(i, (positions.getX(i) + offsetX + W / 2) / W, (positions.getY(i) + offsetY + H / 2) / H);
  }
  uvs.needsUpdate = true;
  return geometry;
}

function sideUvs(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    uvs.setXY(i, (D / 2 - positions.getZ(i)) / D, (positions.getY(i) + H / 2) / H);
  }
  uvs.needsUpdate = true;
  return geometry;
}

function rearBounds(bounds: Finish["bounds"]) {
  return new THREE.Vector4(bounds[0] / bitmapSize[0], 1 - bounds[3] / bitmapSize[1], bounds[2] / bitmapSize[0], 1 - bounds[1] / bitmapSize[1]);
}

const sideBounds = new THREE.Vector4(474 / 1024, 1 - 1512 / 1536, 558 / 1024, 1 - 19 / 1536);
const frontBounds = new THREE.Vector4(194 / 1024, 1 - 1470 / 1536, 832 / 1024, 1 - 62 / 1536);

const photoVertex = `
  varying vec2 vUv;
  varying float vX;
  void main() {
    vUv = uv;
    vX = position.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const photoFragment = `
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform vec4 uBoundsFrom;
  uniform vec4 uBoundsTo;
  uniform vec3 uTintFrom;
  uniform vec3 uTintTo;
  uniform float uTinted;
  uniform float uBlend;
  varying vec2 vUv;
  varying float vX;

  vec3 sampleImage(sampler2D image, vec4 bounds, vec3 tint) {
    vec2 uv = vec2(mix(bounds.x, bounds.z, vUv.x), mix(bounds.y, bounds.w, vUv.y));
    if (uTinted > 0.5 && vX < -120.0) uv.y = mix(bounds.y, bounds.w, 0.53);
    vec3 color = texture2D(image, uv).rgb;
    if (uTinted > 0.5 && length(tint - vec3(1.0)) > 0.001) {
      float lightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = min(vec3(1.0), tint * clamp(lightness * 1.45 + 0.16, 0.1, 1.0));
    }
    return color;
  }

  void main() {
    vec3 color;
    if (uBlend <= 0.001) {
      color = sampleImage(uFrom, uBoundsFrom, uTintFrom);
    } else if (uBlend >= 0.999) {
      color = sampleImage(uTo, uBoundsTo, uTintTo);
    } else {
      vec3 from = sampleImage(uFrom, uBoundsFrom, uTintFrom);
      vec3 to = sampleImage(uTo, uBoundsTo, uTintTo);
      color = mix(from, to, uBlend);
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

type Photos = { rear: Record<FinishName, THREE.Texture>; side: THREE.Texture; front: THREE.Texture };
type PhotoKind = "rear" | "side" | "front";

function makePhoto(kind: PhotoKind, photos: Photos, initial: FinishName) {
  const image = kind === "rear" ? photos.rear[initial] : kind === "side" ? photos.side : photos.front;
  const bounds = kind === "rear" ? rearBounds(finishes[initial].bounds) : kind === "side" ? sideBounds : frontBounds;
  const tint = new THREE.Color(1, 1, 1);
  return new THREE.ShaderMaterial({
    vertexShader: photoVertex,
    fragmentShader: photoFragment,
    uniforms: {
      uFrom: { value: image },
      uTo: { value: image },
      uBoundsFrom: { value: bounds.clone() },
      uBoundsTo: { value: bounds.clone() },
      uTintFrom: { value: tint.clone() },
      uTintTo: { value: tint.clone() },
      uTinted: { value: kind === "rear" ? 0 : 1 },
      uBlend: { value: 1 },
    },
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

function finishTint(name: FinishName, kind: "side" | "front") {
  if (name === "Burgundy") return new THREE.Color(1, 1, 1);
  return new THREE.Color(kind === "side" ? finishes[name].frame : finishes[name].camera);
}

const IRIS_BLADE_COUNT = 6;
const IRIS_ARC_STEPS = 16;
const IRIS_RADIAL_STEPS = 8;

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
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  for (let radial = 0; radial <= IRIS_RADIAL_STEPS; radial++) {
    for (let arc = 0; arc <= IRIS_ARC_STEPS; arc++) {
      const vertex = radial * row + arc;
      const s = radial / IRIS_RADIAL_STEPS;
      const t = arc / IRIS_ARC_STEPS;
      const shade = 0.41 + 0.24 * Math.sin(Math.PI * t) + 0.14 * (1 - s) + 0.12 * Math.pow(1 - t, 5);
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
  updateIrisBlade(geometry, index, 0);
  return geometry;
}

function updateIrisBlade(geometry: THREE.BufferGeometry, index: number, open: number) {
  const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
  const row = IRIS_ARC_STEPS + 1;
  const faceCount = row * (IRIS_RADIAL_STEPS + 1);
  const sector = (Math.PI * 2) / IRIS_BLADE_COUNT;
  const innerRadius = THREE.MathUtils.lerp(5.8, 20.2, open);
  const innerTwist = THREE.MathUtils.lerp(0.88, 0.64, open);
  const start = index * sector + innerTwist;
  const end = (index + 1) * sector + innerTwist;
  const bladeHeight = 0.21 * (index % 3);
  const setPoint = (vertex: number, radial: number, arc: number) => {
    const t = arc / IRIS_ARC_STEPS;
    const innerX = THREE.MathUtils.lerp(Math.cos(start), Math.cos(end), t) * innerRadius;
    const innerY = THREE.MathUtils.lerp(Math.sin(start), Math.sin(end), t) * innerRadius;
    const outerAngle = (index + t) * sector + THREE.MathUtils.lerp(-0.14, 0.14, t);
    const outerX = Math.cos(outerAngle) * 45.7;
    const outerY = Math.sin(outerAngle) * 45.7;
    const bow = radial * radial * (3 - 2 * radial);
    const x = THREE.MathUtils.lerp(innerX, outerX, bow);
    const y = THREE.MathUtils.lerp(innerY, outerY, bow);
    const z = bladeHeight + (1 - radial) * 0.55 + Math.sin(t * Math.PI) * Math.sin(radial * Math.PI) * 2.8;
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
    attribute.setXYZ(faceCount + arc * 2 + 1, x, y, z - 1.5);
  }
  attribute.needsUpdate = true;
  geometry.computeVertexNormals();
}

function makeIrisSeam(blade: THREE.BufferGeometry) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((IRIS_RADIAL_STEPS + 1) * 2 * 3);
  const triangles: number[] = [];
  for (let radial = 0; radial < IRIS_RADIAL_STEPS; radial++) {
    const a = radial * 2;
    triangles.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(triangles);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 47);
  updateIrisSeam(geometry, blade);
  return geometry;
}

function updateIrisSeam(geometry: THREE.BufferGeometry, blade: THREE.BufferGeometry) {
  const seam = geometry.getAttribute("position") as THREE.BufferAttribute;
  const face = blade.getAttribute("position") as THREE.BufferAttribute;
  const row = IRIS_ARC_STEPS + 1;
  for (let radial = 0; radial <= IRIS_RADIAL_STEPS; radial++) {
    const a = radial * row;
    const b = a + 1;
    seam.setXYZ(radial * 2, face.getX(a), face.getY(a), face.getZ(a) + 0.16);
    seam.setXYZ(radial * 2 + 1,
      THREE.MathUtils.lerp(face.getX(a), face.getX(b), 0.52),
      THREE.MathUtils.lerp(face.getY(a), face.getY(b), 0.52),
      THREE.MathUtils.lerp(face.getZ(a), face.getZ(b), 0.52) + 0.16);
  }
  seam.needsUpdate = true;
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

function makeOpticalGlass() {
  return new THREE.ShaderMaterial({
    uniforms: { uReveal: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uReveal;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - .5) * 2.;
        float r = length(p);
        float angle = atan(p.y, p.x);
        float bevel = exp(-pow((r - .88) * 42., 2.));
        float pupilHalo = exp(-pow((r - .22) * 13., 2.));
        float blueGlint = exp(-length((p - vec2(-.08,.07)) * vec2(18.,23.)));
        float violetGlint = exp(-length((p - vec2(.09,-.11)) * vec2(14.,17.)));
        float outerReflection = exp(-pow((r - .79) * 19.,2.)) * max(0.,sin(angle + .8));
        vec3 color = vec3(.001,.0013,.002);
        color += vec3(.011,.013,.020) * bevel;
        color += vec3(.002,.003,.006) * pupilHalo;
        color += vec3(.045,.072,.13) * blueGlint + vec3(.028,.016,.055) * violetGlint;
        color += vec3(.014,.018,.027) * outerReflection;
        gl_FragColor = vec4(color, uReveal * (1. - smoothstep(.965,1.,r)));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function makeFlashGlass() {
  return new THREE.ShaderMaterial({
    uniforms: { uReveal: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uReveal;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - .5) * 2.;
        float r = length(p);
        float grooves = .026 * sin(r * 78.) * smoothstep(.13,.45,r);
        float pearl = .48 + .21 * (1. - r) + grooves;
        float highlight = .22 * exp(-length((p - vec2(-.24,.29)) * vec2(4.,6.)));
        float center = .13 * exp(-pow(r * 4.5,2.));
        vec3 color = vec3(pearl * .96,pearl * .97,pearl) + vec3(highlight + center);
        color *= 1. - .22 * smoothstep(.78,.99,r);
        gl_FragColor = vec4(color, uReveal * (1. - smoothstep(.96,1.,r)));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
}

function makeMicroGrain() {
  const side = 128;
  const pixels = new Uint8Array(side * side * 4);
  let seed = 74239;
  for (let index = 0; index < side * side; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 108 + ((seed >>> 24) % 40);
    pixels[index * 4] = value;
    pixels[index * 4 + 1] = value;
    pixels[index * 4 + 2] = value;
    pixels[index * 4 + 3] = 255;
  }
  const grain = new THREE.DataTexture(pixels, side, side, THREE.RGBAFormat);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(0.012, 0.012);
  grain.magFilter = THREE.LinearFilter;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.needsUpdate = true;
  return grain;
}

type ModelState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  phone: THREE.Group;
  frame: THREE.MeshPhysicalMaterial;
  cameraMetal: THREE.MeshPhysicalMaterial;
  detailMaterials: THREE.Material[];
  opticalGlass: THREE.ShaderMaterial;
  optics: THREE.MeshBasicMaterial[];
  flashGlass: THREE.ShaderMaterial;
  grain: THREE.Texture;
  irisBlades: { geometry: THREE.BufferGeometry; material: THREE.MeshPhysicalMaterial; seam: THREE.BufferGeometry; seamMaterial: THREE.MeshBasicMaterial; lip: THREE.BufferGeometry; lipMaterial: THREE.MeshPhysicalMaterial }[];
  irisOpen: number;
  shutterRings: THREE.MeshPhysicalMaterial[];
  photos: Photos;
  materials: { kind: PhotoKind; material: THREE.ShaderMaterial }[];
  current: FinishName;
  animation: number;
  disposed: boolean;
  render: () => void;
  select: (name: FinishName) => void;
};

function setPhonePose(state: ModelState, turn: number, lensPhase: number, shutterPhase: number, compact: boolean) {
  // Turning the rear toward the left reveals the phone's left rail and makes
  // the outward-facing optical axis project to the right of the chassis.
  state.phone.rotation.y = THREE.MathUtils.degToRad(-34 * (1 - turn) + 27 * lensPhase * (1 - shutterPhase));
  state.phone.rotation.z = THREE.MathUtils.degToRad(5 * lensPhase * (1 - shutterPhase));
  state.phone.updateMatrixWorld(true);
  const focus = new THREE.Vector3(-170, 465, D / 2 + 36).applyMatrix4(state.phone.matrixWorld);
  const close = shutterPhase * shutterPhase * (3 - 2 * shutterPhase);
  const targetX = focus.x + (compact ? -20 : 0);
  const targetY = focus.y - (compact ? 18 : 10);
  const cameraX = THREE.MathUtils.lerp(0, targetX, close);
  const verticalFrame = THREE.MathUtils.smoothstep(shutterPhase, 0, 0.8);
  const cameraY = THREE.MathUtils.lerp(0, targetY, verticalFrame);
  state.camera.position.set(cameraX, cameraY, THREE.MathUtils.lerp(2600, compact ? 1430 : 1320, close));
  state.camera.lookAt(cameraX, cameraY, 0);
  state.camera.zoom = THREE.MathUtils.lerp(1, compact ? 2.15 : 3.15, close);
  state.camera.updateProjectionMatrix();
  const detailReveal = THREE.MathUtils.smoothstep(shutterPhase, 0.08, 0.56);
  for (const material of state.detailMaterials) {
    if (material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshBasicMaterial) material.opacity = detailReveal;
  }
  state.opticalGlass.uniforms.uReveal.value = detailReveal;
  state.optics[0].opacity = detailReveal * 0.28;
  state.optics[1].opacity = detailReveal * 0.26;
  state.flashGlass.uniforms.uReveal.value = detailReveal;
  const reveal = THREE.MathUtils.smoothstep(shutterPhase, 0.35, 0.9);
  const open = THREE.MathUtils.smoothstep(shutterPhase, 0.5, 1);
  if (Math.abs(state.irisOpen - open) > 0.0001) {
    for (let index = 0; index < state.irisBlades.length; index++) {
      const blade = state.irisBlades[index];
      updateIrisBlade(blade.geometry, index, open);
      updateIrisSeam(blade.seam, blade.geometry);
      updateIrisLip(blade.lip, blade.geometry);
    }
    state.irisOpen = open;
  }
  for (const blade of state.irisBlades) {
    blade.material.opacity = reveal;
    blade.seamMaterial.opacity = reveal * 0.52;
    blade.lipMaterial.opacity = reveal;
  }
  for (const ring of state.shutterRings) ring.opacity = reveal;
  state.render();
}

export default function ThreePhone({ color, turn, lensPhase, shutterPhase, compact, onReady }: { color: string; turn: number; lensPhase: number; shutterPhase: number; compact: boolean; onReady?: (ready: boolean) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ color, turn, lensPhase, shutterPhase, compact });
  latest.current = { color, turn, lensPhase, shutterPhase, compact };
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
    // The phone occupies only part of the stage. A full 2x canvas adds four
    // times the fragment work without improving this on-screen size.
    const gl = renderer.getContext();
    const debugRenderer = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = String(gl.getParameter(debugRenderer?.UNMASKED_RENDERER_WEBGL || gl.RENDERER));
    const softwareRenderer = /swiftshader|llvmpipe|software/i.test(rendererName);
    renderer.setPixelRatio(softwareRenderer ? 1 : Math.min(devicePixelRatio || 1, 1.3));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    mount.appendChild(renderer.domElement);

    let cancelled = false;
    let renderFrame = 0;
    let state: ModelState | null = null;
    const loader = new THREE.TextureLoader();
    const sources = [...names.map((name) => finishes[name].rear), "/assets/iphone-side-burgundy-v3.png", "/assets/iphone-front-burgundy-v3.png"];

    async function start() {
      const loaded = await Promise.all(sources.map((src) => loader.loadAsync(src)));
      if (cancelled) {
        loaded.forEach((texture) => texture.dispose());
        return;
      }
      loaded.forEach((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
      });
      const rear = Object.fromEntries(names.map((name, index) => [name, loaded[index]])) as Photos["rear"];
      const photos: Photos = { rear, side: loaded[5], front: loaded[6] };
      const initial = (latest.current.color in finishes ? latest.current.color : "Burgundy") as FinishName;
      const scene = new THREE.Scene();
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
      const frame = new THREE.MeshPhysicalMaterial({ color: finishes[initial].frame, metalness: 0.66, roughness: 0.25, clearcoat: 0.7 });
      const cameraMetal = new THREE.MeshPhysicalMaterial({ color: finishes[initial].camera, metalness: 0.52, roughness: 0.3, clearcoat: 0.7 });
      const detailMaterials: THREE.Material[] = [];
      const detail = (color: THREE.ColorRepresentation, metalness: number, roughness: number) => {
        const material = new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: 0.75, transparent: true, opacity: 0, depthWrite: false });
        detailMaterials.push(material);
        return material;
      };
      const materials: ModelState["materials"] = [];
      const photo = (kind: PhotoKind) => {
        const material = makePhoto(kind, photos, initial);
        materials.push({ kind, material });
        return material;
      };
      const rearPhoto = photo("rear");
      const sidePhoto = photo("side");
      const frontPhoto = photo("front");
      const add = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        phone.add(mesh);
        return mesh;
      };

      // The chassis has the same outline as the reference rear photograph.
      // Its sides stay attached while the textured rear and front rotate.
      add(sideUvs(roundedPrism(W, H, D, R, 3)), [frame, sidePhoto]);
      add(faceUvs(new THREE.ShapeGeometry(roundedShape(W - 3, H - 3, R - 2), 24)), rearPhoto, 0, 0, D / 2 + 1.8);
      // Keep the calibrated rear finish through the entire move. The deck and
      // barrels have matching photo faces, then reveal finer macro detail.
      const deckX = -100;
      const deckY = 397;
      add(roundedPrism(282, 292, 14, 53, 2), cameraMetal, deckX, deckY, D / 2 + 7);
      add(faceUvs(new THREE.ShapeGeometry(roundedShape(279, 289, 51), 16), deckX, deckY), rearPhoto, deckX, deckY, D / 2 + 16.5);
      const deckFinish = detail(finishes[initial].camera, 0.46, 0.3);
      const grain = makeMicroGrain();
      deckFinish.bumpMap = grain;
      deckFinish.bumpScale = 0.42;
      deckFinish.needsUpdate = true;
      add(new THREE.ShapeGeometry(roundedShape(276, 286, 50), 32), deckFinish, deckX, deckY, D / 2 + 16.85);
      const barrelBlack = detail(0x080a0d, 0.44, 0.24);
      const polishedEdge = detail(finishes[initial].frame, 0.78, 0.21);
      const innerEdge = detail(0x171a20, 0.67, 0.2);
      const opticalGlass = makeOpticalGlass();
      detailMaterials.push(opticalGlass);
      const lenses = [
        [-170, 465],
        [-40, 396],
        [-170, 324],
      ] as const;
      for (const [x, y] of lenses) {
        const barrel = add(new THREE.CylinderGeometry(60, 61, 15, 96), frame, x, y, D / 2 + 25);
        barrel.rotation.x = Math.PI / 2;
        add(faceUvs(new THREE.CircleGeometry(58.5, 96), x, y), rearPhoto, x, y, D / 2 + 35);
        add(new THREE.CircleGeometry(55, 128), barrelBlack, x, y, D / 2 + 35.6);
        add(new THREE.TorusGeometry(55.5, 2.5, 16, 128), polishedEdge, x, y, D / 2 + 36.4);
        add(new THREE.TorusGeometry(48.8, 1.25, 12, 128), innerEdge, x, y, D / 2 + 37.1);
        add(new THREE.CircleGeometry(45.5, 128), opticalGlass, x, y, D / 2 + 37.4);
      }

      const irisWell = add(new THREE.CylinderGeometry(46.2, 46.2, 3.7, 128, 1, true), barrelBlack, -170, 465, D / 2 + 39.1);
      irisWell.rotation.x = Math.PI / 2;
      const opticCoating = new THREE.MeshBasicMaterial({ color: 0x141722, transparent: true, opacity: 0.28, depthWrite: false });
      const opticGlint = new THREE.MeshBasicMaterial({ color: 0x292436, transparent: true, opacity: 0.26, depthWrite: false });
      add(new THREE.TorusGeometry(17.2, 0.35, 8, 96), opticCoating, -170, 465, D / 2 + 38.2);
      add(new THREE.TorusGeometry(10.2, 0.24, 8, 96), opticGlint, -170, 465, D / 2 + 38.5);

      const flashRing = detail(0xa6a5a4, 0.75, 0.21);
      const flashGlass = makeFlashGlass();
      detailMaterials.push(flashGlass);
      const sensorRing = detail(0x34373a, 0.52, 0.27);
      const microphoneRing = detail(0x9a6a75, 0.58, 0.3);
      for (const surface of [flashRing, flashGlass, sensorRing, microphoneRing]) surface.depthTest = false;
      const addDeckDetail = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
        const mesh = add(geometry, material, x, y, z);
        mesh.renderOrder = 10;
        return mesh;
      };
      // These positions are measured against the calibrated photograph. The
      // macro details land exactly over its flash and depth sensor.
      addDeckDetail(new THREE.TorusGeometry(22, 2, 12, 96), flashRing, -35, 491, D / 2 + 22.5);
      addDeckDetail(new THREE.CircleGeometry(20, 96), flashGlass, -35, 491, D / 2 + 23);
      addDeckDetail(new THREE.TorusGeometry(22, 1.5, 12, 96), sensorRing, -36, 292, D / 2 + 22.5);
      addDeckDetail(new THREE.CircleGeometry(20, 96), barrelBlack, -36, 292, D / 2 + 23);
      addDeckDetail(new THREE.TorusGeometry(4.1, 0.8, 8, 48), microphoneRing, 7, 319, D / 2 + 22.5);
      addDeckDetail(new THREE.CircleGeometry(3.3, 48), barrelBlack, 7, 319, D / 2 + 23);

      // Six individual curved metal leaves reveal the recessed optical glass.
      // Their inner edges form the changing aperture; the meshes carry real
      // surface normals and thickness rather than a drawn shutter texture.
      const bladePalette = [0x101116, 0x121318, 0x0e0f14, 0x111217, 0x0f1015, 0x131419];
      const irisBlades = bladePalette.map((color, index) => {
        const geometry = makeIrisBlade(index);
        const material = new THREE.MeshPhysicalMaterial({ color, vertexColors: true, metalness: 0.34, roughness: 0.52, clearcoat: 0.12, bumpMap: grain, bumpScale: 0.06, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: true });
        const mesh = add(geometry, material, -170, 465, D / 2 + 40.4);
        mesh.renderOrder = 5 + index;
        const seam = makeIrisSeam(geometry);
        const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x030407, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false });
        add(seam, seamMaterial, -170, 465, D / 2 + 40.4).renderOrder = 11 + index;
        const lip = makeIrisLip(geometry);
        const lipMaterial = new THREE.MeshPhysicalMaterial({ color: 0x333137, metalness: 0.68, roughness: 0.38, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false });
        add(lip, lipMaterial, -170, 465, D / 2 + 40.4).renderOrder = 17 + index;
        return { geometry, material, seam, seamMaterial, lip, lipMaterial };
      });
      const shutterRings = [
        new THREE.MeshPhysicalMaterial({ color: 0x13151a, metalness: 0.78, roughness: 0.23, clearcoat: 0.8, transparent: true, opacity: 0, depthWrite: false }),
        new THREE.MeshPhysicalMaterial({ color: 0x343139, metalness: 0.68, roughness: 0.28, clearcoat: 0.7, transparent: true, opacity: 0, depthWrite: false }),
      ];
      add(new THREE.TorusGeometry(53, 3, 16, 128), shutterRings[0], -170, 465, D / 2 + 41.2);
      add(new THREE.TorusGeometry(46, 1.25, 12, 128), shutterRings[1], -170, 465, D / 2 + 42);

      const frontGlass = add(faceUvs(new THREE.ShapeGeometry(roundedShape(W - 10, H - 10, R - 7), 24)), frontPhoto, 0, 0, -D / 2 - 2);
      frontGlass.rotation.y = Math.PI;

      // Three separately raised controls and an opposing action key. The side
      // reference supplies their machined contours; the meshes supply depth.
      for (const [y, height] of [[348, 54], [254, 66], [150, 66]] as const) {
        const geometry = roundedPrism(24, height, 5, 11, 1.3);
        const positions = geometry.getAttribute("position");
        const uvs = geometry.getAttribute("uv");
        for (let i = 0; i < positions.count; i++) {
          uvs.setXY(i, (D / 2 + positions.getX(i)) / D, (positions.getY(i) + y + H / 2) / H);
        }
        const button = add(geometry, [frame, sidePhoto], W / 2 + 2.5, y, 0);
        button.rotation.y = Math.PI / 2;
      }
      add(roundedPrism(23, 64, 5, 10, 1.3), frame, -W / 2 - 3, 208, 0).rotation.y = -Math.PI / 2;

      const render = () => {
        if (renderFrame || cancelled) return;
        renderFrame = requestAnimationFrame(() => {
          renderFrame = 0;
          if (!cancelled) renderer.render(scene, camera);
        });
      };
      state = {
        renderer, scene, camera, phone, frame, cameraMetal, detailMaterials, opticalGlass, optics: [opticCoating, opticGlint], flashGlass, grain, irisBlades, irisOpen: 0, shutterRings, photos, materials, current: initial, animation: 0, disposed: false, render,
        select(name) {
          if (name === this.current) return;
          if (this.animation) cancelAnimationFrame(this.animation);
          const from = this.current;
          this.current = name;
          for (const { kind, material } of this.materials) {
            const a = material.uniforms;
            a.uFrom.value = kind === "rear" ? photos.rear[from] : kind === "side" ? photos.side : photos.front;
            a.uTo.value = kind === "rear" ? photos.rear[name] : kind === "side" ? photos.side : photos.front;
            a.uBoundsFrom.value = kind === "rear" ? rearBounds(finishes[from].bounds) : kind === "side" ? sideBounds : frontBounds;
            a.uBoundsTo.value = kind === "rear" ? rearBounds(finishes[name].bounds) : kind === "side" ? sideBounds : frontBounds;
            a.uTintFrom.value = kind === "rear" ? new THREE.Color(1, 1, 1) : finishTint(from, kind);
            a.uTintTo.value = kind === "rear" ? new THREE.Color(1, 1, 1) : finishTint(name, kind);
            a.uBlend.value = 0;
          }
          const frameFrom = new THREE.Color(finishes[from].frame);
          const frameTo = new THREE.Color(finishes[name].frame);
          const deckFrom = new THREE.Color(finishes[from].camera);
          const deckTo = new THREE.Color(finishes[name].camera);
          const started = performance.now();
          const tick = (now: number) => {
            if (this.disposed) return;
            const p = Math.min(1, (now - started) / 420);
            const eased = p * p * (3 - 2 * p);
            for (const { material } of this.materials) material.uniforms.uBlend.value = eased;
            frame.color.lerpColors(frameFrom, frameTo, eased);
            cameraMetal.color.lerpColors(deckFrom, deckTo, eased);
            polishedEdge.color.lerpColors(frameFrom, frameTo, eased);
            deckFinish.color.lerpColors(deckFrom, deckTo, eased);
            render();
            this.animation = p < 1 ? requestAnimationFrame(tick) : 0;
          };
          this.animation = requestAnimationFrame(tick);
        },
      };
      stateRef.current = state;
      const resize = () => {
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        camera.setViewOffset(3600, 1310, 180, 0, 3600, 1310);
        render();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      container.dataset.ready = "true";
      onReady?.(true);
      if (latest.current.color !== initial) state.select(latest.current.color as FinishName);
      setPhonePose(state, latest.current.turn, latest.current.lensPhase, latest.current.shutterPhase, latest.current.compact);
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
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        for (const { material } of state.materials) material.dispose();
        state.frame.dispose();
        state.cameraMetal.dispose();
        for (const material of state.detailMaterials) material.dispose();
        for (const material of state.optics) material.dispose();
        state.grain.dispose();
        for (const blade of state.irisBlades) {
          blade.material.dispose();
          blade.seamMaterial.dispose();
          blade.lipMaterial.dispose();
        }
        for (const ring of state.shutterRings) ring.dispose();
        for (const texture of [...Object.values(state.photos.rear), state.photos.side, state.photos.front]) texture.dispose();
      }
      stateRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [onReady]);

  useEffect(() => {
    const state = stateRef.current;
    if (state && color in finishes) state.select(color as FinishName);
  }, [color]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    setPhonePose(state, turn, lensPhase, shutterPhase, compact);
  }, [turn, lensPhase, shutterPhase, compact]);

  return <div ref={mountRef} className="three-phone" aria-hidden="true" />;
}
