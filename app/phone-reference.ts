import * as THREE from "three";

export function createPhoneReference(texture: THREE.Texture) {
  return {
    uReferenceFrom: { value: texture },
    uReferenceTo: { value: texture },
    uReferenceBlend: { value: 1 },
    uReferenceWeight: { value: 1 },
  };
}

export type PhoneReference = ReturnType<typeof createPhoneReference>;

/** Bake the product photograph's projection onto the resting model once. */
export function projectPhoneReference(phone: THREE.Group, reference: PhoneReference, excluded: THREE.Object3D) {
  const camera = new THREE.PerspectiveCamera(28.3, 1200 / 1310, 100, 3200);
  camera.position.set(0, 0, 2600);
  camera.setViewOffset(1200, 1310, 180, 0, 1200, 1310);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  phone.rotation.y = THREE.MathUtils.degToRad(-34);
  // Slightly overscan the source silhouette; its alpha trims the outer edge.
  // This covers the small contour differences between the photograph and CAD.
  phone.scale.set(1.025, 1.025, 1);
  phone.updateMatrixWorld(true);
  const materials = new Set<THREE.Material>();
  const usedGeometry = new Set<THREE.BufferGeometry>();
  for (const object of phone.children) {
    if (!(object instanceof THREE.Mesh) || object === excluded) continue;
    if (usedGeometry.has(object.geometry)) object.geometry = object.geometry.clone();
    usedGeometry.add(object.geometry);
    const positions = object.geometry.getAttribute("position");
    const coordinates = new Float32Array(positions.count * 3);
    const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(object.matrixWorld);
    const point = new THREE.Vector4();
    for (let i = 0; i < positions.count; i++) {
      point.set(positions.getX(i), positions.getY(i), positions.getZ(i), 1).applyMatrix4(projection);
      coordinates[i * 3] = point.x * 0.5 + point.w * (0.5 - 0.008);
      coordinates[i * 3 + 1] = point.y * 0.5 + point.w * (0.5 - 0.011);
      coordinates[i * 3 + 2] = point.w;
    }
    object.geometry.setAttribute("referenceCoord", new THREE.BufferAttribute(coordinates, 3));
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  }
  const vertex = "attribute vec3 referenceCoord; varying vec3 vReferenceCoord;\n";
  const fragment = `
    uniform sampler2D uReferenceFrom;
    uniform sampler2D uReferenceTo;
    uniform float uReferenceBlend;
    uniform float uReferenceWeight;
    varying vec3 vReferenceCoord;
  `;
  const applyReference = `
    if (uReferenceWeight > 0.001) {
      vec2 referenceUv = vReferenceCoord.xy / vReferenceCoord.z;
      vec4 referenceColor = texture2D(uReferenceTo, referenceUv);
      if (uReferenceBlend < 0.999) referenceColor = mix(texture2D(uReferenceFrom, referenceUv), referenceColor, uReferenceBlend);
      if (referenceUv.x > 0.554 || referenceUv.x < 0.0 || referenceUv.y < 0.0 || referenceUv.y > 1.0) referenceColor.a = 0.0;
      if (uReferenceWeight > 0.05 && referenceColor.a < 0.05) discard;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, referenceColor.rgb, uReferenceWeight * referenceColor.a);
    }
  `;
  const patch = (source: { vertexShader: string; fragmentShader: string }) => {
    source.vertexShader = vertex + source.vertexShader.replace("void main() {", "void main() { vReferenceCoord = referenceCoord;");
    source.fragmentShader = fragment + source.fragmentShader.replace("#include <colorspace_fragment>", applyReference + "\n#include <colorspace_fragment>");
  };
  for (const material of materials) {
    if (material instanceof THREE.ShaderMaterial) {
      Object.assign(material.uniforms, reference);
      patch(material);
    } else {
      const original = material.onBeforeCompile;
      const originalKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        original.call(material, shader, renderer);
        Object.assign(shader.uniforms, reference);
        patch(shader);
      };
      material.customProgramCacheKey = () => `${originalKey}:product-reference-v1`;
    }
    material.needsUpdate = true;
  }
}
