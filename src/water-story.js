import { apartmentScale, cityCubeScale, cubeScale, individualUnit } from './scale-transition.js';
import { quantifyVolume } from './cube-layout.js';
import { createCubeScene } from './cube-scene.js';
import { comparisonScale, glacierLoss, lossRatio } from './comparison.js';
import { glaciers, litresToCubicMetres, waterUseLitres } from './data.js';

const titles = ['Individual water consumption', 'Apartment water consumption', 'City water consumption', 'City versus annual glacier net loss'];
const individualScale = cubeScale(individualUnit);
const cityScaleNote = 'City cube units stay fixed across periods for the same city. Changing cities can change the unit.';
const residentCounts = [40, 50, 60, 70, 80];
const format = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 3 });

function makeFigures(container, count, className) {
  while (container.childElementCount > count) container.lastElementChild.remove();
  while (container.childElementCount < count) {
    const figure = document.createElement('span');
    figure.className = className;
    container.append(figure);
  }
}

export function mountWaterStory(cities, observations) {
  const story = document.querySelector('#story');
  const get = id => story.querySelector(`#${id}`);
  const steps = Array.from(story.querySelectorAll('.story-step'));
  const links = Array.from(story.querySelectorAll('.chapter-nav a'));
  const contexts = ['individual-context', 'apartment-context', 'city-context'].map(get);
  const subjectControls = get('subject-controls');
  const periodControls = get('period-controls');
  const subject = get('story-subject');
  const period = get('story-period');
  const glacierSelect = get('story-glacier');
  const glacierControls = get('glacier-controls');
  glacierSelect.replaceChildren(...glaciers.map(item => new Option(item.name, item.id)));
  const comparisonRecords = observations.filter(row => row.year === 2025);
  let glacier = glaciers[0];
  const stage = get('cube-stage');
  const zurich = cities.find(city => city.name === 'Zurich');
  const cityName = city => city === zurich ? 'Zürich' : city.name;
  const cityOptions = ['Zurich', 'London', 'New York', 'Paris', 'Tokyo']
    .map(name => cities.find(city => city.name === name));
  const controller = new AbortController();
  const { signal } = controller;

  let chapter = -1;
  let personDays = 30;
  let sharedDays = 30;
  let residents = 40;
  let city = zurich;
  let scene;
  let scrollFrame;
  let transition;

  const usage = (area, count, days) =>
    litresToCubicMetres(waterUseLitres(count, area.litresPerResidentDay, days));
  const comparisonScales = new Map(cityOptions.map(item =>
    [item, comparisonScale(usage(item, item.residents, 365), comparisonRecords)]));
  const comparisonLimit = Math.max(...Array.from(comparisonScales.values(), scale => scale.limit));

  story.hidden = false;
  try {
    scene = createCubeScene(stage, { frameHalfWidth: 3.15, comparisonLimit });
  } catch {
    stage.hidden = true;
    get('cube-render-status').textContent = 'WebGL is unavailable. The calculated volumes are still shown.';
  }

  function comparisonState() {
    const record = comparisonRecords.find(row => row.glacierId === glacier.id);
    const loss = glacierLoss(record);
    const cityVolume = usage(city, city.residents, sharedDays);
    const scale = comparisonScales.get(city);
    return { loss, cityVolume, scale, volumes: [cityVolume, loss ?? 0] };
  }

  function comparisonLayout(progress) {
    story.toggleAttribute('data-comparing', progress > 0);
    story.style.setProperty('--comparison-progress', progress);
  }

  function chapterVolume(index) {
    if (index === 3) {
      const state = comparisonState();
      return { ...state.scale, volume: state.cityVolume, ...quantifyVolume(state.cityVolume, state.scale.volumePerCube) };
    }
    const area = index === 2 ? city : zurich;
    const residentsInView = [1, residents, city.residents][index];
    const days = index === 0 ? personDays : sharedDays;
    const scale = index === 2 ? cityCubeScale(usage(city, city.residents, 365))
      : index === 1 ? apartmentScale : individualScale;
    const volume = usage(area, residentsInView, days);
    return { ...scale, volume, ...quantifyVolume(volume, scale.volumePerCube) };
  }

  function drawTransition({ fromIndex, fraction }, animateValues = false) {
    if (fromIndex === 2) {
      const state = comparisonState();
      comparisonLayout(fraction);
      const composition = stage.parentElement;
      const style = getComputedStyle(composition);
      const share = Number(style.getPropertyValue('--city-stage-share'));
      const sourceWidth = (composition.clientWidth - parseFloat(style.columnGap)) * share;
      scene?.scrubComparison(fraction, chapterVolume(2), state.scale, state.volumes, sourceWidth / stage.clientHeight);
      get('cube-scale-note').textContent = `Shared comparison unit: ${format.format(state.scale.volumePerCube)} m³ per cube. City moves left; annual glacier net loss enters right.`;
      return;
    }
    comparisonLayout(0);
    const from = chapterVolume(fromIndex);
    const to = chapterVolume(fromIndex + 1);
    scene?.scrubScale(fraction, from, to, { animateValues });
    if (fraction <= 0 || fraction >= 1) return;
    const destination = fromIndex === 0 ? `${residents} residents` : cityName(city);
    const ratio = to.volumePerCube / from.volumePerCube;
    const wholeRatio = Math.abs(ratio - Math.round(ratio)) < 1e-8;
    const equivalence = `${wholeRatio ? '' : 'about '}${format.format(ratio)} source cubes`;
    const note = `Scale change · ${format.format(from.volumePerCube)} → ${format.format(to.volumePerCube)} m³ per cube. One larger cube represents the volume of ${equivalence}. ${destination}: ${format.format(to.volume)} m³ total.`;
    const label = get('cube-scale-note');
    if (label.textContent !== note) label.textContent = note;
  }

  function update() {
    const days = chapter === 0 ? personDays : sharedDays;
    period.value = String(days);
    if (chapter === 1) {
      const floors = residents / 10;
      makeFigures(get('resident-icons'), residents, 'person-glyph');
      makeFigures(get('building-floors'), floors, 'building-floor');
      get('building-caption').textContent = `${residents} residents · ${floors} illustrative floors`;
    }
    if (chapter >= 2) {
      get('city-map').textContent = `${cityName(city)} · Map placeholder`;
      get('city-population').textContent = `${format.format(city.residents)} residents`;
    }

    const state = chapter === 3 ? comparisonState() : null;
    get('comparison-labels').hidden = chapter !== 3;
    get('comparison-values').hidden = chapter !== 3;
    glacierControls.hidden = chapter !== 3;
    if (state) {
      get('comparison-city-label').textContent = `${cityName(city)} · consumption`;
      get('comparison-glacier-label').textContent = `${glacier.name} · net loss`;
      const ratio = lossRatio(state.loss, state.cityVolume);
      const glacierCubes = quantifyVolume(state.loss ?? 0, state.scale.volumePerCube, state.scale.limit);
      get('comparison-values').textContent = `${glacier.name}: ${state.loss === null ? 'missing observation' : format.format(state.loss) + ' m³ annual net water-equivalent loss'} · hydrological year 2024/25 (ending 2025). ${ratio === null ? 'No loss ratio available.' : 'Glacier loss / city consumption = ' + ratio.toFixed(6) + '×.'} Glacier: ${glacierCubes.count} cubes, ${format.format(glacierCubes.remainder)} m³ remainder. Net loss is neither remaining ice nor measured meltwater runoff.`;
    }
    const scale = chapterVolume(chapter);
    const { volume, volumePerCube, count: cubes, represented, remainder } = scale;
    const periodName = period.selectedOptions[0].textContent.toLowerCase();
    get('cube-values').textContent = `${format.format(volume)} m³ per ${periodName}${chapter >= 2 ? ' (estimate)' : ''}`;
    get('cube-unit').textContent =
      `1 cube = ${format.format(volumePerCube)} m³ · ${cubes} ${cubes === 1 ? 'cube' : 'cubes'} (${format.format(represented)} m³ shown) · ${format.format(remainder)} m³ remainder`;
    if (transition) {
      drawTransition(transition, true);
    } else {
      comparisonLayout(chapter === 3 ? 1 : 0);
      get('cube-scale-note').textContent = chapter >= 2 ? cityScaleNote + (chapter === 3 ? ' Both mountains use this same unit and camera.' : '') : '';
      scene?.show(state ? state.volumes : [volume], scale);
    }
  }

  function activate(index) {
    if (chapter === index) return;
    chapter = index;
    story.dataset.chapter = steps[index].id;
    get('chapter-title').textContent = `0${index + 1} · ${titles[index]}`;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    contexts.forEach((context, i) => { context.hidden = i !== index; });
    subjectControls.hidden = index === 0;
    period.options[0].hidden = index !== 0;
    period.options[0].disabled = index !== 0;
    if (index !== 0) {
      const label = index === 1 ? 'Residents' : 'City';
      const options = index === 1
        ? residentCounts.map(count => new Option(count, count))
        : cityOptions.map(item => new Option(cityName(item), item.name));
      get('subject-label').textContent = label;
      subject.replaceChildren(...options);
      subject.value = index === 1 ? String(residents) : city.name;
      subjectControls.querySelector('[data-step="-1"]').setAttribute('aria-label', `Previous ${label.toLowerCase()} option`);
      subjectControls.querySelector('[data-step="1"]').setAttribute('aria-label', `Next ${label.toLowerCase()} option`);
    }
    update();
  }

  function syncScroll() {
    let index = 0;
    const threshold = window.innerHeight * 0.4;
    steps.forEach((step, i) => { if (step.getBoundingClientRect().top <= threshold) index = i; });
    const travel = window.innerHeight * 0.6;
    const nextTop = steps[index + 1]?.getBoundingClientRect().top ?? Infinity;
    const fraction = 1 - (nextTop - threshold) / travel;
    const previous = transition;
    transition = fraction > 0 && fraction < 1 ? { fromIndex: index, fraction } : undefined;

    if (previous && previous.fromIndex !== transition?.fromIndex) {
      drawTransition({ ...previous, fraction: index > previous.fromIndex ? 1 : 0 });
    } else if (!previous && !transition && chapter >= 0 && chapter !== index) {
      drawTransition(index > chapter ? { fromIndex: index - 1, fraction: 1 } : { fromIndex: index, fraction: 0 });
    }

    if (chapter !== index) activate(index);
    else if (transition) drawTransition(transition);
    else if (previous?.fromIndex === 2) update();
    else if (previous) get('cube-scale-note').textContent = index === 2 ? cityScaleNote : '';
  }

  function scheduleScroll() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(syncScroll);
  }

  subject.addEventListener('change', () => {
    if (chapter === 1) residents = Number(subject.value);
    if (chapter >= 2) city = cityOptions.find(item => item.name === subject.value);
    update();
  }, { signal });
  glacierSelect.addEventListener('change', () => {
    glacier = glaciers.find(item => item.id === glacierSelect.value);
    update();
  }, { signal });
  period.addEventListener('change', () => {
    const days = Number(period.value);
    if (chapter === 0 || personDays !== 1) personDays = days;
    sharedDays = days === 1 ? 30 : days;
    update();
  }, { signal });

  function stepOption(select, direction) {
    const choices = Array.from(select.options).filter(option => !option.disabled);
    const index = choices.indexOf(select.selectedOptions[0]);
    select.value = choices[(index + direction + choices.length) % choices.length].value;
    select.dispatchEvent(new Event('change'));
  }

  for (const [controls, select] of [[subjectControls, subject], [periodControls, period], [glacierControls, glacierSelect]]) {
    controls.addEventListener('click', event => {
      const button = event.target.closest('[data-step]');
      if (button) stepOption(select, Number(button.dataset.step));
    }, { signal });
  }

  let lastWheel = -Infinity;
  for (const [target, select] of [[glacierControls, glacierSelect], [get('comparison-glacier-label'), glacierSelect], [get('comparison-city-label'), subject], [subjectControls, subject], [get('city-map'), subject],
    [get('resident-icons'), subject], [get('building-floors'), subject],
    [periodControls, period], [stage, period], [get('cube-values'), period], [get('city-population'), period]]) {
    target.addEventListener('wheel', event => {
      if (event.ctrlKey || !event.cancelable || Math.abs(event.deltaX) <= 1.5 * Math.abs(event.deltaY) ||
          Math.abs(event.deltaX) < 1) return;
      event.preventDefault();
      const selection = chapter === 3 && target === stage
        ? (event.clientX < stage.getBoundingClientRect().left + stage.clientWidth / 2 ? subject : glacierSelect) : select;
      if (event.timeStamp - lastWheel > 180) stepOption(selection, Math.sign(event.deltaX));
      lastWheel = event.timeStamp;
    }, { passive: false, signal });
  }

  window.addEventListener('scroll', scheduleScroll, { passive: true, signal });
  window.addEventListener('resize', scheduleScroll, { signal });
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      controller.abort();
      cancelAnimationFrame(scrollFrame);
      scene?.dispose();
    });
  }
  if (location.hash === '#comparison') steps[3].scrollIntoView();
  syncScroll();
}
