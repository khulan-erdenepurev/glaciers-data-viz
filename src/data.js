import { csvParseRows } from 'd3';

export const glaciers = [
  { id: 'B36-26', name: 'Grosser Aletschgletscher' },
  { id: 'B83-03', name: 'Glacier de Corbassière' },
  { id: 'B43-03', name: 'Rhonegletscher' },
  { id: 'B56-03', name: 'Findelgletscher' },
  { id: 'B82-27', name: "Glacier d’Otemma" },
];

function number(value, label) {
  const raw = value?.trim();
  if (!raw || raw === 'None') return null;
  const result = Number(raw);
  if (!Number.isFinite(result)) throw new Error(`Invalid ${label}: ${raw}`);
  return result;
}

function readTable(source, anchor, fields, metadataRows = 0) {
  const rows = csvParseRows(source.replace(/^\uFEFF/, ''));
  const header = rows.findIndex(row => row[0] === anchor);
  if (header === -1) throw new Error(`Missing CSV header: ${anchor}`);
  const columns = Object.entries(fields).map(([key, name]) => {
    const index = rows[header].indexOf(name);
    if (index === -1) throw new Error(`Missing CSV column: ${name}`);
    return [key, index];
  });
  return rows.slice(header + 1 + metadataRows)
    .filter(row => row.some(cell => cell.trim()))
    .map(row => Object.fromEntries(columns.map(([key, index]) => [key, row[index]])));
}

export function parseGlacierBalances(source) {
  // The observer attribution at the end can contain unquoted commas.
  const rows = readTable(source, 'glacier name', {
    glacierId: 'glacier id',
    endDate: 'end date of observation',
    winter: 'winter mass balance',
    summer: 'summer mass balance',
    annual: 'annual mass balance',
    area: 'glacier area',
  }, 2);
  const selected = new Set(glaciers.map(glacier => glacier.id));
  const seen = new Set();
  return rows.filter(row => selected.has(row.glacierId)).map(row => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.endDate ?? '')) {
      throw new Error(`Invalid observation date for ${row.glacierId}`);
    }
    const year = Number(row.endDate.slice(0, 4));
    const key = `${row.glacierId}/${year}`;
    if (seen.has(key)) throw new Error(`Duplicate glacier observation: ${key}`);
    seen.add(key);
    return {
      glacierId: row.glacierId,
      year,
      winter: number(row.winter, 'winter balance'),
      summer: number(row.summer, 'summer balance'),
      annual: number(row.annual, 'annual balance'),
      area: number(row.area, 'glacier area'),
    };
  }).sort((a, b) => a.year - b.year);
}

export function observationTimeline(records) {
  const first = records[0]?.year;
  if (first === undefined) return [];
  const last = records.at(-1).year;
  const byYear = new Map(records.map(record => [record.year, record]));
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const year = first + index;
    return byYear.get(year) ?? { year };
  });
}

export function parseCities(source, municipalitySource) {
  const municipality = readTable(municipalitySource, 'BFS_NR', {
    id: 'BFS_NR', year: 'INDIKATOR_JAHR', daily: 'INDIKATOR_VALUE',
  }).filter(row => row.id === '261' && row.year === '2023');
  if (municipality.length !== 1) throw new Error('Expected one Zürich 2023 indicator row');
  return readTable(source, 'city', {
    name: 'city', residents: 'residents', daily: 'water_usage_per_day',
  }).map(row => ({
    name: row.name,
    residents: number(row.residents, 'residents'),
    litresPerResidentDay: number(row.daily, 'daily use') ??
      (row.name === 'Zurich' ? number(municipality[0].daily, 'Zürich daily use') : null),
  }));
}

export function waterUseLitres(residents, litresPerResidentDay, days) {
  if (residents == null || litresPerResidentDay == null || days == null) return null;
  return residents * litresPerResidentDay * days;
}

export function litresToCubicMetres(litres) {
  return litres == null ? null : litres / 1000;
}

export function waterEquivalentVolume(balance, area) {
  return balance == null || area == null ? null : balance * area * 1000;
}
