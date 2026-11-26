import { waterEquivalentVolume } from './data.js';
import { quantifyVolume } from './cube-layout.js';

export const arenaGlaciers = [
  { id: 'B36-26', name: 'Grosser Aletschgletscher' },
  { id: 'B43-03', name: 'Rhônegletscher' },
  { id: 'B56-03', name: 'Findelengletscher' },
  { id: 'A10g-05', name: 'Silvrettagletscher' },
  { id: 'B45-04', name: 'Griesgletscher' },
];

export const arenaModes = {
  volume: { unit: 1_000_000, label: 'm³ w.e.' },
  specific: { unit: 20, label: 'mm w.e.' },
};

export const hydrologicalYear = year => `${year - 1}/${String(year).slice(-2)}`;

export function arenaHistory(records) {
  const byYear = new Map();
  for (const record of records) {
    if (!byYear.has(record.year)) byYear.set(record.year, new Map());
    byYear.get(record.year).set(record.glacierId, record);
  }
  return byYear;
}

export function encodeGlacier(record, mode) {
  function valueFor(key) {
    const balance = record?.[key] ?? null;
    return mode === 'volume' ? waterEquivalentVolume(balance, record?.area) : balance;
  }
  function encode(key) {
    const value = valueFor(key);
    const magnitude = value === null ? 0 : Math.abs(value);
    return { value, sign: Math.sign(value ?? 0), ...quantifyVolume(magnitude, arenaModes[mode].unit) };
  }
  return { winter: encode('winter'), summer: encode('summer'), annual: valueFor('annual') };
}

export function arenaCubeCapacity(records) {
  let capacity = 1;
  for (const row of records) {
    for (const mode of Object.keys(arenaModes)) {
      const { winter, summer } = encodeGlacier(row, mode);
      capacity = Math.max(capacity, winter.count, summer.count);
    }
  }
  return capacity;
}
