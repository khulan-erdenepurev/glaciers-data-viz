import { BoxGeometry, CylinderGeometry, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, SphereGeometry } from 'three';

const clamp = value => Math.min(1, Math.max(0, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const lerp = (from, to, t) => from + (to - from) * t;

export function createStoryContext(scene) {
  const group = new Object3D();
  scene.add(group);
  const transform = new Object3D();

  function instances(geometry, colors, capacity, Material = MeshBasicMaterial) {
    const pile = new InstancedMesh(geometry, colors.length === 1 ? new Material({ color: colors[0] })
      : colors.map(color => new Material({ color })), capacity);
    pile.frustumCulled = false;
    group.add(pile);
    return pile;
  }

  const deck = instances(new BoxGeometry(), ['#879798', '#879798', '#d5dede', '#9ba9aa', '#a5b3b4', '#a5b3b4'], 48);
  const body = instances(new SphereGeometry(0.5, 12, 8), ['#49858b'], 80, MeshLambertMaterial);
  const head = instances(new SphereGeometry(0.29, 12, 8), ['#187f89'], 80, MeshLambertMaterial);
  const roofGeometry = new CylinderGeometry(0.5, 0.5, 1, 3).rotateX(-Math.PI / 2);
  const roofs = instances(roofGeometry, ['#49858b'], 12, MeshLambertMaterial);
  const meshes = [deck, body, head, roofs];
  const neighbors = [
    [-2, -1.55, 1.15], [-0.7, -1.73, 1.8], [0.65, -1.7, 1.37], [2, -1.57, 1.2],
    [1.95, -0.23, 1.65], [2, 1.29, 0.92], [-2, -0.2, 0.82], [-1.95, 1.04, 1.34],
    [-0.6, 1.66, 0.68], [0.72, 1.64, 0.96],
  ];

  function place(mesh, x, y, z, width, height = width, depth = width) {
    transform.position.set(x, y, z);
    transform.scale.set(width, height, depth);
    transform.updateMatrix();
    mesh.setMatrixAt(mesh.count++, transform.matrix);
  }

  function person(x, y, z, size) {
    if (size <= 0) return;
    place(body, x, y + 0.31 * size, z, 0.77 * size, 0.62 * size, 0.71 * size);
    place(head, x, y + 0.72 * size, z, size);
  }

  function render(position, size, journey, residents, visibility) {
    group.visible = visibility > 0;
    if (!group.visible) return;
    group.position.copy(position);
    group.scale.setScalar(size);
    meshes.forEach(mesh => { mesh.count = 0; });
    const apartment = ease(journey);
    const city = ease(journey - 1);
    place(deck, 0, -0.055, 0, lerp(2.4, 5.8, city), 0.11, lerp(1.7, 5.1, city));
    const floors = residents / 10 * apartment;
    const step = 0.36;
    const slabThickness = 0.085;
    const back = -0.75;
    const depth = 1.5;
    const baseThickness = slabThickness * ease(floors / 0.37);
    for (let floor = 0; floor < Math.ceil(floors); floor++) {
      const build = clamp(floors - floor);
      const elevation = floor * step;
      const support = floor ? ease(build / 0.35) : 0;
      if (support) {
        const gap = step - slabThickness;
        for (const x of [-1, 1]) {
          place(deck, x, elevation - gap + gap * support / 2, -0.64, 0.13, gap * support, 0.15);
        }
      }
      // The posts reach the underside before the deck builds out from the back.
      const slab = ease((build - (floor ? 0.35 : 0)) / 0.37);
      if (slab) {
        const thickness = floor ? slabThickness : baseThickness;
        const footprint = floor ? depth * slab : depth;
        place(deck, 0, elevation + thickness / 2, back + footprint / 2,
          2.15 + (floor % 2) * 0.12, thickness, footprint);
      }
      // Ten places per floor, with the original resident taking the front-left place.
      for (let index = 0; index < 10; index++) {
        if (floor === 0 && index === 0) continue;
        const arrival = ease((build - 0.72) / 0.19 - index * 0.035);
        const x = -0.77 + (index % 5) * 0.38;
        const z = index < 5 ? 0.46 : -0.12;
        person(x, elevation + slabThickness, z, arrival * 0.23);
      }
    }
    // Settle the first resident into their place before the next floor builds.
    const residentArrival = ease(apartment / 0.17);
    person(-0.77 * residentArrival, baseThickness, 0.46 * residentArrival, lerp(1.45, 0.23, residentArrival));

    neighbors.forEach(([x, z, height], index) => {
      const build = ease(city * 1.65 - index * 0.065);
      if (!build) return;
      place(deck, x, height * build / 2, z, 0.88, height * build, 0.8);
      place(roofs, x, (height + 0.1) * build, z, 1.04, 0.45 * build, 0.88);
    });
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    scene.remove(group);
    for (const mesh of meshes) {
      mesh.dispose();
      mesh.geometry.dispose();
      for (const material of [mesh.material].flat()) material.dispose();
    }
  }

  return { render, dispose };
}
