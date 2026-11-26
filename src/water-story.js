import { mountGlacierExplorer } from './glacier-explorer.js';
import { cityConsumption } from './swiss-water.js';
import { apartmentScale, cityCubeScale, cubeScale, individualUnit } from './scale-transition.js';
import { quantifyVolume } from './cube-layout.js';
import { createCubeScene } from './cube-scene.js';
import { comparisonScale, glacierLoss, lossRatio } from './comparison.js';
import { glaciers, litresToCubicMetres, waterUseLitres } from './data.js';

const titles = ['Individual water consumption', 'Apartment water consumption', 'City water consumption', 'City versus annual glacier net loss', 'Seasonal glacier explorer'];
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
  const zurich = cities.find(city => city.municipalityId === '0261');
  const zurichRate = zurich.observations.find(record => record.period === 'daily' && record.litresPerResidentDay !== null);
  const cityName = city => city.name;
  const cityOptions = ['0261', '2701', '0351', '6621', '5586']
    .map(id => cities.find(city => city.municipalityId === id));
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

  const selectedConsumption = () => cityConsumption(city, sharedDays === 30 ? 'monthly' : 'annual');
  const annualVolumes = cityOptions.map(item => cityConsumption(item, 'annual').volumeM3).filter(Number.isFinite);
  const sharedScale = comparisonScale(annualVolumes, comparisonRecords);

  story.hidden = false;
  try {
    scene = createCubeScene(stage, { frameHalfWidth: 3.15, comparisonLimit: sharedScale.limit });
  } catch {
    stage.hidden = true;
    get('cube-render-status').textContent = 'WebGL is unavailable. The calculated volumes are still shown.';
  }

  const explorer = mountGlacierExplorer({ get, observations, cities: cityOptions, scene, signal,
    onSelection(glacierId, cityId, periodName) {
      glacier = glaciers.find(g => g.id === glacierId);
      glacierSelect.value = glacierId;
      city = cityOptions.find(c => c.municipalityId === cityId);
      sharedDays = periodName === 'annual' ? 365 : 30;
    },
  });
  // Let the last, taller chapter scroll naturally to its timeline and source details.
  const stageHeight = new ResizeObserver(([entry]) => {
    if (chapter === 4) steps[4].style.minHeight = `max(100svh, ${Math.ceil(entry.target.offsetHeight)}px)`;
  });
  stageHeight.observe(story.querySelector('.story-stage'));

  function comparisonState() {
    const record = comparisonRecords.find(row => row.glacierId === glacier.id);
    const loss = glacierLoss(record);
    const cityVolume = selectedConsumption().volumeM3;
    return { loss, cityVolume, scale: sharedScale, volumes: [cityVolume ?? 0, loss ?? 0] };
  }

  function comparisonLayout(progress) {
    story.toggleAttribute('data-comparing', progress > 0);
    story.style.setProperty('--comparison-progress', progress);
  }

  function chapterVolume(index) {
    if (index === 3) {
      const state = comparisonState();
      return { ...state.scale, volume: state.cityVolume, ...quantifyVolume(state.cityVolume ?? 0, state.scale.volumePerCube, state.scale.limit) };
    }
    const scale = index === 2 ? cityCubeScale(cityConsumption(city, 'annual').volumeM3 ?? 0)
      : index === 1 ? apartmentScale : individualScale;
    const volume = index === 2 ? selectedConsumption().volumeM3
      : litresToCubicMetres(waterUseLitres(index === 0 ? 1 : residents,
        zurichRate?.litresPerResidentDay, index === 0 ? personDays : sharedDays));
    return { ...scale, volume, ...quantifyVolume(volume ?? 0, scale.volumePerCube) };
  }

  function drawTransition({ fromIndex, fraction }, animateValues = false) {
    if (fromIndex === 2) {
      const state = comparisonState();
      comparisonLayout(fraction);
      const composition = stage.parentElement;
      const style = getComputedStyle(composition);
      const share = Number(style.getPropertyValue('--city-stage-share'));
      const sourceWidth = (composition.clientWidth - parseFloat(style.columnGap)) * share;
      const source = chapterVolume(2);
      scene?.scrubComparison(fraction, source, state.scale, state.volumes, sourceWidth / stage.clientHeight);
      get('cube-scale-note').textContent = source.volume === null ? 'Municipality water volume unavailable.' : `The city pile regroups from ${format.format(source.volumePerCube)} to ${format.format(state.scale.volumePerCube)} m³ per cube for the comparison.`;
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
    const note = `Scale change · ${format.format(from.volumePerCube)} → ${format.format(to.volumePerCube)} m³ per cube. One larger cube represents the volume of ${equivalence}. ${destination}: ${to.volume === null ? 'municipality volume unavailable' : format.format(to.volume) + ' m³ total'}.`;
    const label = get('cube-scale-note');
    if (label.textContent !== note) label.textContent = note;
  }

  function update() {
    const days = chapter === 0 ? personDays : sharedDays;
    const municipality = chapter >= 2;
    const water = municipality ? selectedConsumption() : null;
    period.options[1].textContent = municipality ? 'Monthly' : '30-day month';
    period.options[2].textContent = municipality ? 'Yearly' : '365-day year';
    period.value = String(days);
    if (chapter === 1) {
      const floors = residents / 10;
      makeFigures(get('resident-icons'), residents, 'person-glyph');
      makeFigures(get('building-floors'), floors, 'building-floor');
      get('building-caption').textContent = `${residents} residents · ${floors} illustrative floors`;
    }
    if (chapter >= 2) {
      get('city-map').textContent = `${cityName(city)} · Map placeholder`;
      get('city-population').textContent = `${format.format(city.population)} municipality residents (${city.populationYear})`;
    }

    const state = chapter === 3 ? comparisonState() : null;
    get('comparison-labels').hidden = false;
    get('individual-consumption-label').hidden = chapter !== 0;
    const subjectHeading = get('comparison-city-heading');
    subjectHeading.hidden = chapter === 0;
    subjectHeading.title = chapter === 1
      ? 'Scroll sideways or click to change residents'
      : 'Scroll sideways or click to change city';
    get('comparison-city-label').textContent = chapter === 1
      ? `${residents} residents · apartment consumption`
      : `${cityName(city)} · consumption`;
    get('comparison-period-label').textContent = period.selectedOptions[0].textContent;
    get('comparison-glacier-heading').hidden = chapter !== 3;
    get('comparison-values').hidden = chapter !== 3;
    glacierControls.hidden = chapter !== 3;
    if (state) {
      get('comparison-glacier-label').textContent = `${glacier.name} · net loss`;
      const ratio = lossRatio(state.loss, state.cityVolume);
      const glacierCubes = quantifyVolume(state.loss ?? 0, state.scale.volumePerCube, state.scale.limit);
      get('comparison-values').textContent = `${glacier.name}: ${state.loss === null ? 'missing observation' : format.format(state.loss) + ' m³ annual net water-equivalent loss'} · hydrological year 2024/25 (ending 2025). ${ratio === null ? 'No loss ratio available.' : 'Glacier loss / city consumption = ' + ratio.toFixed(6) + '×.'} Glacier: ${glacierCubes.count} cubes, ${format.format(glacierCubes.remainder)} m³ remainder. Net loss is neither remaining ice nor measured meltwater runoff.`;
    }
    const scale = chapterVolume(chapter);
    const { volume, volumePerCube, count: cubes, represented, remainder } = scale;
    const periodName = period.selectedOptions[0].textContent.toLowerCase();
    const basis = !water ? `per ${periodName}`
      : water.period === 'annual' ? `in ${water.year} (${water.kind})`
      : water.kind === 'reported' ? `in ${water.end ?? water.start} (observed month)`
      : `per month (${water.year} annual total ÷ 12, estimated average)`;
    get('cube-values').textContent = volume === null
      ? 'Municipality water volume unavailable'
      : `${format.format(volume)} m³ ${basis}`;
    get('cube-unit').textContent = volume === null && !state ? ''
      : `1 cube = ${format.format(volumePerCube)} m³` + (volume === null ? '' :
        ` · ${cubes} ${cubes === 1 ? 'cube' : 'cubes'} (${format.format(represented)} m³ shown) · ${format.format(remainder)} m³ remainder`);
    get('water-definition').hidden = !water;
    if (water) {
      const qualifier = volume === null ? 'Available source covers' : 'Water coverage';
      get('water-provenance').textContent = `${qualifier}: ${water.scope} · ${water.year} · ${water.measurementType}. ${water.warning}`;
      const source = get('water-source');
      source.href = water.source.url;
      source.textContent = `Water source · ${water.source.file}`;
    }
    if (transition) {
      drawTransition(transition, true);
    } else {
      comparisonLayout(chapter === 3 ? 1 : 0);
      get('cube-scale-note').textContent = chapter === 3
        ? 'Both piles use this fixed cube unit for every comparison. Remainders below one cube are listed separately.'
        : chapter === 2 ? cityScaleNote : '';
      scene?.show(state ? state.volumes : [volume ?? 0], scale);
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
    const exploring = index === 4;
    get('explorer-heading').hidden = !exploring;
    get('explorer-readings').hidden = !exploring;
    get('season-axis').hidden = !exploring || stage.hidden;
    get('story-controls').hidden = exploring;
    story.querySelector('.story-values').hidden = exploring;
    if (exploring) {
      comparisonLayout(0);
      get('comparison-labels').hidden = true;
      get('comparison-values').hidden = true;
      explorer.enter(glacier.id, city.municipalityId, sharedDays === 30 ? 'monthly' : 'annual');
      return;
    }
    subjectControls.hidden = index === 0;
    period.options[0].hidden = index !== 0;
    period.options[0].disabled = index !== 0;
    if (index !== 0) {
      const label = index === 1 ? 'Residents' : 'City';
      const options = index === 1
        ? residentCounts.map(count => new Option(count, count))
        : cityOptions.map(item => new Option(cityName(item), item.municipalityId));
      get('subject-label').textContent = label;
      subject.replaceChildren(...options);
      subject.value = index === 1 ? String(residents) : city.municipalityId;
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
    transition = index < 3 && fraction > 0 && fraction < 1 ? { fromIndex: index, fraction } : undefined;

    if (previous && previous.fromIndex !== transition?.fromIndex) {
      drawTransition({ ...previous, fraction: index > previous.fromIndex ? 1 : 0 });
    } else if (!previous && !transition && chapter >= 0 && chapter !== index && Math.max(chapter, index) < 4) {
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
    if (chapter >= 2) city = cityOptions.find(item => item.municipalityId === subject.value);
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

  const headings = [
    [get('comparison-city-heading'), subject],
    [get('comparison-period-heading'), period],
    [get('comparison-glacier-heading'), glacierSelect],
  ];
  for (const [heading, select] of headings) {
    heading.addEventListener('click', () => stepOption(select, 1), { signal });
  }

  const apartmentPanel = get('chapter-context');
  let lastWheel = -Infinity;
  let horizontalDistance = 0;
  let wheelConsumed = false;
  let wheelSelection;
  const wheelZones = [
    ...headings,
    [get('explorer-glacier'), get('explorer-glacier')], [get('explorer-year'), get('explorer-year')],
    [glacierControls, glacierSelect], [subjectControls, subject], [get('city-map'), subject],
    [apartmentPanel, subject], [periodControls, period], [stage, period],
    [get('cube-values'), period], [get('city-population'), period],
  ];
  for (const [target, select] of wheelZones) {
    target.addEventListener('wheel', event => {
      if ((chapter === 4 && target === stage) || (target === apartmentPanel && chapter !== 1) || event.ctrlKey || !event.cancelable ||
          Math.abs(event.deltaX) <= 1.5 * Math.abs(event.deltaY) || !event.deltaX) return;
      event.preventDefault();
      const selection = chapter === 3 && target === stage
        ? (event.clientX < stage.getBoundingClientRect().left + stage.clientWidth / 2 ? subject : glacierSelect) : select;
      if (event.timeStamp - lastWheel > 180) {
        horizontalDistance = 0;
        wheelConsumed = false;
        wheelSelection = selection;
      }
      lastWheel = event.timeStamp;
      if (wheelConsumed || selection !== wheelSelection) return;
      const deltaMode = event.deltaMode;
      horizontalDistance += event.deltaX * (deltaMode === 1 ? 16 : deltaMode === 2 ? window.innerWidth : 1);
      if (Math.abs(horizontalDistance) >= 12) {
        stepOption(selection, Math.sign(horizontalDistance));
        wheelConsumed = true;
      }
    }, { passive: false, signal });
  }

  window.addEventListener('scroll', scheduleScroll, { passive: true, signal });
  window.addEventListener('resize', scheduleScroll, { signal });
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      controller.abort();
      cancelAnimationFrame(scrollFrame);
      stageHeight.disconnect();
      scene?.dispose();
    });
  }
  steps.find(step => '#' + step.id === location.hash)?.scrollIntoView();
  syncScroll();
}
