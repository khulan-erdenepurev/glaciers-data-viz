import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Box3, Matrix4, Scene, Vector3 } from 'three';
import { createStoryContext } from '../src/story-context.js';

test('one context grows into the selected apartment and reverses at the same scroll positions', () => {
  const scene = new Scene();
  const context = createStoryContext(scene);
  const [group] = scene.children;
  function render(progress, residents = 40, visibility = 1) {
    context.render(new Vector3(), 1, progress, residents, visibility);
    return group.children.map(mesh => mesh.count);
  }

  assert.deepEqual(render(0), [1, 1, 1, 0]);
  const midway = render(0.55);
  assert.ok(midway[1] > 1 && midway[1] < 40);
  for (const residents of [40, 50, 60, 70, 80, 40]) {
    assert.deepEqual(render(1, residents), [3 * residents / 10 - 1, residents, residents, 0]);
  }
  const emergingCity = render(1.3);
  assert.ok(emergingCity[0] > 11 && emergingCity[0] < 21);
  assert.deepEqual(render(2), [21, 40, 40, 10]);
  assert.deepEqual(render(1.3), emergingCity);
  assert.deepEqual(render(0.55), midway);
  assert.deepEqual(render(0), [1, 1, 1, 0]);
  render(2, 40, 0);
  assert.equal(group.visible, false);
  context.dispose();
  assert.equal(scene.children.length, 0);
});

test('resident bodies clear the next deck and apartment supports fill only the gaps', () => {
  const scene = new Scene();
  const context = createStoryContext(scene);
  context.render(new Vector3(), 1, 1, 80, 1);
  const [{ children: [decks, bodies, heads, roofs] }] = scene.children;
  assert.equal(roofs.count, 0);
  const bounds = mesh => {
    mesh.geometry.computeBoundingBox();
    return Array.from({ length: mesh.count }, (_, i) => {
      const transform = new Matrix4();
      mesh.getMatrixAt(i, transform);
      return new Box3().copy(mesh.geometry.boundingBox).applyMatrix4(transform);
    });
  };
  const pieces = bounds(decks).slice(1);
  const slabs = pieces.filter(box => box.max.x - box.min.x > 2);
  const supports = pieces.filter(box => box.max.x - box.min.x < 0.2);
  assert.equal(slabs.length, 8);
  assert.equal(supports.length, 14);
  for (const post of supports) {
    assert.ok(slabs.some(slab => Math.abs(slab.max.y - post.min.y) < 1e-6));
    assert.ok(slabs.some(slab => Math.abs(slab.min.y - post.max.y) < 1e-6));
  }
  for (const person of [...bounds(bodies), ...bounds(heads)]) {
    assert.ok(slabs.every(slab => person.max.y <= slab.min.y + 1e-6 || person.min.y >= slab.max.y - 1e-6));
  }
  context.dispose();
});
