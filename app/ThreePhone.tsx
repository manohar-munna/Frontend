"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type FinishName = "Burgundy" | "Pearl" | "Graphite" | "Sage" | "Midnight";
type Finish = { rear: string; bounds: [number, number, number, number]; frame: string; camera: string; back: string };

const finishes: Record<FinishName, Finish> = {
  Burgundy: { rear: "/assets/iphone-rear-burgundy-v2.png", bounds: [207, 129, 816, 1404], frame: "#783245", camera: "#6d293b", back: "#512431" },
  Pearl: { rear: "/assets/iphone-rear-pearl-v2.png", bounds: [204, 94, 824, 1430], frame: "#c8beb6", camera: "#d6ccc5", back: "#aaa29d" },
  Graphite: { rear: "/assets/iphone-rear-graphite-v2.png", bounds: [207, 129, 816, 1404], frame: "#50504f", camera: "#464746", back: "#343537" },
  Sage: { rear: "/assets/iphone-rear-sage-v2.png", bounds: [207, 127, 818, 1406], frame: "#748677", camera: "#67796c", back: "#596a5d" },
  Midnight: { rear: "/assets/iphone-rear-midnight-v2.png", bounds: [206, 128, 817, 1405], frame: "#304969", camera: "#283f60", back: "#213753" },
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

function makeShutterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uReveal: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uReveal;
      uniform float uOpen;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float blade = fract(a * 0.95492966 + r * 0.22 + 0.5 + uOpen * 0.07);
        float opening = mix(0.11, 0.34, uOpen) + 0.014 * cos(a * 6.0);
        float pupil = 1.0 - smoothstep(opening - 0.022, opening + 0.025, r);
        float seam = 1.0 - smoothstep(0.0, 0.017, blade);
        float bladeLight = 0.009 + 0.005 * cos(a * 6.0 + r * 4.0);
        vec3 metal = vec3(0.003, 0.0035, 0.0045) + vec3(bladeLight) * smoothstep(opening, opening + 0.12, r);
        metal += vec3(0.050, 0.048, 0.055) * seam * smoothstep(opening + 0.05, opening + 0.16, r) * (1.0 - smoothstep(0.8, 0.9, r));
        float innerGlow = exp(-pow((r - opening * 0.72) * 38.0, 2.0));
        vec3 glass = vec3(0.0006, 0.0007, 0.002) + vec3(0.01, 0.004, 0.022) * innerGlow;
        glass += vec3(0.042, 0.034, 0.057) * exp(-length((p - vec2(-0.1, 0.1)) * 18.0));
        vec3 color = mix(metal, glass, pupil);
        color += vec3(0.012, 0.01, 0.014) * exp(-pow((r - 0.82) * 36.0, 2.0));
        float alpha = uReveal * (1.0 - smoothstep(0.93, 0.99, r));
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
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
        float bevel = exp(-pow((r - .87) * 30., 2.));
        float innerRing = exp(-pow((r - .55) * 27., 2.));
        float iris = exp(-pow((r - .29) * 24., 2.));
        float blueGlint = exp(-length((p - vec2(-.12,.12)) * vec2(10.,15.)));
        float violetGlint = exp(-length((p - vec2(.14,-.18)) * vec2(8.,12.)));
        vec3 color = vec3(.006,.009,.015);
        color += vec3(.018,.027,.046) * bevel;
        color += vec3(.008,.012,.022) * innerRing;
        color += vec3(.012,.022,.040) * iris;
        color += vec3(.09,.15,.24) * blueGlint + vec3(.065,.028,.10) * violetGlint;
        color += vec3(.015,.025,.043) * max(0.,sin(angle*2.+.7)) * smoothstep(.35,.75,r);
        gl_FragColor = vec4(color, uReveal * (1. - smoothstep(.965,1.,r)));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

type ModelState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  phone: THREE.Group;
  frame: THREE.MeshPhysicalMaterial;
  cameraMetal: THREE.MeshPhysicalMaterial;
  backSurface: THREE.MeshPhysicalMaterial;
  detailMaterials: THREE.Material[];
  opticalGlass: THREE.ShaderMaterial;
  shutter: THREE.ShaderMaterial;
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
  state.backSurface.opacity = detailReveal;
  for (const material of state.detailMaterials) {
    if (material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshBasicMaterial) material.opacity = detailReveal;
  }
  state.opticalGlass.uniforms.uReveal.value = detailReveal;
  const reveal = THREE.MathUtils.smoothstep(shutterPhase, 0.5, 0.82);
  state.shutter.uniforms.uReveal.value = reveal;
  state.shutter.uniforms.uOpen.value = THREE.MathUtils.clamp((shutterPhase - 0.57) / 0.43, 0, 1);
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
      const backSurface = new THREE.MeshPhysicalMaterial({ color: finishes[initial].back, metalness: 0.18, roughness: 0.41, clearcoat: 0.26, transparent: true, opacity: 0, depthWrite: false });
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
      // The hero uses a calibrated photograph. At macro distance a continuous
      // modeled finish takes over, so its edges and camera face stay sharp.
      add(new THREE.ShapeGeometry(roundedShape(W - 3, H - 3, R - 2), 32), backSurface, 0, 0, D / 2 + 2.1);

      // A real raised camera deck and separate barrels use the same calibrated
      // photograph, so lens rings do not change appearance at the handoff.
      const deckX = -100;
      const deckY = 397;
      add(roundedPrism(282, 292, 14, 53, 2), cameraMetal, deckX, deckY, D / 2 + 7);
      add(faceUvs(new THREE.ShapeGeometry(roundedShape(279, 289, 51), 16), deckX, deckY), rearPhoto, deckX, deckY, D / 2 + 16.5);
      const deckFinish = detail(finishes[initial].camera, 0.46, 0.3);
      add(new THREE.ShapeGeometry(roundedShape(276, 286, 50), 32), deckFinish, deckX, deckY, D / 2 + 16.85);
      const barrelBlack = detail(0x080a0d, 0.44, 0.24);
      const polishedEdge = detail(0x949aa2, 0.84, 0.19);
      const innerEdge = detail(0x252b32, 0.7, 0.23);
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
        add(new THREE.TorusGeometry(47.5, 1.35, 12, 128), innerEdge, x, y, D / 2 + 37.1);
        add(new THREE.CircleGeometry(45.5, 128), opticalGlass, x, y, D / 2 + 37.4);
      }

      const flashRing = detail(0xa6a5a4, 0.75, 0.21);
      const flashGlass = detail(0xe9e5da, 0.02, 0.11);
      const sensorRing = detail(0x34373a, 0.52, 0.27);
      add(new THREE.TorusGeometry(17.5, 2, 12, 96), flashRing, -40, 469, D / 2 + 18.2);
      add(new THREE.CircleGeometry(15.5, 96), flashGlass, -40, 469, D / 2 + 18.5);
      add(new THREE.TorusGeometry(18, 1.5, 12, 96), sensorRing, -40, 324, D / 2 + 18.2);
      add(new THREE.CircleGeometry(16, 96), barrelBlack, -40, 324, D / 2 + 18.5);

      // The main camera uses a six-blade variable aperture. Keep the close-up
      // attached to its actual lens instead of moving dozens of glass meshes.
      const shutter = makeShutterMaterial();
      add(new THREE.CircleGeometry(45.5, 128), shutter, -170, 465, D / 2 + 38.2);
      const shutterRings = [
        new THREE.MeshPhysicalMaterial({ color: 0x13151a, metalness: 0.78, roughness: 0.23, clearcoat: 0.8, transparent: true, opacity: 0, depthWrite: false }),
        new THREE.MeshPhysicalMaterial({ color: 0x343139, metalness: 0.68, roughness: 0.28, clearcoat: 0.7, transparent: true, opacity: 0, depthWrite: false }),
      ];
      add(new THREE.TorusGeometry(53, 3, 16, 128), shutterRings[0], -170, 465, D / 2 + 39.2);
      add(new THREE.TorusGeometry(46, 1.25, 12, 128), shutterRings[1], -170, 465, D / 2 + 40);

      // The reference deck already has a precisely aligned flash and dark
      // sensor. Extra disks doubled their outlines and overlapped the photo.

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
        renderer, scene, camera, phone, frame, cameraMetal, backSurface, detailMaterials, opticalGlass, shutter, shutterRings, photos, materials, current: initial, animation: 0, disposed: false, render,
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
          const backFrom = new THREE.Color(finishes[from].back);
          const backTo = new THREE.Color(finishes[name].back);
          const started = performance.now();
          const tick = (now: number) => {
            if (this.disposed) return;
            const p = Math.min(1, (now - started) / 420);
            const eased = p * p * (3 - 2 * p);
            for (const { material } of this.materials) material.uniforms.uBlend.value = eased;
            frame.color.lerpColors(frameFrom, frameTo, eased);
            cameraMetal.color.lerpColors(deckFrom, deckTo, eased);
            deckFinish.color.lerpColors(deckFrom, deckTo, eased);
            backSurface.color.lerpColors(backFrom, backTo, eased);
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
        state.backSurface.dispose();
        for (const material of state.detailMaterials) material.dispose();
        state.shutter.dispose();
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
