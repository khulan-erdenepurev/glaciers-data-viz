import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  glaciers, litresToCubicMetres, observationTimeline, parseCities, parseGlacierBalances,
  waterEquivalentVolume, waterUseLitres,
} from '../src/data.js';

const read = path => readFileSync(new URL(`../data/${path}`, import.meta.url), 'utf8');
const source = read('massbalance_2025_r2025/massbalance_fixdate_2025_r2025.csv');
const records = parseGlacierBalances(source);

test('loads all selected observations and reconciles their seasonal balances', () => {
  assert.equal(records.length, 211);
  assert.deepEqual(glaciers.map(({ id }) => records.filter(row => row.glacierId === id).length),
    [111, 29, 44, 21, 6]);
  for (const row of records) {
    assert.ok([row.winter, row.summer, row.annual, row.area].every(Number.isFinite));
    assert.equal(row.winter + row.summer, row.annual);
  }
});

test('preserves Aletsch losses and gains with their exact magnitudes', () => {
  const { winter, summer, annual, area } = records.find(row => row.glacierId === 'B36-26' && row.year === 2025);
  assert.deepEqual([winter, summer, annual, area], [1083, -2697, -1614, 75.8125]);
  assert.deepEqual([winter, summer, annual].map(value => waterEquivalentVolume(value, area)),
    [82104937.5, -204466312.5, -122361375]);
  assert.equal(records.find(row => row.glacierId === 'B36-26' && row.year === 1916).annual, 771);
});

test('marks the Rhône gap without filling balances or adding observations', () => {
  const timeline = observationTimeline(records.filter(row => row.glacierId === 'B43-03'));
  assert.equal(timeline.filter(row => row.annual === undefined).length, 97);
  assert.deepEqual(timeline.find(row => row.year === 1910), { year: 1910 });
  assert.deepEqual(timeline.find(row => row.year === 2006), { year: 2006 });
  assert.equal(timeline.find(row => row.year === 2007).annual, 56);
});

test('preserves a blank balance in a row with an explicit zero and a comma in the attribution', () => {
  const modified = source.replace(',1083,-2697,-1614,', ',,0,-1614,');
  const row = parseGlacierBalances(modified).find(row => row.glacierId === 'B36-26' && row.year === 2025);
  assert.equal(row.winter, null);
  assert.equal(row.summer, 0);
  assert.equal(waterEquivalentVolume(row.winter, row.area), null);
  assert.throws(() => parseGlacierBalances(source.replace('winter mass balance', 'winter')), /Missing CSV column/);
});

test('loads five cities and uses Zürich municipality 261 as the explicit fallback', () => {
  const cities = parseCities(read('residents_cities_water_usage.csv'), read('KANTON_ZUERICH_469.csv'));
  assert.equal(cities.length, 5);
  const { residents, litresPerResidentDay } = cities.find(city => city.name === 'Zurich');
  assert.equal(litresPerResidentDay, 262);
  assert.equal(litresToCubicMetres(waterUseLitres(residents, litresPerResidentDay, 30)), 3556029.06);
  assert.equal(litresToCubicMetres(waterUseLitres(residents, litresPerResidentDay, 365)), 43265020.23);
  assert.equal(litresToCubicMetres(waterUseLitres(40, litresPerResidentDay, 30)), 314.4);
});
