import { BoxGeometry, InstancedMesh, Object3D, OrthographicCamera, Plane, Scene, Vector3, WebGLRenderer } from 'three';
import { createPileSlots, retargetPile, pileIsSettled } from './cube-layout.js';
import { orbitView } from './orbit.js';
import { framingEnvelope, viewDirection, viewUp } from './camera-framing.js';
import { addSeasonLights, createSeasonMaterials } from './season-materials.js';

const spacing = 1.035;
const radius = axis => (Math.abs(axis.x) + Math.abs(axis.y) + Math.abs(axis.z)) / 2;

export function createArenaScene(host, capacity, columnCount, orbit) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new Scene();
  addSeasonLights(scene);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const geometry = new BoxGeometry();
  const transform = new Object3D();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const layoutSlots = createPileSlots(capacity);
  const slots = layoutSlots.map(({ x, y, z }) => new Vector3(x, y, z).multiplyScalar(spacing));
  const { radius: width, top } = framingEnvelope(layoutSlots, capacity, 1);
  const height = top * viewUp.y + 2 * width * Math.hypot(viewUp.x, viewUp.z);
  let view, verticalRadius;

  function fitView() {
    view = orbitView(viewDirection, orbit.angle);
    camera.position.copy(view.direction).multiplyScalar(100);
    camera.lookAt(0, 0, 0);
    verticalRadius = radius(view.up);
  }

  function dockFor(count, sign) {
    let dock = -Infinity;
    for (const position of slots.slice(0, count)) {
      const depth = position.x * view.up.x + position.z * view.up.z;
      dock = Math.max(dock, verticalRadius - position.y * view.up.y - sign * depth);
    }
    return dock;
  }

  fitView();
  // Opposite clipping planes keep emerging cubes on their signed side of zero.
  const materials = createSeasonMaterials();
  const meshes = materials.map(material => [1, -1].map(sign => {
    const clippingPlanes = [new Plane(view.up.clone().multiplyScalar(sign), 0)];
    const side = material.map(face => {
      const meshFace = face.clone();
      meshFace.clippingPlanes = clippingPlanes;
      return meshFace;
    });
    const mesh = new InstancedMesh(geometry, side, capacity * columnCount);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }));

  const piles = new Map();
  let frame;
  let previous = 0;
  let columns = columnCount;
  let halfHeight;
  let hostWidth = 0;
  let hostHeight = 0;

  function draw(elapsed) {
    if (!hostWidth || !hostHeight) return false;
    const aspect = hostWidth / hostHeight;
    const duel = columns === 2;
    // Fit the maximum extent once per composition. Changing data never changes the scale.
    const targetHeight = Math.max(height * 1.08, width * columns / (aspect * (duel ? 0.55 : 0.89)));
    const mix = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 95);
    halfHeight = halfHeight === undefined ? targetHeight : halfHeight + (targetHeight - halfHeight) * mix;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();

    const { right, up } = view;
    meshes.forEach(pair => pair.forEach((mesh, side) =>
      mesh.material[0].clippingPlanes[0].normal.copy(up).multiplyScalar(side ? -1 : 1)));
    const counts = [[0, 0], [0, 0]];
    let moving = Math.abs(halfHeight - targetHeight) > 0.005;
    for (const [key, pile] of piles) {
      pile.position += (pile.destination - pile.position) * mix;
      pile.progress = reducedMotion.matches ? Array(pile.target).fill(1)
        : pileIsSettled(pile.progress, pile.target) ? pile.progress : retargetPile(pile.progress, pile.target, elapsed);
      if (!pile.target && !pile.progress.length) {
        piles.delete(key);
        continue;
      }
      moving ||= !pileIsSettled(pile.progress, pile.target) || Math.abs(pile.position - pile.destination) > 0.0001;
      const side = Number(pile.sign < 0);
      const mesh = meshes[pile.season][side];
      const offset = (pile.position - 0.5) * 2 * halfHeight * aspect;
      const dock = pile.dock + (pile.targetDock - pile.dock) * mix;
      pile.dock = dock;
      moving ||= Math.abs(dock - pile.targetDock) > 0.005;
      pile.progress.forEach((amount, index) => {
        if (amount <= 0) return;
        transform.position.copy(slots[index]);
        transform.position.y *= pile.sign;
        const signedHeight = transform.position.dot(up);
        const emergence = (verticalRadius + pile.sign * signedHeight + dock) * amount - verticalRadius;
        transform.position.addScaledVector(up, pile.sign * emergence - signedHeight);
        transform.position.addScaledVector(right, offset);
        transform.updateMatrix();
        mesh.setMatrixAt(counts[pile.season][side]++, transform.matrix);
      });
    }
    meshes.forEach((pair, season) => pair.forEach((mesh, side) => {
      mesh.count = counts[season][side];
      mesh.instanceMatrix.needsUpdate = true;
    }));
    renderer.domElement.dataset.activeCubes = counts.flat().reduce((sum, count) => sum + count, 0);
    renderer.render(scene, camera);
    return moving;
  }

  function tick(now) {
    frame = undefined;
    const elapsed = Math.min(64, now - previous);
    previous = now;
    if (draw(elapsed)) frame = requestAnimationFrame(tick);
  }

  function animate() {
    if (frame !== undefined) return;
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  }

  const observer = new ResizeObserver(() => {
    hostWidth = host.clientWidth;
    hostHeight = host.clientHeight;
    renderer.setSize(hostWidth, hostHeight);
    animate();
  });
  observer.observe(host);

  function show(items) {
    columns = items.length;
    for (const pile of piles.values()) pile.target = 0;
    items.forEach(({ id, winter, summer }, column) => {
      const position = (column + (columns === 2 ? 0.68 : 0.5)) / columns;
      [winter, summer].forEach(({ count, sign }, season) => {
        if (!count) return;
        const key = `${id}/${season}/${sign}`;
        const targetDock = dockFor(count, sign);
        const pile = piles.get(key) ?? { season, sign, progress: [], position, dock: targetDock };
        Object.assign(pile, { target: count, destination: position, targetDock });
        piles.set(key, pile);
      });
    });
    animate();
  }

  const unsubscribe = orbit.subscribe(() => {
    fitView();
    for (const pile of piles.values()) {
      const count = pile.target || pile.progress.length;
      if (count) pile.dock = pile.targetDock = dockFor(count, pile.sign);
    }
    animate();
  });

  function dispose() {
    unsubscribe();
    observer.disconnect();
    cancelAnimationFrame(frame);
    geometry.dispose();
    meshes.flat().forEach(mesh => { mesh.material.forEach(face => face.dispose()); mesh.dispose(); });
    materials.flat().forEach(material => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }
  return { show, dispose };
}
