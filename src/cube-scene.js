import {
  BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, Object3D,
  OrthographicCamera, Scene, WebGLRenderer,
} from 'three';
import { createPileSlots, maxCubesPerPile, quantifyVolume, retargetPile } from './cube-layout.js';

export function createCubeScene(container, { frameHalfWidth = 5.3 } = {}) {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new Scene();
  scene.background = new Color('#eeeeee');
  const camera = new OrthographicCamera(-5, 5, 3, -3, 0.1, 50);
  camera.position.set(6, 4, 9);
  camera.lookAt(0, 0.9, 0);

  const geometry = new BoxGeometry();
  const materials = ['#49858b', '#49858b', '#a1c9cc', '#315c60', '#6da3a8', '#6da3a8']
    .map(color => new MeshBasicMaterial({ color }));
  const mesh = new InstancedMesh(geometry, materials, maxCubesPerPile * 2);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const transform = new Object3D();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const slots = createPileSlots();
  const edge = 0.26;
  const spacing = edge * 1.045;
  let unit;
  let targets = [];
  let progress = [];
  let frame;

  function draw() {
    let instance = 0;
    progress.forEach((pile, group) => {
      const offset = progress.length === 2 ? (group === 0 ? -2.35 : 2.35) : 0;
      pile.forEach((amount, index) => {
        if (amount === 0) return;
        const { x, y, z } = slots[index];
        const lift = (1 - amount) ** 2 * (0.85 + (index % 7) * 0.12);
        transform.position.set(offset + x * spacing, y * spacing + edge / 2 + lift, z * spacing);
        transform.scale.setScalar(edge);
        transform.updateMatrix();
        mesh.setMatrixAt(instance++, transform.matrix);
      });
    });
    mesh.count = instance;
    mesh.instanceMatrix.needsUpdate = true;
    renderer.domElement.dataset.activeCubes = String(instance);
    renderer.render(scene, camera);
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(2.6, frameHalfWidth / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    draw();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function show(volumes, { volumePerCube }) {
    const nextTargets = volumes.map(volume => quantifyVolume(volume, volumePerCube).count);
    cancelAnimationFrame(frame);
    if (unit !== volumePerCube || targets.length !== nextTargets.length) {
      progress = nextTargets.map(() => []);
    }
    unit = volumePerCube;
    targets = nextTargets;
    if (reducedMotion.matches) {
      progress = targets.map(count => Array(count).fill(1));
      draw();
      return;
    }

    let previous = performance.now();
    function tick(now) {
      progress = targets.map((count, index) => retargetPile(progress[index], count, now - previous));
      previous = now;
      draw();
      if (progress.some((pile, index) => pile.length !== targets[index] || pile.some(value => value < 1))) {
        frame = requestAnimationFrame(tick);
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function dispose() {
    observer.disconnect();
    cancelAnimationFrame(frame);
    mesh.dispose();
    geometry.dispose();
    materials.forEach(material => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }

  resize();
  return { show, dispose };
}
