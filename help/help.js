const endpoint = 'https://playerdatabase-save.botanicaldegu.chatgpt.site/difficulty-help';
const titles = ['Geometry Dash', 'Celeste', 'Beat Saber', 'Five Nights at Freddy’s'];
const defaults = [
  ['Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'].map(name => [name, '']),
  [['Blue', 'Beginner'], ['Green', 'Intermediate'], ['Lime', 'Advanced'], ['Yellow', 'Expert'],
    ['Orange', 'Grandmaster'], ['Red', 'Cracked Grandmaster'], ['Cracked', 'GM+1'], ['Shattered', 'GM+2']],
  Array.from({length: 40}, (_, i) => ['Grade ' + (i + 1), '']),
  [['Challenge difficulty', 'A shared difficulty scale is pending.']],
];
const byId = id => document.getElementById(id);
const form = byId('edit-form');
const status = byId('status');
let sections = defaults;
let revision = null;
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function difficultyIcon(game, name) {
  const key = name.trim().toLowerCase();
  if (game === 0 && defaults[0].some(([label]) => label.toLowerCase() === key)) {
    return '../assets/' + key.replaceAll(' ', '-') + '.png';
  }
  if (game === 1) {
    const match = defaults[1].find(([code, tier]) =>
      code.toLowerCase() === key || tier.toLowerCase() === key);
    if (match) return '../assets/celeste-' + match[0].toLowerCase() + '.png';
  }
  if (game === 2) {
    const match = key.match(/^grade\s+([1-9]|[1-3][0-9]|40)$/);
    if (match) return '../assets/beat-saber/grade' + match[1].padStart(2, '0') + '.webp';
  }
  return '';
}
const search = byId('game-search');
const guide = byId('guide');
const expandedGames = new Set();

function filterGames() {
  const query = search.value.trim();
  const matches = window.PlayerDatabaseSearch(query);
  let count = 0;
  for (const panel of guide.children) {
    panel.hidden = !matches(titles[Number(panel.dataset.game)]);
    panel.open = !panel.hidden && (Boolean(query) || expandedGames.has(panel.dataset.game));
    if (!panel.hidden) count++;
  }
  const result = byId('game-results');
  result.hidden = count > 0;
  result.textContent = count ? '' : 'No games match your search.';
}

function render() {
  guide.replaceChildren(...sections.map((rows, i) => {
    const panel = element('details', '');
    panel.className = 'panel';
    panel.dataset.game = String(i);
    const summary = element('summary', titles[i]);
    summary.addEventListener('click', () => {
      if (!search.value.trim()) {
        if (panel.open) expandedGames.delete(panel.dataset.game);
        else expandedGames.add(panel.dataset.game);
      }
    });
    panel.append(summary);
    const table = document.createElement('table');
    table.setAttribute('aria-label', titles[i] + ' difficulty guide');
    const header = table.createTHead().insertRow();
    for (const label of [i === 2 ? 'Grade' : 'Difficulty', 'Description']) {
      const cell = element('th', label);
      cell.scope = 'col';
      header.append(cell);
    }
    const body = table.createTBody();
    const addRow = (name, description, src = '') => {
      const row = body.insertRow();
      const term = element('th', '');
      term.scope = 'row';
      const label = element('span', name);
      label.className = 'difficulty-label';
      if (src) {
        const icon = document.createElement('img');
        icon.src = src;
        icon.alt = '';
        icon.width = 42;
        icon.height = 42;
        icon.loading = 'lazy';
        label.prepend(icon);
      }
      term.append(label);
      row.append(term, element('td', description || '—'));
    };
    for (const [name, description] of rows) {
      addRow(name, description, difficultyIcon(i, name));
    }
    panel.append(table);
    return panel;
  }));
  filterGames();
}

search.addEventListener('input', filterGames);

async function request(options) {
  const response = await fetch(endpoint, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The difficulty guide service is unavailable.');
  return data;
}
byId('edit').onclick = () => {
  byId('fields').replaceChildren(...sections.map((rows, i) => {
    const label = element('label', titles[i]);
    const input = document.createElement('textarea');
    input.required = true;
    input.value = rows.map(([name, description]) => name + ' | ' + description).join('\n');
    label.append(input);
    return label;
  }));
  form.hidden = false;
  byId('edit').hidden = true;
  byId('fields').querySelector('textarea').focus();
};
byId('cancel').onclick = () => {
  form.reset();
  form.hidden = true;
  byId('edit').hidden = false;
  byId('edit').focus();
};
form.onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  byId('cancel').disabled = true;
  status.textContent = 'Saving guide…';
  const data = new FormData(form);
  const next = [...form.querySelectorAll('textarea')].map(input =>
    input.value.split('\n').filter(line => line.trim()).map(line => {
      const [name, ...rest] = line.split('|');
      return [name.trim(), rest.join('|').trim()];
    }));
  try {
    const result = await request({
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({editor: data.get('editor'), code: data.get('code'), sections: next, revision}),
    });
    revision = result.revision;
    sections = next;
    render();
    byId('cancel').onclick();
    status.textContent = 'Difficulty guide saved.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    form.elements.code.value = '';
    button.disabled = false;
    byId('cancel').disabled = false;
  }
};
render();
request().then(data => {
  if (data.sections) sections = data.sections;
  revision = data.revision;
  render();
  byId('edit').disabled = false;
}).catch(() => { status.textContent = 'Showing the default guide. Editing is currently unavailable.'; });
