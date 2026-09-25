"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { createSkateOptics } from "./skate-optics";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

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
    bevelSegments: 10,
    curveSegments: 32,
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
        vec2 cell = floor(vUv * 360.);
        float grain = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453) - .5;
        float micro = sin(p.x * 116.) * sin(p.y * 103.) * .014;
        float striation = sin(r * 95. + p.x * 11.) * .008;
        float glass = .56 + .08 * (1. - r) + grain * .075 + micro + striation;
        float reflection = .055 * exp(-pow((p.y + .27 * p.x - .32) * 7., 2.));
        vec3 color = vec3(glass * .98, glass * .99, glass) + reflection;
        color *= 1. - .23 * smoothstep(.74,.99,r);
        gl_FragColor = vec4(color, uReveal * .9 * (1. - smoothstep(.96,1.,r)));
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
  environment: THREE.WebGLRenderTarget;
  camera: THREE.PerspectiveCamera;
  phone: THREE.Group;
  frame: THREE.MeshPhysicalMaterial;
  cameraMetal: THREE.MeshPhysicalMaterial;
  detailMaterials: THREE.Material[];
  opticalGlass: THREE.MeshBasicMaterial;
  skate: ReturnType<typeof createSkateOptics>;
  scenePhotos: THREE.Texture[];
  sensorTexture: THREE.Texture;
  flashGlass: THREE.ShaderMaterial;
  grain: THREE.Texture;
  bladeTexture: THREE.Texture;
  irisAssembly: THREE.Group;
  irisBlades: { group: THREE.Group; offset: THREE.Vector2; geometry: THREE.BufferGeometry; material: THREE.MeshPhysicalMaterial; seam: THREE.BufferGeometry; seamMaterial: THREE.ShaderMaterial; edge: THREE.BufferGeometry; edgeMaterial: THREE.MeshBasicMaterial; lip: THREE.BufferGeometry; lipMaterial: THREE.MeshPhysicalMaterial; contactShadow: THREE.BufferGeometry; contactMaterial: THREE.ShaderMaterial }[];
  irisMotion: number;
  shutterRings: THREE.MeshPhysicalMaterial[];
  photos: Photos;
  materials: { kind: PhotoKind; material: THREE.ShaderMaterial }[];
  current: FinishName;
  animation: number;
  disposed: boolean;
  render: (immediate?: boolean) => void;
  select: (name: FinishName) => void;
};

function setPhonePose(state: ModelState, turn: number, lensPhase: number, shutterPhase: number, compact: boolean, apertureOpen = 0, scenePeek = 0, lensTravel = 0, sceneExpansion = 0) {
  // The photographic scene fully covers the 3D phone from this point on.
  if (sceneExpansion >= 1) return;
  // Turning the rear toward the left reveals the phone's left rail and makes
  // the outward-facing optical axis project to the right of the chassis.
  state.phone.rotation.y = THREE.MathUtils.degToRad(-34 * (1 - turn) + 27 * lensPhase * (1 - shutterPhase));
  state.phone.rotation.z = THREE.MathUtils.degToRad(5 * lensPhase * (1 - shutterPhase));
  state.phone.updateMatrixWorld(true);
  const focus = new THREE.Vector3(-170, 465, D / 2 + 38.1).applyMatrix4(state.phone.matrixWorld);
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
  state.camera.setViewOffset(3600, 1310, -1020, -1310, 6000, 3930);
  state.camera.lookAt(cameraX, cameraY, 0);
  state.camera.zoom = THREE.MathUtils.lerp(1, compact ? 2.35 : 3.8, close);
  state.camera.updateProjectionMatrix();
  const canvasRect = state.renderer.domElement.getBoundingClientRect();
  const panel = state.renderer.domElement.closest(".color-panel") as HTMLElement | null;
  if (panel) {
    const bounds = panel.getBoundingClientRect();
    // The model's canvas extends well beyond the panel for macro framing.
    // Rasterize only the part the panel can actually show at full DPR.
    const clipLeft = Math.max(canvasRect.left, bounds.left);
    const clipTop = Math.max(canvasRect.top, bounds.top);
    const clipRight = Math.min(canvasRect.right, bounds.right);
    const clipBottom = Math.min(canvasRect.bottom, bounds.bottom);
    const canvas = state.renderer.domElement;
    const scaleX = canvas.clientWidth / canvasRect.width;
    const scaleY = canvas.clientHeight / canvasRect.height;
    state.renderer.setScissorTest(true);
    state.renderer.setScissor(
      (clipLeft - canvasRect.left) * scaleX,
      (canvasRect.bottom - clipBottom) * scaleY,
      Math.max(0, clipRight - clipLeft) * scaleX,
      Math.max(0, clipBottom - clipTop) * scaleY,
    );
    const width = panel.clientWidth;
    const height = panel.clientHeight;
    const canvasX = canvasRect.left - bounds.left - panel.clientLeft;
    const canvasY = canvasRect.top - bounds.top - panel.clientTop;
    const coverRadius = Math.hypot(width / 2, height / 2) + 18;
    const focalPixels = state.camera.projectionMatrix.elements[5] * canvasRect.height / 2;
    // Stop the physical dive exactly when the small pupil covers the viewport.
    // Continuing toward the surface magnified the skater into a cropped blur.
    const entryZ = focus.z + focalPixels * 16.5 / coverRadius;
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, entryZ, lensTravel);
    state.camera.near = Math.max(0.5, (state.camera.position.z - 80) * 0.45);
    state.camera.updateProjectionMatrix();
    state.camera.updateMatrixWorld(true);
    if (lensTravel > 0) {
      const projected = focus.clone().project(state.camera);
      const x = canvasX + (projected.x + 1) * canvasRect.width / 2;
      const y = canvasY + (1 - projected.y) * canvasRect.height / 2;
      const targetX = THREE.MathUtils.lerp((compact ? 0.37 : 0.225) * width, width / 2, lensTravel);
      const targetY = THREE.MathUtils.lerp((compact ? 0.53 : 0.445) * height, height / 2, lensTravel);
      state.camera.setViewOffset(3600, 1310, -1020 + (x - targetX) / canvasRect.width * 6000, -1310 + (y - targetY) / canvasRect.height * 3930, 6000, 3930);
      state.camera.updateProjectionMatrix();
    }
    state.skate.paint(width, height, window.innerWidth);
    const uniforms = state.skate.material.uniforms;
    uniforms.uCanvasRect.value.set(canvasX, canvasY, canvasRect.width, canvasRect.height);
    uniforms.uPanelSize.value.set(width, height);
    uniforms.uReveal.value = scenePeek;
    uniforms.uExpansion.value = sceneExpansion;
    uniforms.uTravel.value = lensTravel;
    uniforms.uPreviewScale.value = height / (2 * coverRadius);
  }
  const detailReveal = THREE.MathUtils.smoothstep(shutterPhase, 0.08, 0.56);
  for (const material of state.detailMaterials) {
    if (material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshBasicMaterial) material.opacity = detailReveal;
  }
  // Preserve the simple dark housing and central optic as the camera moves
  // from the photographic phone surface into the modeled aperture.
  state.opticalGlass.opacity = THREE.MathUtils.smoothstep(shutterPhase, 0.3, 0.82);
  state.opticalGlass.userData.sceneReveal.value = scenePeek * (1 - sceneExpansion);
  state.flashGlass.uniforms.uReveal.value = detailReveal;
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
    // The camera deck fills the frame during the macro move, so retain
    // subpixel coverage on the lens rims and polished chassis at that scale.
    const gl = renderer.getContext();
    const debugRenderer = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = String(gl.getParameter(debugRenderer?.UNMASKED_RENDERER_WEBGL || gl.RENDERER));
    const softwareRenderer = /swiftshader|llvmpipe|software/i.test(rendererName);
    renderer.setPixelRatio(softwareRenderer ? 1.5 : Math.max(2, Math.min(devicePixelRatio || 1, 2.5)));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    mount.appendChild(renderer.domElement);

    let cancelled = false;
    let renderFrame = 0;
    let state: ModelState | null = null;
    const loader = new THREE.TextureLoader();
    const sources = [...names.map((name) => finishes[name].rear), "/assets/iphone-side-burgundy-v3.png", "/assets/iphone-front-burgundy-v3.png", "/assets/sensor-glass.webp", "/assets/iris-blade-cutout-v5.webp", "/assets/skate-city-v1.png", "/assets/skate-rider-v1.png", "/assets/skate-board-v1.png"];

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
      const rear = Object.fromEntries(names.map((name, index) => [name, loaded[index]])) as Photos["rear"];
      const photos: Photos = { rear, side: loaded[5], front: loaded[6] };
      const initial = (latest.current.color in finishes ? latest.current.color : "Burgundy") as FinishName;
      const scene = new THREE.Scene();
      // The iris alone reflects broad studio light panels. Keeping this map
      // off the phone finish preserves the calibrated photographic transition.
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
      const polishedEdge = detail(new THREE.Color(finishes[initial].frame).lerp(new THREE.Color(0x111316), 0.52), 0.78, 0.24);
      const bladeTexture = loaded[8];
      const sensorTexture = loaded[7];
      const opticalGlass = makeOpticalGlass(sensorTexture);
      const scenePhotos = loaded.slice(9);
      const skate = createSkateOptics(scenePhotos.map((texture) => texture.image as HTMLImageElement), scenePhotos[0]);
      const sceneInLens = add(skate.geometry, skate.material, -170, 465, D / 2 + 36.4);
      sceneInLens.renderOrder = 4;
      const lenses = [
        [-170, 465],
        [-40, 396],
        [-170, 324],
      ] as const;
      const innerHousing = new THREE.MeshBasicMaterial({ color: 0x030406, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const wellWall = new THREE.MeshBasicMaterial({ color: 0x0a0b0e, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      detailMaterials.push(innerHousing, wellWall);
      const sensorGlass = new THREE.MeshBasicMaterial({ map: sensorTexture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      detailMaterials.push(sensorGlass);
      const opticGeometry = new THREE.SphereGeometry(22, 128, 64, 0, Math.PI * 2, 0, Math.PI / 2);
      opticGeometry.rotateX(Math.PI / 2);
      const opticPosition = opticGeometry.getAttribute("position");
      const opticUv = opticGeometry.getAttribute("uv");
      for (let i = 0; i < opticPosition.count; i++) {
        opticUv.setXY(i, opticPosition.getX(i) / 44 + 0.5, opticPosition.getY(i) / 44 + 0.5);
      }
      opticUv.needsUpdate = true;
      for (const [index, [x, y]] of lenses.entries()) {
        const barrel = add(new THREE.CylinderGeometry(60, 61, 15, 192), frame, x, y, D / 2 + 25);
        barrel.rotation.x = Math.PI / 2;
        add(faceUvs(new THREE.CircleGeometry(58.5, 192), x, y), rearPhoto, x, y, D / 2 + 35);
        add(new THREE.CircleGeometry(55, 256), barrelBlack, x, y, D / 2 + 35.6);
        add(new THREE.TorusGeometry(55.5, 2.5, 24, 256), polishedEdge, x, y, D / 2 + 36.4);
        if (index === 0) {
          // Keep the same restrained glass/sensor treatment at every scale.
          // The iris sits in front of this recessed optic, not a ring texture.
          add(new THREE.CircleGeometry(44, 256), innerHousing, x, y, D / 2 + 36.7);
          const optic = add(opticGeometry, opticalGlass, x, y, D / 2 + 36.9);
          optic.scale.z = 0.04;
        } else {
          // Each secondary lens is an actual recessed assembly. The wide
          // retaining flange, sloped black well, and convex optical element
          // occupy distinct depth planes instead of sharing a printed map.
          const wall = add(new THREE.CylinderGeometry(44, 38, 5.2, 192, 1, true), wellWall, x, y, D / 2 + 39.2);
          wall.rotation.x = Math.PI / 2;
          add(new THREE.CircleGeometry(38.2, 192), innerHousing, x, y, D / 2 + 36.55);
          add(new THREE.RingGeometry(44, 53.2, 192), barrelBlack, x, y, D / 2 + 42.05);
          const optic = add(opticGeometry, sensorGlass, x, y, D / 2 + 38.8);
          optic.scale.z = 0.095;
        }
      }

      const irisWell = add(new THREE.CylinderGeometry(46.2, 46.2, 3.7, 128, 1, true), barrelBlack, -170, 465, D / 2 + 39.1);
      irisWell.rotation.x = Math.PI / 2;

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

      // Six independent cutout leaves reveal the original recessed glass.
      // Each leaf keeps its own photo texture, 3D thickness, edge, and shadow.
      const irisAssembly = new THREE.Group();
      irisAssembly.position.set(-170, 465, D / 2 + 38.4);
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
      add(new THREE.TorusGeometry(52.5, 0.65, 16, 256), shutterRings[0], -170, 465, D / 2 + 44);
      add(new THREE.TorusGeometry(46, 0.75, 12, 192), shutterRings[1], -170, 465, D / 2 + 42.8);

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
        renderer, scene, environment, camera, phone, frame, cameraMetal, detailMaterials, opticalGlass, skate, scenePhotos, sensorTexture, flashGlass, grain, bladeTexture, irisAssembly, irisBlades, irisMotion: -1, shutterRings, photos, materials, current: initial, animation: 0, disposed: false, render,
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
          const rimFrom = frameFrom.clone().lerp(new THREE.Color(0x111316), 0.52);
          const rimTo = frameTo.clone().lerp(new THREE.Color(0x111316), 0.52);
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
            polishedEdge.color.lerpColors(rimFrom, rimTo, eased);
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
        if (state) setPhonePose(state, latest.current.turn, latest.current.lensPhase, latest.current.shutterPhase, latest.current.compact, latest.current.apertureOpen, latest.current.scenePeek, latest.current.lensTravel, latest.current.sceneExpansion);
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      container.dataset.ready = "true";
      onReady?.(true);
      if (latest.current.color !== initial) state.select(latest.current.color as FinishName);
      setPhonePose(state, latest.current.turn, latest.current.lensPhase, latest.current.shutterPhase, latest.current.compact, latest.current.apertureOpen, latest.current.scenePeek, latest.current.lensTravel, latest.current.sceneExpansion);
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
        state.opticalGlass.dispose();
        state.skate.material.dispose();
        state.skate.texture.dispose();
        state.scenePhotos.forEach((texture) => texture.dispose());
        state.sensorTexture.dispose();
        state.grain.dispose();
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

  useLayoutEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    setPhonePose(state, turn, lensPhase, shutterPhase, compact, apertureOpen, scenePeek, lensTravel, sceneExpansion);
  }, [turn, lensPhase, shutterPhase, compact, apertureOpen, scenePeek, lensTravel, sceneExpansion, layoutReady]);

  return <div ref={mountRef} className="three-phone" aria-hidden="true" />;
}
