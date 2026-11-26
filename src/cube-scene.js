import {
  BoxGeometry, Color, EdgesGeometry, InstancedMesh, LineBasicMaterial, LineSegments,
  Plane,
  MeshBasicMaterial, Object3D, OrthographicCamera, Scene, Vector3, WebGLRenderer,
} from 'three';
import { createPileSlots, maxCubesPerPile, quantifyVolume, advancePiles, pileIsSettled } from './cube-layout.js';
import { createSeasonMaterials, addSeasonLights } from './season-materials.js';
import { seasonalFrame, seasonalDirection } from './seasonal-frame.js';
import { advanceTransitionCounts, scaleTransition } from './scale-transition.js';
import { cityFrame, pileFrame, mixFrame, revealProgress, viewDirection, viewRight, comparisonFrame } from './camera-framing.js';

export function createCubeScene(container, { frameHalfWidth = 5.3, comparisonLimit = maxCubesPerPile } = {}) {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new Scene();
  scene.background = new Color('#eeeeee');
  const camera = new OrthographicCamera(-5, 5, 3, -3, 0.1, 2000);
  const geometry = new BoxGeometry();
  const materials = ['#49858b', '#49858b', '#a1c9cc', '#315c60', '#6da3a8', '#6da3a8']
    .map(color => new MeshBasicMaterial({ color }));
  const mesh = new InstancedMesh(geometry, materials, 2 * comparisonLimit);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const seasonMeshes = createSeasonMaterials().map(material => {
    material.clippingPlanes = [new Plane(new Vector3(0, 1, 0), 0)];
    const pile = new InstancedMesh(geometry, material, comparisonLimit);
    pile.frustumCulled = false;
    pile.visible = false;
    scene.add(pile);
    return pile;
  });
  addSeasonLights(scene);
  const storyBackground = scene.background;
  const seasonalBackground = new Color('#e5eef1');
  let seasonSigns = [1, -1];
  let seasonalFit;
  const outline = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: '#006b76', transparent: true }));
  outline.visible = false;
  scene.add(outline);

  const transform = new Object3D();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const slots = createPileSlots(comparisonLimit);
  const edge = 0.26;
  let unit;
  let targets = [];
  let progress = [];
  let frame;
  let zoom = 1;
  let edgeRatio = 1;
  let scrubState;

  let activeScale;
  let scrollPose;
  let cameraFrame;
  let scrubTarget;
  let animateScrubCamera = false;
  let comparisonPose;
  let animatingPair = false;
  const separation = scale => edge * scale.edgeRatio * 17;
  function countsFor(volumes, scale) {
    return volumes.map(volume => quantifyVolume(volume, scale.volumePerCube, scale.limit).count);
  }

  function baseFrame(scale, aspect) {
    return { center: new Vector3(0, 0.9 * scale.zoom, 0), halfHeight: Math.max(2.6, frameHalfWidth / aspect) * scale.zoom };
  }

  function settledFrame(scale, count, aspect) {
    if (!scale) return baseFrame({ zoom }, aspect);
    if (!scale.fitCity) {
      const fitted = pileFrame(slots, count, edge * scale.edgeRatio, aspect);
      const baseline = baseFrame(scale, aspect);
      fitted.halfHeight = Math.max(baseline.halfHeight * 0.55, fitted.halfHeight * 1.12 + edge * scale.edgeRatio);
      return fitted;
    }
    return cityFrame(slots, count, scale.annualCount, edge * scale.edgeRatio, aspect);
  }

  function desiredFrame(aspect) {
    if (activeScale?.seasonal && !scrollPose && !comparisonPose) {
      if (!seasonalFit || seasonalFit.aspect !== aspect) {
        seasonalFit = { aspect, ...seasonalFrame(slots, targets, seasonSigns, edge * edgeRatio, aspect) };
      }
      return seasonalFit;
    }
    if (comparisonPose) {
      const { t, from, scale, counts, sourceAspect } = comparisonPose;
      return mixFrame(settledFrame(from, from.count, sourceAspect),
        comparisonFrame(slots, counts, edge * scale.edgeRatio, aspect, separation(scale)), t * t * (3 - 2 * t));
    }
    if (activeScale?.comparison && !scrollPose) return comparisonFrame(slots, targets, edge * edgeRatio, aspect, separation(activeScale));
    if (!scrollPose) return settledFrame(activeScale, targets[0] ?? 0, aspect);
    const { t, from, to } = scrollPose;
    const narrative = baseFrame({ zoom }, aspect);
    // Anchor both ends to their chapter framing. Preserve the established city
    // close-up in the middle; only the entrance blends from the apartment camera.
    const entrance = mixFrame(settledFrame(from, from.count, aspect), narrative, Math.min(1, t / 0.3));
    return mixFrame(entrance, settledFrame(to, to.count, aspect), revealProgress(t));
  }

  function draw(elapsed = 0, immediate = false) {
    const aspect = container.clientWidth / container.clientHeight;
    if (!Number.isFinite(aspect) || !aspect) return;
    const desired = desiredFrame(aspect);
    cameraFrame = !cameraFrame || immediate || ((scrollPose || comparisonPose) && !animateScrubCamera) || reducedMotion.matches
      ? desired : mixFrame(cameraFrame, desired, 1 - Math.exp(-elapsed / 180));
    const seasonal = activeScale?.seasonal && !scrollPose && !comparisonPose;
    if (seasonal) cameraFrame.center.copy(desired.center);
    const { halfHeight, center } = cameraFrame;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    // Keep depth clipping independent of the dramatic orthographic close-up.
    const largestEdge = edge * Math.max(edgeRatio, scrollPose?.from.edgeRatio ?? 0, scrollPose?.to.edgeRatio ?? 0);
    const distance = Math.max(20, halfHeight * 4, largestEdge * 40);
    camera.far = distance * 4;
    camera.position.copy(center).addScaledVector(seasonal ? seasonalDirection : viewDirection, distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    renderer.localClippingEnabled = Boolean(seasonal);
    mesh.visible = !seasonal;
    scene.background = seasonal ? seasonalBackground : storyBackground;
    for (const pile of seasonMeshes) pile.visible = Boolean(seasonal);
    let instance = 0;
    function place(index, amount, scale, offset = 0) {
      if (amount <= 0) return;
      const { x, y, z } = slots[index];
      const size = edge * scale;
      const spacing = size * 1.045;
      const liftScale = scrubState ? Math.min(scale, zoom * 0.65) : scale;
      const lift = (1 - amount) ** 2 * (0.85 + (index % 7) * 0.12) * liftScale;
      transform.position.set(x * spacing, y * spacing + size / 2 + lift, z * spacing).addScaledVector(viewRight, offset);
      transform.scale.setScalar(size);
      transform.updateMatrix();
      mesh.setMatrixAt(instance++, transform.matrix);
    }

    function placeRegrouped(layout, sourceCount, from, to, shift = 0) {
      const remaining = sourceCount * layout.sourceWeight;
      for (let i = 0; i < Math.ceil(remaining); i++) {
        place(i, Math.min(1, remaining - i), from.edgeRatio, shift);
      }
      for (let i = remaining > 0 ? 1 : 0; i < Math.ceil(layout.growth); i++) {
        place(i, Math.min(1, layout.growth - i), to.edgeRatio, shift);
      }
      outline.visible = Boolean(layout.groupingOpacity);
      if (outline.visible) {
        outline.material.opacity = layout.groupingOpacity;
        outline.scale.setScalar(edge * to.edgeRatio);
        outline.position.copy(viewRight).multiplyScalar(shift);
        outline.position.y = edge * to.edgeRatio / 2;
      }
    }

    outline.visible = false;
    if (seasonal) {
      seasonMeshes.forEach((pile, group) => {
        const size = edge * edgeRatio;
        const sign = seasonSigns[group];
        pile.material.clippingPlanes[0].normal.y = sign;
        let count = 0;
        progress[group].forEach((amount, index) => {
          if (amount <= 0) return;
          const { x, y, z } = slots[index];
          // Push each new cube outward from the dividing plane. A cube emerges
          // through the zero plane without changing its physical dimensions.
          const height = ((y * 1.045 + 1) * amount - 0.5) * size;
          transform.position.set(x * size * 1.045, sign * height, z * size * 1.045)
            .addScaledVector(viewRight, seasonalFit.offsets[group]);
          transform.scale.setScalar(size);
          transform.updateMatrix();
          pile.setMatrixAt(count++, transform.matrix);
        });
        pile.count = count;
        pile.instanceMatrix.needsUpdate = true;
        instance += count;
      });
    } else if (comparisonPose) {
      const { t, from, scale, counts, regroup, glacierGrowth } = comparisonPose;
      const offset = separation(scale);
      placeRegrouped(regroup, from.count, from, scale, -offset * t);
      const growing = counts[1] * glacierGrowth;
      for (let i = 0; i < Math.ceil(growing); i++) {
        place(i, Math.min(1, growing - i), scale.edgeRatio, offset);
      }
    } else if (scrubState) {
      placeRegrouped(scrubState, scrubState.sourceCount, scrubState.from, scrubState.to);
    } else {
      progress.forEach((pile, group) => {
        const offset = progress.length === 2 ? (group === 0 ? -1 : 1) * separation(activeScale) : 0;
        pile.forEach((amount, index) => place(index, amount, edgeRatio, offset));
      });
    }

    mesh.count = seasonal ? 0 : instance;
    mesh.instanceMatrix.needsUpdate = true;
    renderer.domElement.dataset.activeCubes = String(instance);
    renderer.domElement.dataset.cameraHalfHeight = String(halfHeight);
    renderer.render(scene, camera);
    return Math.abs(Math.log(halfHeight / desired.halfHeight)) > 0.0001 || center.distanceTo(desired.center) > 0.001;

  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    draw(0, true);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function animate(advance) {
    cancelAnimationFrame(frame);
    let previous = performance.now();
    function tick(now) {
      const elapsed = Math.min(64, now - previous);
      previous = now;
      if (advance(elapsed)) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  function show(volumes, scale) {
    const nextTargets = countsFor(scale.seasonal ? volumes.map(v => Math.abs(v ?? 0)) : volumes, scale);
    const nextSigns = scale.seasonal ? volumes.map((v, i) => Math.sign(v) || (i === 0 ? 1 : -1)) : [];
    seasonalFit = undefined;
    const paired = Boolean(scale.comparison || scale.seasonal);
    const keepLoop = paired && animatingPair && !reducedMotion.matches;
    if (!keepLoop) cancelAnimationFrame(frame);
    if (Boolean(scale.seasonal) !== Boolean(activeScale?.seasonal) || scrubState || unit !== scale.volumePerCube || targets.length !== nextTargets.length) {
      progress = nextTargets.map(() => []);
    }
    if (scale.seasonal) {
      nextSigns.forEach((sign, i) => { if (seasonSigns[i] !== sign) progress[i] = []; });
      seasonSigns = nextSigns;
    }
    scrubState = undefined;
    comparisonPose = undefined;
    scrollPose = undefined;
    scrubTarget = undefined;
    activeScale = scale;
    unit = scale.volumePerCube;
    edgeRatio = scale.edgeRatio;
    zoom = scale.zoom;
    targets = nextTargets;
    if (reducedMotion.matches) {
      progress = targets.map(count => Array(count).fill(1));
      animatingPair = false;
      draw();
      return;
    }

    if (keepLoop) return;
    animatingPair = paired;
    animate(elapsed => {
      progress = advancePiles(progress, targets, elapsed);
      const movingCamera = draw(elapsed);
      const movingPiles = progress.some((pile, index) => !pileIsSettled(pile, targets[index]));
      if (!movingCamera && !movingPiles) animatingPair = false;
      return movingCamera || movingPiles;
    });
  }

  function scrubScale(fraction, from, to, { animateValues = false } = {}) {
    comparisonPose = undefined;
    animatingPair = false;
    cancelAnimationFrame(frame);
    const t = reducedMotion.matches ? Number(fraction >= 1) : fraction;
    const layout = scaleTransition(t, to.count, from.zoom, to.zoom);
    const previousScrub = scrubState;
    const continuingValues = Boolean(scrubTarget);
    animateScrubCamera = animateValues || continuingValues;
    scrubTarget = undefined;
    zoom = layout.zoom;
    scrollPose = { t, from, to };
    if (t === 0 || t === 1) {
      animateScrubCamera = false;
      scrubState = undefined;
      const endpoint = t === 0 ? from : to;
      targets = [endpoint.count];
      progress = [Array(endpoint.count).fill(1)];
      edgeRatio = endpoint.edgeRatio;
      unit = endpoint.volumePerCube;
      activeScale = endpoint;
    } else {
      const next = { ...layout, sourceCount: from.count, destinationCount: to.count, from, to };
      if ((animateValues || continuingValues) && previousScrub && !reducedMotion.matches &&
          previousScrub.from.volumePerCube === from.volumePerCube && previousScrub.to.volumePerCube === to.volumePerCube) {
        scrubState = { ...next, sourceCount: previousScrub.sourceCount, destinationCount: previousScrub.destinationCount,
          growth: scaleTransition(t, previousScrub.destinationCount, from.zoom, to.zoom).growth };
        scrubTarget = next;
      } else {
        scrubState = next;
      }
    }
    draw();
    if (scrubTarget) {
      animate(elapsed => {
        Object.assign(scrubState, advanceTransitionCounts(scrubState, scrubTarget, elapsed));
        scrubState.growth = scaleTransition(t, scrubState.destinationCount, from.zoom, to.zoom).growth;
        const done = scrubState.sourceCount === scrubTarget.sourceCount &&
          scrubState.destinationCount === scrubTarget.destinationCount;
        if (done) scrubState = { ...scrubTarget };
        const movingCamera = draw(elapsed);
        if (done && !movingCamera) scrubTarget = undefined;
        return !done || movingCamera;
      });
    }
  }

  function scrubComparison(fraction, from, scale, volumes, sourceAspect) {
    const t = reducedMotion.matches ? Number(fraction >= 1) : fraction;
    if (t === 0) { scrubScale(0, from, from); return; }
    const counts = countsFor(volumes, scale);
    cancelAnimationFrame(frame);
    animatingPair = false;
    scrubState = undefined;
    scrubTarget = undefined;
    scrollPose = undefined;
    animateScrubCamera = false;
    activeScale = scale;
    unit = scale.volumePerCube;
    edgeRatio = scale.edgeRatio;
    zoom = scale.zoom;
    // Regroup the moving city in place before the glacier enters at the shared unit.
    const regroup = scaleTransition(t / 0.65, counts[0], from.zoom, scale.zoom);
    const glacierGrowth = Math.max(0, (t - 0.65) / 0.35);
    comparisonPose = { t, from, scale, counts, sourceAspect, regroup, glacierGrowth };
    if (t === 1) {
      targets = counts;
      progress = counts.map(count => Array(count).fill(1));
    }
    draw();
  }

  function dispose() {
    observer.disconnect();
    cancelAnimationFrame(frame);
    mesh.dispose();
    seasonMeshes.forEach(pile => {
      pile.dispose();
      pile.material.map.dispose();
      pile.material.dispose();
    });
    geometry.dispose();
    outline.geometry.dispose();
    outline.material.dispose();
    materials.forEach(material => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }

  resize();
  return { show, scrubScale, scrubComparison, dispose };
}
