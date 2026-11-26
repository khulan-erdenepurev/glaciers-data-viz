import { contours, geoPath } from 'd3';
import { arenaGlaciers, arenaModes, arenaCubeCapacity, arenaHistory, encodeGlacier, hydrologicalYear } from './arena-data.js';
import { createArenaScene } from './arena-scene.js';
import './arena.css';

const number = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 6 });
const signed = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 6, signDisplay: 'exceptZero' });
const millions = new Intl.NumberFormat('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

function drawContours(canvas) {
  const width = 150, height = 92;
  const elevation = Array.from({ length: width * height }, (_, i) => {
    const x = i % width, y = Math.floor(i / width);
    const summit = Math.hypot((x - 92 + 5 * Math.sin(y / 8)) * 0.72, (y - 59) * 1.3);
    return 100 - summit + 4 * Math.sin(x / 12 + y / 5) + 4 * Math.cos(x / 14 - y / 9);
  });
  canvas.width = 900;
  canvas.height = 552;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.scale(6, 6);
  context.strokeStyle = '#253649';
  context.lineWidth = 0.14;
  const path = geoPath(null, context);
  for (const line of contours().size([width, height]).thresholds(32)(elevation)) {
    context.beginPath();
    path(line);
    context.stroke();
  }
}

function wheelStep(control, step, signal) {
  let last = -Infinity;
  control.addEventListener('wheel', event => {
    if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.5) return;
    event.preventDefault();
    const first = event.timeStamp - last > 160;
    last = event.timeStamp;
    if (first) step(Math.sign(event.deltaX));
  }, { passive: false, signal });
}

export function mountGlacierArena(root, records) {
  const controller = new AbortController();
  const { signal } = controller;
  const get = selector => root.querySelector(selector);
  const history = arenaHistory(records);
  const years = [...history.keys()].sort((a, b) => a - b);
  const columns = get('.arena-columns');
  const scroller = get('.arena-scroll');
  const yearControl = get('#arena-year');
  const earlier = get('#arena-earlier');
  const later = get('#arena-later');
  const back = get('#arena-back');
  const title = get('#arena-title');
  const modes = [...root.querySelectorAll('[data-mode]')];
  let year = years.includes(2025) ? 2025 : years.at(-1);
  let mode = 'volume';
  let duel = null;
  let scene;
  let inspected;
  let scrollBeforeDuel = 0;
  yearControl.replaceChildren(...years.toReversed().map(end => new Option(hydrologicalYear(end), end)));
  drawContours(get('.arena-contours'));

  get('#arena-histories').replaceChildren(...arenaGlaciers.map(glacier => {
    const observed = years.filter(end => history.get(end).has(glacier.id));
    const ranges = [];
    for (const end of observed) {
      const last = ranges.at(-1);
      if (last && end === last[1] + 1) last[1] = end;
      else ranges.push([end, end]);
    }
    const caption = ranges.map(([start, end]) => start === end ? start : `${start}–${end}`).join(', ');
    const li = document.createElement('li');
    li.textContent = `${glacier.name} · ${glacier.id} · ${caption || 'No observations'} (${observed.length} observed end years)`;
    return li;
  }));

  function formatValue(value) {
    if (value === null) return 'Unavailable';
    return mode === 'volume' ? `${millions.format(value / 1e6)}M m³` : `${signed.format(value)} mm`;
  }

  function inspect(glacier) {
    scrollBeforeDuel = scroller.scrollLeft;
    inspected = glacier.id;
    duel = [glacier, arenaGlaciers.find(other => other.id === (glacier.id === arenaGlaciers[0].id
      ? arenaGlaciers[1].id : arenaGlaciers[0].id))];
    render();
    scroller.scrollLeft = 0;
    root.scrollIntoView({ block: 'start' });
    title.focus({ preventScroll: true });
  }

  const cards = [];
  function configureCard(card, glacier, index) {
    const id = glacier.id;
    card.heading.textContent = glacier.name;
    card.inspect.dataset.inspect = id;
    card.inspect.setAttribute('aria-label', `Inspect ${glacier.name}`);
    if (!duel) return;
    card.select.setAttribute('aria-label', index ? 'Right glacier' : 'Left glacier');
    card.select.value = id;
    const other = duel[1 - index].id;
    for (const option of card.select.options) option.disabled = option.value === other;
  }

  function mountCards(items) {
    columns.replaceChildren();
    cards.length = 0;
    items.forEach((glacier, index) => {
      const card = document.createElement('article');
      card.className = 'arena-card';
      card.innerHTML = `
        <div class="arena-card-name"><h3></h3><select></select><p class="arena-area"></p></div>
        <div class="arena-winter"><span class="arena-reading-label">Winter balance</span><strong></strong></div>
        <div class="arena-summer"><span class="arena-reading-label">Summer balance</span><strong></strong></div>
        <div class="arena-net"><span class="arena-reading-label">Annual net</span> <strong></strong><p></p></div>
        <button type="button" class="arena-inspect"></button>`;
      const select = card.querySelector('select');
      select.hidden = !duel;
      const inspectButton = card.querySelector('.arena-inspect');
      inspectButton.hidden = Boolean(duel);
      inspectButton.textContent = 'Inspect ↗';
      if (duel) {
        select.replaceChildren(...arenaGlaciers.map(g => new Option(g.name, g.id)));
        function replace(id) {
          duel[index] = arenaGlaciers.find(g => g.id === id);
          render();
        }
        select.addEventListener('change', () => replace(select.value));
        wheelStep(select, direction => {
          const available = arenaGlaciers.filter(g => g.id !== duel[1 - index].id);
          const current = available.findIndex(g => g.id === select.value);
          replace(available[(current + direction + available.length) % available.length].id);
        }, signal);
      } else {
        card.addEventListener('click', () => inspect(glacier));
      }
      columns.append(card);
      cards.push({ card, select, heading: card.querySelector('h3'), inspect: inspectButton });
    });
  }

  function render() {
    const items = duel || arenaGlaciers;
    root.dataset.view = duel ? 'duel' : 'arena';
    title.textContent = duel ? 'Two glaciers. One honest scale.' : '06 · Five iconic Swiss glaciers';
    get('#arena-kicker').textContent = duel ? '06 / Comparative duel' : '06 / 5-glacier arena';
    get('#arena-scroll-note').textContent = duel ? 'Scroll sideways to view both glaciers ↔' : 'Scroll sideways to view all glaciers ↔';
    get('#arena-year-caption').textContent = hydrologicalYear(year);
    yearControl.value = year;
    const index = years.indexOf(year);
    earlier.disabled = index <= 0;
    later.disabled = index >= years.length - 1;
    back.hidden = !duel;
    modes.forEach(button => button.setAttribute('aria-pressed', button.dataset.mode === mode));
    if (cards.length !== items.length) mountCards(items);

    const observations = history.get(year);
    const data = items.map((glacier, i) => {
      const record = observations.get(glacier.id);
      const encoded = encodeGlacier(record, mode);
      const card = cards[i];
      configureCard(card, glacier, i);
      card.card.querySelector('.arena-area').textContent = record?.area != null
        ? `${number.format(record.area)} km²` : 'Area unavailable';
      for (const [className, value] of [['winter', encoded.winter.value], ['summer', encoded.summer.value], ['net', encoded.annual]]) {
        const label = card.card.querySelector(`.arena-${className} strong`);
        label.textContent = formatValue(value);
        label.title = value === null ? 'No measurement available' : `${signed.format(value)} ${arenaModes[mode].label}`;
      }
      const note = card.card.querySelector('.arena-net p');
      const { winter, summer } = encoded;
      note.textContent = record ? `${winter.count} ice / ${summer.count} water` : 'No observation for this year';
      note.title = record ? `Below one cube · ice ${number.format(winter.remainder)} / water ${number.format(summer.remainder)} ${arenaModes[mode].label}` : '';
      return { id: glacier.id, winter, summer };
    });
    const { unit, label } = arenaModes[mode];
    get('#arena-zero-label').textContent = duel ? '0 / equilibrium' : '0';
    get('#arena-unit').textContent = `${duel ? 'Locked orthographic scale' : 'Shared scale'} / 1 cube = ${number.format(unit)} ${label}`;
    const available = items.filter(glacier => observations.has(glacier.id)).length;
    get('#arena-coverage').textContent = `${hydrologicalYear(year)} · Observations for ${available} of ${items.length} glaciers. Sub-cube remainders are included in the readings.`;
    get('#arena-definition').textContent = mode === 'volume'
      ? 'Total volume in m³ = specific balance in mm × area in km² × 1,000.'
      : 'Specific balance measures change per unit area.';
    scene?.show(data);
  }

  function stepYear(step) {
    const next = years[years.indexOf(year) + step];
    if (next === undefined) return;
    year = next;
    render();
  }
  yearControl.addEventListener('change', () => { year = Number(yearControl.value); render(); }, { signal });
  earlier.addEventListener('click', () => stepYear(-1), { signal });
  later.addEventListener('click', () => stepYear(1), { signal });
  wheelStep(get('.arena-year'), stepYear, signal);
  function setMode(next) {
    if (next === mode) return;
    mode = next;
    render();
  }
  modes.forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode), { signal }));
  wheelStep(get('.arena-modes'), step => setMode(step > 0 ? 'specific' : 'volume'), signal);
  back.addEventListener('click', () => {
    duel = null;
    render();
    root.scrollIntoView({ block: 'start' });
    scroller.scrollLeft = scrollBeforeDuel;
    columns.querySelector(`[data-inspect="${inspected}"]`)?.focus({ preventScroll: true });
  }, { signal });

  root.hidden = false;
  render();
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    try {
      scene = createArenaScene(get('.arena-cubes'), arenaCubeCapacity(records), arenaGlaciers.length);
      render();
    } catch (error) {
      console.warn('Glacier arena renderer unavailable', error);
      get('#arena-render-message').hidden = false;
    }
  });
  observer.observe(root);
  if (location.hash === '#arena') root.scrollIntoView();
  if (import.meta.hot) import.meta.hot.dispose(() => {
    observer.disconnect();
    controller.abort();
    scene?.dispose();
  });
}
