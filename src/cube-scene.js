import {
  BoxGeometry, Color, EdgesGeometry, InstancedMesh, LineBasicMaterial, LineSegments,
  Plane,
  Object3D, OrthographicCamera, Scene, Vector3, WebGLRenderer,
} from 'three';
import { createPileSlots, maxCubesPerPile, quantifyVolume, advancePiles, pileIsSettled } from './cube-layout.js';
import { createSeasonMaterials, cubeFaceMaterials, addSeasonLights } from './season-materials.js';
import { orbitView } from './orbit.js';
import { createStoryContext } from './story-context.js';
import { seasonalCubeY, seasonalDepthShift, seasonalExtent, seasonalFrame } from './seasonal-frame.js';
import { advanceTransitionCounts, scaleTransition } from './scale-transition.js';
import { chapterFrame, chapterCameraAt, mixFrame, viewDirection } from './camera-framing.js';

export function createCubeScene(container, { comparisonLimit = maxCubesPerPile, orbit } = {}) {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new Scene();
  scene.background = new Color('#eeeeee');
  const surroundings = createStoryContext(scene);
  const camera = new OrthographicCamera(-5, 5, 3, -3, 0.1, 2000);
  const geometry = new BoxGeometry();
  const materials = cubeFaceMaterials();
  const mesh = new InstancedMesh(geometry, materials, 2 * comparisonLimit);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const seasonMeshes = createSeasonMaterials().map(material => {
    const clippingPlanes = [new Plane(new Vector3(0, 1, 0), 0)];
    material.forEach(face => { face.clippingPlanes = clippingPlanes; });
    const pile = new InstancedMesh(geometry, material, comparisonLimit);
    pile.frustumCulled = false;
    pile.visible = false;
    scene.add(pile);
    return pile;
  });
  addSeasonLights(scene);
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
  let edgeRatio = 1;
  let scrubState;

  let activeScale;
  let scrollPose;
  let cameraFrame;
  let scrubTarget;
  let comparisonPose;
  let animatingPair = false;
  let journey = 0;
  let population = 40;
  let displayedPopulation = 40;
  let seasonalPose;
  let view = orbitView(viewDirection, orbit.angle);
  const anchor = new Vector3();
  const deckDepth = new Vector3();
  const separation = scale => edge * scale.edgeRatio * 17;
  function countsFor(volumes, scale) {
    return volumes.map(volume => quantifyVolume(volume, scale.volumePerCube, scale.limit).count);
  }

  function settledFrame(scale, count, aspect) {
    if (!scale) return { center: new Vector3(), halfHeight: 2.6 };
    return chapterFrame(slots, scale.frameCount ?? scale.annualCount ?? count, edge * scale.edgeRatio, aspect,
      scale.comparison ? separation(scale) : 0);
  }

  const ease = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

  function desiredFrame(aspect) {
    if (seasonalPose) {
      const { t, counts, scale, seasonCounts, signs } = seasonalPose;
      const source = settledFrame(scale, Math.max(...counts), aspect);
      const destination = seasonalFrame(slots, seasonCounts, signs, edge * scale.edgeRatio, aspect, view);
      seasonalFit = destination;
      return chapterCameraAt(source, destination, ease(t));
    }
    if (activeScale?.seasonal && !scrollPose && !comparisonPose) {
      if (!seasonalFit || seasonalFit.aspect !== aspect) {
        seasonalFit = { aspect, ...seasonalFrame(slots, targets, seasonSigns, edge * edgeRatio, aspect, view) };
      }
      return seasonalFit;
    }
    if (comparisonPose) {
      const { t, from, scale, counts } = comparisonPose;
      const source = settledFrame(from, from.count, comparisonPose.sourceAspect);
      const destination = settledFrame(scale, Math.max(...counts), container.parentElement.clientWidth / container.clientHeight);
      return chapterCameraAt(source, destination, ease(t));
    }
    if (!scrollPose) return settledFrame(activeScale, Math.max(0, ...targets), aspect);
    const { t, from, to } = scrollPose;
    return chapterCameraAt(settledFrame(from, from.count, aspect), settledFrame(to, to.count, aspect), ease(t));
  }

  function draw(elapsed = 0, immediate = false) {
    const height = container.clientHeight;
    const width = container.parentElement.clientWidth;
    const plotWidth = container.clientWidth;
    const aspect = plotWidth / height;
    if (!Number.isFinite(aspect) || !aspect) return;
    const desired = desiredFrame(aspect);
    cameraFrame = !cameraFrame || immediate || (scrollPose || comparisonPose || seasonalPose) || reducedMotion.matches
      ? desired : mixFrame(cameraFrame, desired, 1 - Math.exp(-elapsed / 180));
    const seasonal = activeScale?.seasonal && !scrollPose && !comparisonPose && !seasonalPose;
    if (seasonal) cameraFrame.center.copy(desired.center);
    const { halfHeight, center } = cameraFrame;
    // Expand the canvas over the context while retaining the existing plot frustum.
    const contextWidth = width - plotWidth;
    const worldPerPixel = 2 * halfHeight / height;
    camera.left = -halfHeight * aspect - contextWidth * worldPerPixel;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    // Keep depth clipping independent of the dramatic orthographic close-up.
    const largestEdge = edge * Math.max(edgeRatio, scrollPose?.from.edgeRatio ?? 0, scrollPose?.to.edgeRatio ?? 0);
    const distance = Math.max(20, halfHeight * 4, largestEdge * 40);
    camera.far = distance * 4;
    const contextVisibility = seasonal || (activeScale?.comparison && !comparisonPose) ? 0 : 1 - (comparisonPose?.t ?? 0);
    const { direction, right, up } = view;
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    deckDepth.set(direction.x, 0, direction.z).normalize();
    const contextSpan = comparisonPose ? width - comparisonPose.sourceAspect * height : contextWidth;
    const visualSize = Math.min(halfHeight * 0.39, contextSpan * worldPerPixel * 0.31);
    const cityProgress = Math.max(0, journey - 1);
    // Maintain the projected scale of the apartment as its neighbourhood grows.
    const sceneSize = journey === 0 ? visualSize : Math.min(visualSize, contextSpan * worldPerPixel * (0.31 - 0.17 * Math.min(1, journey)));
    const cityShift = cityProgress * contextSpan * 0.055;
    const exit = comparisonPose ? ease(comparisonPose.t) * contextSpan : 0;
    const contextX = contextSpan / 2 - cityShift - exit;
    anchor.copy(center).addScaledVector(right, (contextX - (width + contextWidth) / 2) * worldPerPixel);
    anchor.y = 0;
    const groundProjection = center.dot(up) - halfHeight * (0.25 + cityProgress * 0.05);
    const depthProjection = deckDepth.dot(up);
    if (Math.abs(depthProjection) > 0.05) {
      anchor.addScaledVector(deckDepth, (groundProjection - anchor.dot(up)) / depthProjection);
    }
    const populationGap = population - displayedPopulation;
    displayedPopulation += reducedMotion.matches || Math.abs(populationGap) < 0.04
      ? populationGap : populationGap * (1 - Math.exp(-elapsed / 85));
    surroundings.render(anchor, sceneSize, journey, displayedPopulation, contextVisibility && contextWidth > 0 ? contextVisibility : 0);

    renderer.localClippingEnabled = Boolean(seasonal || seasonalPose);
    mesh.visible = !seasonal;
    for (const pile of seasonMeshes) pile.visible = Boolean(seasonal || seasonalPose);
    container.parentElement.style.setProperty('--season-zero', `${50 + center.dot(up) / (2 * halfHeight) * 100}%`);
    let instance = 0;
    function place(index, amount, scale, offset = 0) {
      if (amount <= 0) return;
      const { x, y, z } = slots[index];
      const size = edge * scale;
      const spacing = size * 1.045;
      const liftScale = Math.min(scale, halfHeight * 0.22);
      const lift = (1 - amount) ** 2 * (0.85 + (index % 7) * 0.12) * liftScale;
      transform.position.set(x * spacing, y * spacing + size / 2 + lift, z * spacing).addScaledVector(view.right, offset);
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
        outline.position.copy(view.right).multiplyScalar(shift);
        outline.position.y = edge * to.edgeRatio / 2;
      }
    }

    outline.visible = false;
    function placeSeasons(piles, signs) {
      seasonMeshes.forEach((pile, group) => {
        const size = edge * edgeRatio;
        const sign = signs[group];
        pile.material[0].clippingPlanes[0].normal.y = sign;
        let count = 0;
        const values = piles[group];
        // Keep the physical datum at y = 0. A depth-only offset brings the
        // nearest projected edge to the on-screen zero line at this yaw.
        const extent = seasonalExtent(slots, values, sign, size, view);
        const depthShift = seasonalDepthShift(extent, sign, deckDepth, up);
        const length = typeof values === 'number' ? Math.ceil(values) : values.length;
        for (let index = 0; index < length; index++) {
          const amount = typeof values === 'number' ? Math.min(1, values - index) : values[index];
          if (amount <= 0) continue;
          const slot = slots[index];
          transform.position.set(slot.x * size * 1.045, seasonalCubeY(slot, size, sign, amount), slot.z * size * 1.045)
            .addScaledVector(deckDepth, depthShift)
            .addScaledVector(right, seasonalFit.offsets[group]);
          transform.scale.setScalar(size);
          transform.updateMatrix();
          pile.setMatrixAt(count++, transform.matrix);
        }
        pile.count = count;
        pile.instanceMatrix.needsUpdate = true;
      });
    }

    if (seasonalPose) {
      const { t, counts, seasonCounts, signs, scale } = seasonalPose;
      const city = counts[0] * (1 - ease(Math.min(1, t / 0.6)));
      const shift = ease(t);
      const loss = counts[1] * (1 - ease((t - 0.24) / 0.53));
      for (let i = 0; i < Math.ceil(city); i++) place(i, Math.min(1, city - i), edgeRatio, -separation(scale));
      for (let i = 0; i < Math.ceil(loss); i++) place(i, Math.min(1, loss - i), edgeRatio, separation(scale) * (1 - shift));
      const rise = ease((t - 0.51) / 0.49);
      placeSeasons(seasonCounts.map(count => count * rise), signs);
    } else if (seasonal) {
      placeSeasons(progress, seasonSigns);
    } else if (comparisonPose) {
      const { t, from, scale, counts, regroup, glacierGrowth } = comparisonPose;
      const offset = separation(scale);
      placeRegrouped(regroup, from.count, from, scale, -offset * ease(t));
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
    renderer.domElement.dataset.activeCubes = String(instance + (seasonal || seasonalPose ? seasonMeshes.reduce((total, pile) => total + pile.count, 0) : 0));
    renderer.domElement.dataset.cameraHalfHeight = String(halfHeight);
    renderer.render(scene, camera);
    return (contextVisibility > 0 && displayedPopulation !== population) || Math.abs(Math.log(halfHeight / desired.halfHeight)) > 0.0001 || center.distanceTo(desired.center) > 0.001;

  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(container.parentElement.clientWidth, height);
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
    const previousSeason = seasonalPose;
    seasonalPose = undefined;
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
    if (previousSeason && scale.seasonal && previousSeason.t === 1) progress = nextTargets.map(count => Array(count).fill(1));
    scrubState = undefined;
    comparisonPose = undefined;
    scrollPose = undefined;
    scrubTarget = undefined;
    activeScale = scale;
    unit = scale.volumePerCube;
    edgeRatio = scale.edgeRatio;
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
    seasonalPose = undefined;
    comparisonPose = undefined;
    animatingPair = false;
    cancelAnimationFrame(frame);
    const t = reducedMotion.matches ? Number(fraction >= 1) : fraction;
    const layout = scaleTransition(t, to.count, from.zoom, to.zoom);
    const previousScrub = scrubState;
    const continuingValues = Boolean(scrubTarget);
    scrubTarget = undefined;
    scrollPose = { t, from, to };
    if (t === 0 || t === 1) {
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
    seasonalPose = undefined;
    const t = reducedMotion.matches ? Number(fraction >= 1) : fraction;
    if (t === 0) { scrubScale(0, from, from); return; }
    const counts = countsFor(volumes, scale);
    cancelAnimationFrame(frame);
    animatingPair = false;
    scrubState = undefined;
    scrubTarget = undefined;
    scrollPose = undefined;
    activeScale = scale;
    unit = scale.volumePerCube;
    edgeRatio = scale.edgeRatio;
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

  function scrubSeasons(fraction, scale, comparison, seasons) {
    cancelAnimationFrame(frame);
    animatingPair = false;
    comparisonPose = scrollPose = scrubState = scrubTarget = undefined;
    activeScale = scale;
    edgeRatio = scale.edgeRatio;
    unit = scale.volumePerCube;
    const t = reducedMotion.matches ? Number(fraction >= 1) : fraction;
    const counts = countsFor(comparison, scale);
    const seasonCounts = countsFor(seasons.map(value => Math.abs(value ?? 0)), scale);
    const signs = seasons.map((value, i) => Math.sign(value) || (i === 0 ? 1 : -1));
    seasonalPose = { t, counts, scale, seasonCounts, signs };
    // The endpoints remain ready for the corresponding chapter's existing controls.
    targets = counts;
    progress = counts.map(count => Array(count).fill(1));
    draw();
  }

  const unsubscribe = orbit.subscribe(() => {
    view = orbitView(viewDirection, orbit.angle);
    seasonalFit = undefined;
    draw();
  });

  function dispose() {
    observer.disconnect();
    unsubscribe();
    cancelAnimationFrame(frame);
    surroundings.dispose();
    mesh.dispose();
    seasonMeshes.forEach(pile => {
      pile.dispose();
      pile.material.forEach(material => material.dispose());
    });
    geometry.dispose();
    outline.geometry.dispose();
    outline.material.dispose();
    materials.forEach(material => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }

  resize();
  return {
    show, scrubScale, scrubComparison, scrubSeasons, dispose,
    setContext(progress, residents) {
      journey = reducedMotion.matches ? Math.floor(progress) : progress;
      population = residents;
    },
  };
}
