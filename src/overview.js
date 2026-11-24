import { select } from 'd3';
import { renderCharts } from './charts.js';
import { glaciers } from './data.js';
import { loadGlaciers } from './load.js';
import './style.css';

const status = document.querySelector('#status');
const picker = select('#glacier');
const balance = value => value == null ? 'Missing' : `${value > 0 ? '+' : ''}${value}`;

try {
  const records = await loadGlaciers();
  renderCharts(document.querySelector('#charts'), glaciers, records);
  const valueCount = records.reduce((count, row) =>
    count + [row.winter, row.summer, row.annual].filter(value => value != null).length, 0);
  status.textContent = `${records.length} glacier-year observations · ${valueCount} balance values. Accent diamonds indicate positive annual balance.`;

  function updateTable() {
    const glacier = glaciers.find(item => item.id === picker.property('value'));
    const observations = records.filter(row => row.glacierId === glacier.id).toReversed();
    select('#table-caption').text(`${glacier.name} · ${observations.length} observed years`);
    const rows = select('tbody').selectAll('tr').data(observations, row => row.year).join('tr').order();
    rows.selectAll('td').data(row => [
      row.year, balance(row.winter), balance(row.summer), balance(row.annual), row.area ?? 'Missing',
    ]).join('td').text(value => value);
  }

  picker.selectAll('option').data(glaciers).join('option')
    .attr('value', glacier => glacier.id).text(glacier => glacier.name);
  picker.property('disabled', false).on('change', updateTable);
  updateTable();
} catch (error) {
  status.textContent = `Glacier observations could not be displayed. ${error.message}`;
}
