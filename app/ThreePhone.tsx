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

function makeAperture() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uOpen;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float radius = length(p);
        float angle = atan(p.y, p.x);
        float blades = cos(angle * 6.0 + uOpen * 1.3);
        float opening = mix(0.08, 0.57, uOpen);
        float edge = opening + 0.018 * blades;
        float pupil = 1.0 - smoothstep(edge - 0.055, edge + 0.03, radius);
        float rim = exp(-pow((radius - edge) * 32.0, 2.0));
        float reflection = exp(-length((p - vec2(-0.22, 0.28)) * vec2(2.0, 2.9)) * 9.0);
        vec3 color = vec3(0.006, 0.01, 0.018);
        color += vec3(0.035, 0.11, 0.16) * reflection;
        color += vec3(0.09, 0.12, 0.16) * rim;
        float alpha = uOpen * (pupil * 0.92 + rim * 0.28) * (1.0 - smoothstep(0.88, 0.98, radius));
        gl_FragColor = vec4(color, alpha);
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
  aperture: THREE.ShaderMaterial;
  photos: Photos;
  materials: { kind: PhotoKind; material: THREE.ShaderMaterial }[];
  current: FinishName;
  animation: number;
  disposed: boolean;
  render: () => void;
  select: (name: FinishName) => void;
};

function setPhonePose(state: ModelState, turn: number, lensPhase: number) {
  // Positive yaw brings the left edge and the camera cluster toward the viewer.
  state.phone.rotation.y = THREE.MathUtils.degToRad(-34 * (1 - turn) + 15 * lensPhase);
  state.phone.rotation.z = THREE.MathUtils.degToRad(5 * lensPhase);
  const focusX = -160 * lensPhase;
  const focusY = 420 * lensPhase;
  state.camera.position.set(focusX, focusY, 2600);
  state.camera.lookAt(focusX, focusY, 0);
  state.camera.zoom = 1 + 1.32 * lensPhase;
  state.camera.updateProjectionMatrix();
  state.aperture.uniforms.uOpen.value = lensPhase;
  state.render();
}

export default function ThreePhone({ color, turn, lensPhase, onReady }: { color: string; turn: number; lensPhase: number; onReady?: (ready: boolean) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ color, turn, lensPhase });
  latest.current = { color, turn, lensPhase };
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
    renderer.setPixelRatio(softwareRenderer ? 1 : Math.min(devicePixelRatio || 1, 1.25));
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

      // A real raised camera deck and separate barrels use the same calibrated
      // photograph, so lens rings do not change appearance at the handoff.
      const deckX = -100;
      const deckY = 397;
      add(roundedPrism(282, 292, 14, 53, 2), cameraMetal, deckX, deckY, D / 2 + 7);
      add(faceUvs(new THREE.ShapeGeometry(roundedShape(279, 289, 51), 16), deckX, deckY), rearPhoto, deckX, deckY, D / 2 + 16.5);
      const lenses = [
        [-170, 465],
        [-40, 396],
        [-170, 324],
      ] as const;
      for (const [x, y] of lenses) {
        const barrel = add(new THREE.CylinderGeometry(60, 61, 15, 48), frame, x, y, D / 2 + 25);
        barrel.rotation.x = Math.PI / 2;
        add(faceUvs(new THREE.CircleGeometry(58.5, 48), x, y), rearPhoto, x, y, D / 2 + 35);
      }

      // The aperture sits above the photographic lens face by a full millimeter.
      // It only becomes visible during the close-up, avoiding overlapping depth faces.
      const aperture = makeAperture();
      add(new THREE.CircleGeometry(43, 72), aperture, -170, 465, D / 2 + 36);

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
        renderer, scene, camera, phone, frame, cameraMetal, aperture, photos, materials, current: initial, animation: 0, disposed: false, render,
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
            render();
            this.animation = p < 1 ? requestAnimationFrame(tick) : 0;
          };
          this.animation = requestAnimationFrame(tick);
        },
      };
      stateRef.current = state;
      const resize = () => {
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        render();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      container.dataset.ready = "true";
      onReady?.(true);
      if (latest.current.color !== initial) state.select(latest.current.color as FinishName);
      setPhonePose(state, latest.current.turn, latest.current.lensPhase);
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
        state.aperture.dispose();
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
    setPhonePose(state, turn, lensPhase);
  }, [turn, lensPhase]);

  return <div ref={mountRef} className="three-phone" aria-hidden="true" />;
}
