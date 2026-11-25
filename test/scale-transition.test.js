import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apartmentScale, cityCubeScale, cubeScale, individualUnit, scaleTransition } from '../src/scale-transition.js';
import { maxCubesPerPile, quantifyVolume } from '../src/cube-layout.js';

test('city cubes group a whole number of apartment cubes on each edge', () => {
  const annual = 43_265_020.23;
  const scale = cityCubeScale(annual);
  assert.ok(Math.abs(scale.edgeRatio / apartmentScale.edgeRatio - 12) < 1e-9);
  assert.equal(scale.volumePerCube, 34_560);
  assert.equal(quantifyVolume(annual, scale.volumePerCube).count, 1251);
  assert.equal(quantifyVolume(3_556_029.06, scale.volumePerCube).count, 102);
  for (const volume of [annual, 1_422_558_871.59]) {
    const { volumePerCube } = cityCubeScale(volume);
    assert.ok(quantifyVolume(volume, volumePerCube).count <= maxCubesPerPile);
  }
});

test('zoom and city growth advance with scroll and reproduce the same intermediate states on reversal', () => {
  for (const count of [102, 1251]) {
    const frames = [0, 0.25, 0.5, 0.75, 1];
    const forward = frames.map(t => scaleTransition(t, count, 2.05, 16.482));
    const reverse = frames.toReversed().map(t => scaleTransition(t, count, 2.05, 16.482));
    assert.deepEqual(forward, reverse.toReversed());
    assert.equal(forward[0].zoom, 2.05);
    assert.equal(forward[0].sourceWeight, 1);
    assert.equal(forward.at(-1).sourceWeight, 0);
    assert.equal(forward.at(-1).growth, count);
    assert.ok(forward.every((state, index) => index === 0 ||
      (state.zoom > forward[index - 1].zoom && state.growth >= forward[index - 1].growth)));
  }
});

test('individual and apartment cubes share physical scale while the camera pulls back partway', () => {
  const individual = cubeScale(individualUnit);
  const ratio = apartmentScale.edgeRatio / individual.edgeRatio;
  assert.ok(Math.abs(ratio ** 3 - 20 / individualUnit) < 1e-9);
  assert.ok(apartmentScale.zoom > individual.zoom);
  assert.ok(ratio > apartmentScale.zoom / individual.zoom);
  const first = scaleTransition(0, 15, individual.zoom, apartmentScale.zoom);
  const last = scaleTransition(1, 15, individual.zoom, apartmentScale.zoom);
  assert.equal(first.sourceWeight, 1);
  assert.equal(last.growth, 15);
  assert.equal(last.zoom, apartmentScale.zoom);
});

test('value changes during LOD transitions retain in-flight counts on reversal', async () => {
  const { advanceTransitionCounts } = await import('../src/scale-transition.js');
  let current = { sourceCount: 15, destinationCount: 102 };
  const larger = { sourceCount: 382, destinationCount: 1251 };
  current = advanceTransitionCounts(current, larger, 16);
  assert.ok(current.sourceCount > 15 && current.sourceCount < 382);
  const interrupted = current.sourceCount;
  const smaller = { sourceCount: 15, destinationCount: 102 };
  current = advanceTransitionCounts(current, smaller, 16);
  assert.ok(current.sourceCount < interrupted && current.sourceCount > 15);
  for (let i = 0; i < 200; i++) current = advanceTransitionCounts(current, smaller, 16);
  assert.deepEqual(current, smaller);
});
