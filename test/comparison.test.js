import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCities, parseGlacierBalances, glaciers, waterUseLitres, litresToCubicMetres } from '../src/data.js';
import { comparisonScale, comparisonVolumePerCube, glacierLoss, lossRatio } from '../src/comparison.js';
import { createPileSlots, quantifyVolume } from '../src/cube-layout.js';
const read = path => readFileSync(new URL('../data/' + path, import.meta.url), 'utf8');
const records = parseGlacierBalances(read('massbalance_2025_r2025/massbalance_fixdate_2025_r2025.csv')).filter(row => row.year === 2025);
const cities = parseCities(read('residents_cities_water_usage.csv'), read('KANTON_ZUERICH_469.csv'));
const volume = (city, days) => litresToCubicMetres(waterUseLitres(city.residents, city.litresPerResidentDay, days));
const scale = comparisonScale(cities.map(city => volume(city, 365)), records);

test('all 50 comparisons use shared bounded units and exact signed-loss ratios', () => {
  assert.equal(records.length, 5);
  assert.equal(scale.volumePerCube, comparisonVolumePerCube);
  let combinations = 0;
  for (const city of cities) {
    for (const days of [30, 365]) for (const glacier of glaciers) {
      const record = records.find(row => row.glacierId === glacier.id);
      const loss = glacierLoss(record);
      assert.ok(loss > 0);
      for (const v of [loss, volume(city, days)]) {
        const cubes = quantifyVolume(v, scale.volumePerCube, scale.limit);
        assert.ok(cubes.count > 0 && cubes.count <= scale.limit);
        assert.ok(Math.abs(cubes.represented + cubes.remainder - v) < 1e-6);
      }
      assert.equal(lossRatio(loss, volume(city, days)), loss / volume(city, days));
      const cityCount = quantifyVolume(volume(city, days), scale.volumePerCube, scale.limit).count;
      const glacierCount = quantifyVolume(loss, scale.volumePerCube, scale.limit).count;
      assert.equal(Math.sign(glacierCount - cityCount), Math.sign(loss - volume(city, days)));
      combinations++;
    }
  }
  assert.equal(combinations, 50);
});
test('Aletsch 2025 is net loss, and gain/missing records are not losses', () => {
  const loss = glacierLoss(records.find(row => row.glacierId === 'B36-26'));
  assert.equal(loss, 122361375);
  const zurich = cities.find(city => city.name === 'Zurich');
  assert.ok(Math.abs(lossRatio(loss, volume(zurich, 30)) - 34.40955432) < 1e-7);
  assert.ok(Math.abs(lossRatio(loss, volume(zurich, 365)) - 2.82818264) < 1e-7);
  assert.equal(glacierLoss({ annual: 100, area: 2 }), 0);
  assert.equal(glacierLoss(null), null);
  assert.equal(lossRatio(0, 100), null);
});


test('extended comparison stacks retain every established city slot and stay supported', () => {
  const citySlots = createPileSlots();
  const slots = createPileSlots(scale.limit);
  assert.equal(slots.length, scale.limit);
  assert.deepEqual(slots.slice(0, citySlots.length), citySlots);
  const heights = new Map();
  for (const { x, y, z } of slots) {
    const key = `${x}:${z}`;
    assert.equal(y, heights.get(key) ?? 0);
    heights.set(key, y + 1);
  }
});
