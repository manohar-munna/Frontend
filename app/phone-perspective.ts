type Point = readonly [number, number];
type Quad = readonly [Point, Point, Point, Point];

// Corners of the rear glass and right rail in the original 1200 x 1310 render.
// The two surfaces share their seam, so the initial projection is the hero image.
const rear: Quad = [[178, 129], [624, 39], [624, 1260], [178, 1220]];
const rail: Quad = [[624, 39], [666, 57], [666, 1275], [624, 1260]];

function projectionMatrix(source: Quad, target: Quad, scale: number) {
  const equations: number[][] = [];
  source.forEach(([sx, sy], index) => {
    const x = sx * scale;
    const y = sy * scale;
    const u = target[index][0] * scale;
    const v = target[index][1] * scale;
    equations.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    equations.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  // Solve the homography, preserving the source texture instead of swapping to
  // an unrelated render. CSS applies the resulting perspective division.
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) {
      if (Math.abs(equations[row][column]) > Math.abs(equations[pivot][column])) pivot = row;
    }
    [equations[column], equations[pivot]] = [equations[pivot], equations[column]];
    const divisor = equations[column][column];
    for (let entry = column; entry < 9; entry++) equations[column][entry] /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = equations[row][column];
      for (let entry = column; entry < 9; entry++) equations[row][entry] -= factor * equations[column][entry];
    }
  }
  const [a, b, c, d, e, f, g, h] = equations.map((row) => row[8]);
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].join(",")})`;
}

export function phonePerspective(progress: number, scale: number) {
  const yaw = (-38 * (1 - progress) * Math.PI) / 180;
  const project = (x: number, y: number, z: number, angle: number): Point => {
    const rotatedX = x * Math.cos(angle) + z * Math.sin(angle);
    const rotatedZ = -x * Math.sin(angle) + z * Math.cos(angle);
    const perspective = 2600 / (2600 - rotatedZ);
    return [420 + rotatedX * perspective, 650 + y * perspective];
  };
  const rearVertices = [[-260, -590, 16], [260, -590, 16], [260, 590, 16], [-260, 590, 16]] as const;
  const railVertices = [[260, -590, 16], [260, -590, -24], [260, 590, -24], [260, 590, 16]] as const;
  const transform = (source: Quad, vertices: typeof rearVertices | typeof railVertices) => {
    const target = vertices.map(([x, y, z], index): Point => {
      const initial = project(x, y, z, -38 * Math.PI / 180);
      const current = project(x, y, z, yaw);
      // Camera calibration decays to zero as the rear becomes square to view.
      return [
        current[0] + (source[index][0] - initial[0]) * (1 - progress),
        current[1] + (source[index][1] - initial[1]) * (1 - progress),
      ];
    }) as unknown as Quad;
    return progress === 0 ? "none" : projectionMatrix(source, target, scale);
  };
  return { rear: transform(rear, rearVertices), rail: transform(rail, railVertices) };
}
