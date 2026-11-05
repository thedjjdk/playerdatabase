import { editorApi } from './config.js';

const $ = id => document.getElementById(id);
const allowed = { blathers: ['geometry-dash'], disastrum: ['geometry-dash', 'fnaf-challenges'], kayceenoelle: ['celeste', 'beat-saber', 'geometry-dash'] };
const query = new URLSearchParams(location.search);
const player = query.get('player');
const list = query.get('list');
let rows = [], revision = '', dirty = false, drag, dragFrame;
const fields = [
  ['name', 'Level name', 'text'], ['videoUrl', 'Video link', 'url'],
  ['difficulty', 'Difficulty', 'select'], ['completionDate', 'Completion date', 'date'],
  ['attempts', 'Attempts', 'text'], ['enjoyment', 'Enjoyment / 10', 'number', 10],
  ['worstFail', 'Worst fail %', 'number', 100], ['timeTaken', 'Time taken', 'text']
];

function text(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}

async function api(path, options) {
  const response = await fetch(editorApi + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

const listPath = '/list?' + new URLSearchParams({ player, list });

function applyList(data) {
  rows = data.document.levels.map(entry => ({ ...entry, originalRank: entry.rank }));
  revision = data.revision;
  dirty = false;
  render();
}

function changed() {
  dirty = true;
  $('save').disabled = false;
}

function fieldControl(row, key, label, kind, max, title) {
  const wrap = text('label', label);
  const input = document.createElement(kind === 'select' ? 'select' : 'input');
  if (kind === 'select') {
    for (const [value, name] of [['', 'Unspecified'], ['extreme-demon', 'Extreme Demon'], ['insane-demon', 'Insane Demon']]) input.add(new Option(name, value));
  } else input.type = kind;
  if (max) { input.min = '0'; input.max = String(max); input.step = 'any'; }
  input.value = row[key] ?? '';
  input.addEventListener('input', () => {
    row[key] = kind === 'number' && input.value !== '' ? input.valueAsNumber : input.value;
    if (key === 'name') title.textContent = '#' + (rows.indexOf(row) + 1) + ' ' + (row.name || 'New level');
    changed();
  });
  wrap.append(input);
  return wrap;
}

function move(from, to) {
  if (from === to || to < 0 || to >= rows.length) return;
  rows.splice(to, 0, rows.splice(from, 1)[0]);
  changed();
  render();
}

function render() {
  const listEl = $('levels');
  listEl.replaceChildren();
  rows.forEach((row, i) => {
    const li = text('li', '', 'editor-row');
    li.dataset.position = i;
    const head = text('div', '', 'editor-row-head');
    const handle = text('button', '⠿', 'editor-handle');
    handle.type = 'button';
    handle.setAttribute('aria-label', 'Drag to reorder ' + (row.name || 'new level'));
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      drag = { from: i, to: i, id: event.pointerId, x: event.clientX, y: event.clientY };
      dragFrame = requestAnimationFrame(scrollDrag);
      listEl.setPointerCapture(event.pointerId);
    });
    const title = text('strong', '#' + (i + 1) + ' ' + (row.name || 'New level'));
    head.append(handle, title);
    for (const [direction, offset, icon] of [['up', -1, '↑'], ['down', 1, '↓']]) {
      const button = text('button', icon);
      button.type = 'button';
      button.setAttribute('aria-label', 'Move ' + (row.name || 'new level') + ' ' + direction);
      button.disabled = i + offset < 0 || i + offset >= rows.length;
      button.addEventListener('click', () => move(i, i + offset));
      head.append(button);
    }
    const details = document.createElement('details');
    details.open = row.originalRank == null;
    details.append(text('summary', 'Level details'));
    const controls = text('div', '', 'editor-fields');
    for (const [key, label, kind, max] of fields) controls.append(fieldControl(row, key, label, kind, max, title));
    details.append(controls);
    if (row.videoPublishedDate) details.append(text('p', 'Video posted ' + row.videoPublishedDate));
    li.append(head, details);
    listEl.append(li);
  });
  $('save').disabled = !dirty;
}

function updateDragTarget() {
  const row = document.elementFromPoint(drag.x, drag.y)?.closest('.editor-row');
  if (!row) return;
  $('levels').querySelector('.drag-target')?.classList.remove('drag-target');
  row.classList.add('drag-target');
  drag.to = +row.dataset.position;
}
function scrollDrag() {
  if (!drag) return;
  const edge = 55;
  const delta = drag.y < edge ? -12 : drag.y > window.innerHeight - edge ? 12 : 0;
  if (delta) {
    window.scrollBy(0, delta);
    updateDragTarget();
  }
  dragFrame = requestAnimationFrame(scrollDrag);
}
$('levels').addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  drag.x = event.clientX;
  drag.y = event.clientY;
  updateDragTarget();
});
function endDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  const { from, to } = drag;
  drag = null;
  cancelAnimationFrame(dragFrame);
  $('levels').querySelector('.drag-target')?.classList.remove('drag-target');
  if (event.type === 'pointerup') move(from, to);
}
$('levels').addEventListener('pointerup', endDrag);
$('levels').addEventListener('pointercancel', endDrag);
$('levels').addEventListener('lostpointercapture', endDrag);

function parseVideo(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    let id = '';
    if (url.hostname === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|live|embed)\//.test(url.pathname) && url.pathname.split('/')[2];
    }
    return /^[\w-]{11}$/.test(id || '') ? id : '';
  } catch { return ''; }
}

function add(row) {
  rows.push(row);
  changed();
  render();
  $('levels').lastElementChild.scrollIntoView({ block: 'nearest' });
}

$('manual').addEventListener('click', () => add({ name: '' }));
$('import').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('video-url');
  const id = parseVideo(input.value.trim());
  if (!id) { $('status').textContent = 'Enter a valid YouTube video link.'; return; }
  $('lookup').disabled = true;
  const videoUrl = 'https://youtu.be/' + id;
  try {
    const metadata = editorApi ? await api('/metadata?' + new URLSearchParams({ id })) : { videoUrl };
    add(metadata);
    $('status').textContent = editorApi ? 'Video added to your draft. Review the imported details.' : 'Video added to your draft. Enter its details manually while the save service is offline.';
  } catch (error) {
    add({ name: '', videoUrl });
    $('status').textContent = error.message;
  } finally {
    input.value = '';
    $('lookup').disabled = false;
  }
});

$('save').addEventListener('click', () => {
  if (rows.some(row => !row.name?.trim())) {
    $('status').textContent = 'Enter a name for every level before saving.';
    return;
  }
  $('save-credentials').hidden = !editorApi;
  $('save-credentials').disabled = !editorApi;
  $('save-status').textContent = editorApi ? '' : 'Saving is unavailable until a save service is connected. Your draft is still open.';
  $('confirm').showModal();
});
$('cancel').addEventListener('click', () => $('confirm').close());
$('confirm').addEventListener('cancel', event => {
  if ($('confirm-form').querySelector('[type="submit"]').disabled) event.preventDefault();
});
$('confirm').addEventListener('close', () => { $('player-code').value = ''; });
$('confirm-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!editorApi || !dirty) return;
  const code = $('player-code').value.trim();
  const submit = event.submitter;
  submit.disabled = $('cancel').disabled = true;
  $('save-status').textContent = 'Submitting for review…';
  try {
    const result = await api(listPath, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, revision, levels: rows })
    });
    if (result.unchanged) {
      applyList(result);
      $('status').textContent = 'No changes to save.';
    } else {
      if (!result.review) throw new Error('The service did not return a review link. Your draft is still open.');
      if (result.reviewState === 'open') {
        dirty = false;
        $('save').disabled = true;
      }
      $('status').textContent = result.reviewState === 'open'
        ? 'Submitted for review. The public list updates after approval.'
        : 'This submission has already been closed. Your draft is still open.';
      const link = text('a', 'View pull request');
      link.href = result.review;
      $('status').append(' ', link);
    }
    $('confirm').close();
  } catch (error) {
    $('save-status').textContent = error.message;
  } finally {
    $('player-code').value = '';
    submit.disabled = $('cancel').disabled = false;
  }
});
window.addEventListener('beforeunload', event => {
  if (dirty) event.preventDefault();
});

async function init() {
  if (!Object.hasOwn(allowed, player) || !allowed[player].includes(list)) {
    $('status').textContent = 'Choose Edit on a player list first.';
    return;
  }
  const names = { blathers: 'Blathers', disastrum: 'Disastrum', kayceenoelle: 'KayceeNoelle' };
  const titles = { 'geometry-dash': 'Geometry Dash', 'fnaf-challenges': 'FNaF Challenges', celeste: 'Celeste', 'beat-saber': 'Beat Saber' };
  $('title').textContent = 'Edit ' + names[player] + ' · ' + titles[list];
  const back = $('back');
  back.href = '../#/player/' + player + '/' + list;
  back.textContent = 'Back to list';
  back.addEventListener('click', event => {
    if (!document.referrer || history.length < 2 || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const previous = new URL(document.referrer);
    const home = new URL('../', location.href);
    if (previous.origin !== home.origin || ![home.pathname, home.pathname + 'index.html'].includes(previous.pathname)) return;
    event.preventDefault();
    history.back();
  });
  try {
    if (editorApi) applyList(await api(listPath));
    else {
      const response = await fetch('../players/' + player + '/' + list + '.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Could not load this list.');
      applyList({ document: await response.json() });
      $('status').textContent = 'Draft preview. Saving and YouTube autofill will be available once the editor service is connected.';
    }
    $('lookup').disabled = $('manual').disabled = false;
  } catch (error) {
    $('status').textContent = error.message;
  }
}
init();
