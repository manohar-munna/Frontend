"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

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
  const geometry = new THREE.ExtrudeGeometry(roundedShape(width - 2 * bevel, height - 2 * bevel, radius - bevel), {
    depth: depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 12,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2 + bevel);
  return geometry;
}

function finishTexture(canvas: HTMLCanvasElement, hex: string) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { width, height } = canvas;
  context.fillStyle = hex;
  context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(width * 0.15, height * 0.02, 0, width * 0.15, height * 0.02, height * 0.85);
  glow.addColorStop(0, "rgba(255,255,255,.19)");
  glow.addColorStop(0.38, "rgba(255,255,255,.045)");
  glow.addColorStop(1, "rgba(0,0,0,.13)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  const shade = context.createLinearGradient(0, 0, width, 0);
  shade.addColorStop(0, "rgba(0,0,0,.12)");
  shade.addColorStop(0.12, "rgba(255,255,255,.025)");
  shade.addColorStop(0.86, "rgba(0,0,0,.02)");
  shade.addColorStop(1, "rgba(0,0,0,.18)");
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
}

type PhoneFinish = {
  body: string;
  frame: string;
  island: string;
  logo: string;
};

const finishes: Record<string, PhoneFinish> = {
  Burgundy: { body: "#713041", frame: "#8c4457", island: "#763346", logo: "#401725" },
  Pearl: { body: "#ddd7d2", frame: "#beb5b1", island: "#d8d0ca", logo: "#958c88" },
  Graphite: { body: "#484947", frame: "#656561", island: "#50514e", logo: "#292a28" },
  Sage: { body: "#687e72", frame: "#7e9486", island: "#6e8476", logo: "#3f564a" },
  Midnight: { body: "#223b5e", frame: "#38567d", island: "#2a4568", logo: "#142b4a" },
};

function appleMark() {
  const apple = new THREE.Shape();
  apple.moveTo(0, 38);
  apple.bezierCurveTo(-17, 50, -31, 49, -42, 39);
  apple.bezierCurveTo(-69, 16, -55, -29, -37, -43);
  apple.bezierCurveTo(-23, -54, -9, -42, 0, -42);
  apple.bezierCurveTo(11, -42, 24, -55, 39, -42);
  apple.bezierCurveTo(48, -34, 53, -23, 54, -15);
  apple.bezierCurveTo(29, -15, 18, 10, 33, 28);
  apple.bezierCurveTo(39, 35, 46, 38, 53, 38);
  apple.bezierCurveTo(42, 62, 26, 76, 8, 68);
  apple.bezierCurveTo(2, 65, -3, 65, -9, 68);
  apple.bezierCurveTo(-30, 76, -48, 59, -56, 39);
  apple.bezierCurveTo(-60, 31, -62, 22, -61, 12);
  apple.bezierCurveTo(-58, 28, -50, 37, -42, 39);
  const leaf = new THREE.Shape();
  leaf.moveTo(0, 74);
  leaf.bezierCurveTo(3, 99, 16, 110, 37, 111);
  leaf.bezierCurveTo(34, 90, 19, 76, 0, 74);
  const group = new THREE.Group();
  for (const shape of [apple, leaf]) {
    const geometry = new THREE.ShapeGeometry(shape, 16);
    const mesh = new THREE.Mesh(geometry);
    mesh.position.z = 0;
    group.add(mesh);
  }
  return group;
}

export default function ThreePhone({ color, turn }: { color: string; turn: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    phone: THREE.Group;
    colored: Record<keyof PhoneFinish, THREE.MeshPhysicalMaterial>;
    backCanvas: HTMLCanvasElement;
    backTexture: THREE.CanvasTexture;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36.3, 1200 / 1310, 1, 5000);
    camera.position.set(0, 0, 2000);
    camera.lookAt(0, 0, 0);
    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-550, 800, 1100);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xe7d3dd, 1.8);
    rim.position.set(700, 0, 650);
    scene.add(rim);
    const bottom = new THREE.DirectionalLight(0x8dacc5, 0.8);
    bottom.position.set(0, -700, 450);
    scene.add(bottom);

    const phone = new THREE.Group();
    phone.position.set(-180, 5, 0);
    scene.add(phone);
    const colored = {
      body: new THREE.MeshPhysicalMaterial({ color: 0x713041, metalness: 0.34, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
      frame: new THREE.MeshPhysicalMaterial({ color: 0x8c4457, metalness: 0.82, roughness: 0.24, clearcoat: 1 }),
      island: new THREE.MeshPhysicalMaterial({ color: 0x763346, metalness: 0.44, roughness: 0.28, clearcoat: 1 }),
      logo: new THREE.MeshPhysicalMaterial({ color: 0x401725, metalness: 0.32, roughness: 0.33, clearcoat: 1, side: THREE.DoubleSide }),
    };
    const backCanvas = document.createElement("canvas");
    backCanvas.width = 512;
    backCanvas.height = 1024;
    finishTexture(backCanvas, finishes.Burgundy.body);
    const backTexture = new THREE.CanvasTexture(backCanvas);
    backTexture.colorSpace = THREE.SRGBColorSpace;
    const backFinish = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: backTexture, metalness: 0.22, roughness: 0.42, clearcoat: 0.62, clearcoatRoughness: 0.24, side: THREE.DoubleSide });
    const black = new THREE.MeshPhysicalMaterial({ color: 0x0b0d14, metalness: 0.42, roughness: 0.17, clearcoat: 1 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x131b2a, metalness: 0.48, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 });
    const lensHighlight = new THREE.MeshPhysicalMaterial({ color: 0x23374a, metalness: 0.6, roughness: 0.13, clearcoat: 1 });
    const flashMaterial = new THREE.MeshPhysicalMaterial({ color: 0xfff6e9, emissive: 0xffe8cc, emissiveIntensity: 0.65, roughness: 0.23 });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      phone.add(mesh);
      return mesh;
    };

    add(roundedPrism(577, 1143, 42, 52, 5), colored.frame, 0, 0, 0);
    add(roundedPrism(562, 1128, 6, 46, 2), colored.body, 0, 0, 23);
    const faceGeometry = new THREE.ShapeGeometry(roundedShape(554, 1120, 42), 12);
    const facePositions = faceGeometry.getAttribute("position");
    const faceUvs = faceGeometry.getAttribute("uv");
    for (let index = 0; index < facePositions.count; index++) {
      faceUvs.setXY(index, (facePositions.getX(index) + 277) / 554, (facePositions.getY(index) + 560) / 1120);
    }
    add(faceGeometry, backFinish, 0, 0, 28);
    add(roundedPrism(240, 240, 18, 42, 3), colored.island, -120, 399, 38);

    const lens = (x: number, y: number) => {
      const disk = (radius: number, depth: number, z: number, material: THREE.Material) => {
        const mesh = add(new THREE.CylinderGeometry(radius, radius, depth, 64), material, x, y, z);
        mesh.rotation.x = Math.PI / 2;
      };
      disk(48, 11, 53, colored.frame);
      disk(42, 9, 60, black);
      disk(35, 3, 66, lensHighlight);
      disk(31, 4, 69, glass);
      disk(12, 1, 72, black);
      add(new THREE.TorusGeometry(28, 2.3, 10, 64), lensHighlight, x, y, 72);
      add(new THREE.TorusGeometry(38, 1.6, 10, 64), colored.frame, x, y, 65);
    };
    lens(-181, 464);
    lens(-62, 404);
    lens(-181, 339);
    add(new THREE.CylinderGeometry(16, 16, 4, 48), flashMaterial, -62, 485, 52).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(15, 15, 4, 48), black, -62, 321, 52).rotation.x = Math.PI / 2;
    const logo = appleMark();
    logo.position.set(-3, -60, 29);
    logo.scale.setScalar(0.72);
    logo.traverse((object) => { if (object instanceof THREE.Mesh) object.material = colored.logo; });
    phone.add(logo);

    for (const [x, y, height] of [[292, 340, 60], [292, 210, 68], [292, 105, 68], [-292, 225, 74]] as const) {
      add(new RoundedBoxGeometry(8, height, 18, 3, 4), colored.frame, x, y, 0);
    }
    // The display and camera cutout complete the reusable object, even though
    // this scene chiefly presents its rear and its volume-button edge.
    const screen = new THREE.MeshPhysicalMaterial({ color: 0x080b13, roughness: 0.08, clearcoat: 1 });
    add(roundedPrism(552, 1117, 2, 44, 0.4), screen, 0, 0, -23);
    add(new RoundedBoxGeometry(108, 28, 2, 4, 14), black, 0, 495, -25);

    const resize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    sceneRef.current = { renderer, scene, camera, phone, colored, backCanvas, backTexture };
    return () => {
      observer.disconnect();
      sceneRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      for (const material of [...Object.values(colored), backFinish, black, glass, lensHighlight, flashMaterial, screen]) material.dispose();
      backTexture.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    const finish = finishes[color] ?? finishes.Burgundy;
    (Object.keys(state.colored) as (keyof PhoneFinish)[]).forEach((part) => state.colored[part].color.set(finish[part]));
    finishTexture(state.backCanvas, finish.body);
    state.backTexture.needsUpdate = true;
    state.renderer.render(state.scene, state.camera);
  }, [color]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.phone.rotation.y = (-38 * (1 - turn) * Math.PI) / 180;
    state.renderer.render(state.scene, state.camera);
  }, [turn]);

  return <div ref={mountRef} className="three-phone" aria-hidden="true" />;
}
