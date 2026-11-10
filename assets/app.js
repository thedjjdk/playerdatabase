/* Player Lists: lightweight shared renderer. No frameworks, no player data in index.html. */
(() => {
  'use strict';
  const app = document.getElementById('app');
  const directoryUrl = 'players.json';
  const cache = new Map();
  const games = {
    'geometry-dash': 'Geometry Dash',
    'beat-saber': 'Beat Saber',
    celeste: 'Celeste',
    'fnaf-challenges': 'FNaF'
  };
  const state = {
    directory: [],
    loadError: null,
    theme: readTheme(),
    search: '',
    game: '',
    highlightedResult: 0,
    listSearch: '',
    year: 'all',
    order: 'rank', inProgress:false,
    activeKey: '',
    activeList: null,
    activeProfile: null,
    activeEntry: null,
    route: null,
    menuOpen: false,
    request: 0
  };
  const ICON_SEARCH = `<svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.1"/><path d="m16.1 16.1 5.1 5.1"/></svg>`;
  const ICON_MOON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 15.6A9 9 0 0 1 8.4 3.4a9 9 0 1 0 12.2 12.2Z"/></svg>`;
  const ICON_SUN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>`;

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function validId(v) { return typeof v === 'string' && /^[a-z0-9-]+$/.test(v); }
  function validJsonName(v) { return typeof v === 'string' && /^[a-z0-9-]+\.json$/.test(v); }
  function checkedColor(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#aeb4bc'; }
  function safeLink(v) {
    if (typeof v !== 'string') return null;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && ['www.youtube.com','youtube.com','m.youtube.com','youtu.be','www.twitch.tv','twitch.tv','clips.twitch.tv','docs.google.com'].includes(u.hostname) ? u.href : null;
    } catch (_) { return null; }
  }
  function youtubeId(v) {
    const url = safeLink(v);
    if (!url) return null;
    const u = new URL(url);
    let id = null;
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if (/^\/(?:shorts|live|embed)\//.test(u.pathname)) id = u.pathname.split('/')[2];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
  }
  function thumbnailFor(item, profile) {
    if (item.thumbnail && /^thumbnails\/[A-Za-z0-9_.-]+\.(?:png|jpg|jpeg|webp)$/i.test(item.thumbnail)) {
      return `players/${profile.id}/${item.thumbnail}?v=1`;
    }
    if (item.thumbnail && /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/hqdefault\.jpg$/.test(item.thumbnail)) {
      return item.thumbnail;
    }
    if (item.thumbnail) return safeLink(item.thumbnail);
    const id = youtubeId(item.videoUrl);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  }
  function readTheme() {
    try {return localStorage.getItem('player-lists-theme') === 'light' ? 'light' : 'dark';}
    catch (_) {return 'dark';}
  }
  function setTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    try { localStorage.setItem('player-lists-theme', state.theme); } catch (_) {}
    document.body.classList.add('theme-switching');
    applyTheme();
    // Apply the new colors before restoring hover and menu transitions.
    document.body.getBoundingClientRect();
    document.body.classList.remove('theme-switching');
    const btn = document.querySelector('[data-theme-toggle]');
    if (btn) {
      btn.innerHTML = state.theme === 'light' ? ICON_SUN : ICON_MOON;
      btn.title = state.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
      btn.setAttribute('aria-label',btn.title);
    }
  }
  function applyTheme() {
    window.PlayerListsTheme.apply(state.activeProfile, state.theme);
  }
  function playerRoute(pid, listId = '', rank = null) {
    let url = `#/player/${pid}`;
    if (listId) url += `/${listId}`;
    if (rank !== null) url += `/level/${rank}`;
    return url;
  }
  function parseRoute() {
    const raw = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (raw[0] !== 'player') return {type:'home'};
    if (!validId(raw[1])) return {type:'home'};
    const player = state.directory.find(p => p.id === raw[1]);
    if (!player) return {type:'missing', id:raw[1]};
    return {type:'player', player, listId:raw[2] || '', rank:raw[3]==='level' && /^\d+$/.test(raw[4]||'') ? Number(raw[4]) : null};
  }
  async function fetchJson(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(path, {cache: 'no-cache'}).then(r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      }).catch(error => {cache.delete(path); throw error;}));
    }
    return cache.get(path);
  }
  function displayName(pid) {
    return state.directory.find(p=>p.id===pid)?.name || pid;
  }
  function header() {
    const isHome = state.route?.type === 'home';
    return `<header class="sitehead"><div class="container headinner">
      <a class="wordmark" href="#/" aria-label="Player Lists home">PLAYER<b> LISTS</b></a>
      <nav class="navlinks" aria-label="Main navigation"><a class="${isHome?'active':''}" href="#/">Players</a><a href="help/">Help</a></nav>
      <div class="appearance-tools theme-only"><button type="button" class="appearance-button" data-theme-toggle title="${state.theme==='light'?'Switch to dark mode':'Switch to light mode'}" aria-label="${state.theme==='light'?'Switch to dark mode':'Switch to light mode'}">${state.theme==='light'?ICON_SUN:ICON_MOON}</button></div>
      <div class="mobilehead-tools"><button type="button" class="mobileicon ${state.menuOpen?'is-open':''}" data-menu-toggle aria-label="${state.menuOpen?'Close':'Open'} navigation" aria-controls="site-menu" aria-expanded="${state.menuOpen}"><span class="menu-bars" aria-hidden="true"><i></i><i></i><i></i></span></button></div>
    </div><div id="site-menu" class="mobile-menu ${state.menuOpen?'open':''}" role="navigation" aria-label="Mobile navigation" aria-hidden="${!state.menuOpen}" ${state.menuOpen?'':'inert'}><div class="mobile-menu-inner"><a href="#/">Search players</a><a href="help/">Help</a>${state.route?.type==='player'?`<a href="${esc(playerRoute(state.route.player.id))}">${esc(state.route.player.name)}'s lists</a>`:''}</div></div></header>`;
  }
  function footer() {
    return `<footer class="container player-foot"><span>Player Lists · Built from the supplied Layout List design</span><a href="#/">Search players</a></footer>`;
  }
  function shell(body) {
    const previous = app.querySelector('.wide-tabs [aria-selected="true"][data-player-tab]');
    const previousScroll = previous?.parentElement.scrollLeft ?? 0;
    app.innerHTML = `${header()}${body}${footer()}`;
    const selected = app.querySelector('.wide-tabs [aria-selected="true"][data-player-tab]');
    if (selected && previous?.dataset.playerId === selected.dataset.playerId) {
      const bar = selected.parentElement;
      bar.scrollLeft = previousScroll;
      if (previous.dataset.playerTab !== selected.dataset.playerTab) {
        const outgoing = [...bar.querySelectorAll('[data-player-tab]')]
          .find(tab => tab.dataset.playerTab === previous.dataset.playerTab);
        if (outgoing) slideTabBorder(bar, outgoing, selected);
      }
    }
    applyTheme();
    applyDifficultyColors();
  }
  function slideTabBorder(bar, outgoing, selected) {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !selected.animate) return;
    const track = bar.getBoundingClientRect();
    const from = outgoing.getBoundingClientRect();
    const to = selected.getBoundingClientRect();
    const ring = document.createElement('span');
    ring.className = 'list-tab-sliding-border';
    ring.setAttribute('aria-hidden', 'true');
    const position = rect => ({
      transform: `translate(${rect.left - track.left - bar.clientLeft + bar.scrollLeft}px, ${rect.top - track.top - bar.clientTop}px)`,
      width: `${rect.width}px`, height: `${rect.height}px`
    });
    const timing = {duration: 240, easing: 'ease-in-out'};
    bar.classList.add('is-sliding');
    bar.append(ring);
    const artwork = [];
    for (const tab of bar.querySelectorAll('[data-player-tab]')) {
      const bounds = tab.getBoundingClientRect();
      const banner = tab.querySelector('.list-tab-banner');
      if (!banner) continue;
      banner.style.display = 'block';
      const windowAt = rect => {
        const left = rect.left - bounds.left;
        const right = rect.right - bounds.left;
        const top = rect.top - bounds.top;
        const bottom = rect.bottom - bounds.top;
        return {clipPath: `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`};
      };
      artwork.push([banner, banner.animate([windowAt(from), windowAt(to)], {...timing, fill: 'both'})]);
    }
    const finish = () => {
      for (const [banner, animation] of artwork) {
        banner.style.removeProperty('display');
        animation.cancel();
      }
      ring.remove();
      bar.classList.remove('is-sliding');
    };
    ring.animate([position(from), position(to)], timing).finished.then(finish, finish);
  }
  function showError(title, detail) {
    shell(`<main class="container"><section class="singlepanel player-route-error"><h2>${esc(title)}</h2><p class="data-note">${esc(detail)}</p><button type="button" class="ghostbutton" data-retry>Try again</button><div class="buttonrow"><a class="inline-back" href="#/">← Back to player search</a></div></section></main>`);
  }
  function resultMarkup(players) {
    if (!players.length) return `<div class="player-empty">No matching players.</div>`;
    return players.map((p,i)=>`<a class="player-result ${i===state.highlightedResult?'is-highlighted':''}" href="${esc(playerRoute(p.id))}" role="option" aria-selected="${i===state.highlightedResult}" id="player-option-${i}">${playerAvatar(p)}<span><span class="result-name">${esc(p.name)}</span><span class="result-meta">Open personal lists</span></span><span class="result-arrow" aria-hidden="true">›</span></a>`).join('');
  }
  function matchingPlayers() {
    const query = state.search.trim().toLocaleLowerCase();
    return state.directory.filter(p => p.name.toLocaleLowerCase().includes(query) &&
      (!state.game || p.games?.includes(state.game)));
  }
  function fitPlayerResults() {
    const results = document.getElementById('player-results');
    if (!results || results.hidden || !matchMedia('(max-width: 780px)').matches) return;
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    const available = Math.floor(bottom - results.getBoundingClientRect().top - 12);
    results.style.setProperty('--player-results-height', `${Math.max(0, available)}px`);
  }
  function refreshResults() {
    const results = document.getElementById('player-results');
    const input = document.getElementById('player-search');
    if (!results || !input) return;
    const matches = matchingPlayers();
    state.highlightedResult = Math.max(0, Math.min(state.highlightedResult, matches.length - 1));
    results.innerHTML = resultMarkup(matches);
    input.setAttribute('aria-activedescendant',matches.length ? `player-option-${state.highlightedResult}` : '');
    fitPlayerResults();
  }
  function homeView() {
    state.activeProfile = null;
    state.activeList = null;
    shell(`<main class="container home-main"><section class="home-focus" aria-label="Player search">
      <div class="home-kicker">PLAYER DIRECTORY</div><h1>Find a player</h1>
      <div class="player-search-wrap"><div class="player-search-box">${ICON_SEARCH}<input type="search" id="player-search" placeholder="Search for a player..." autocomplete="off" aria-label="Search players" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="player-results" value="${esc(state.search)}"></div>
      </div><p class="home-helper">Search by name or filter by game. <a href="help/">Difficulty help</a></p>
      <div class="game-filters" role="group" aria-label="Filter players by game">
        ${Object.entries(games).sort((a,b)=>a[1].localeCompare(b[1], 'en', {sensitivity:'base'})).map(([id, name]) => `<button type="button" data-game-filter="${id}" aria-pressed="${state.game === id}">${name}</button>`).join('')}
      </div></section>
      <section class="player-directory" aria-labelledby="directory-heading"><h2 id="directory-heading">Players A–Z</h2><div class="player-results" id="player-results" role="listbox" aria-labelledby="directory-heading"></div></section>
      <p class="home-contact">Want your own list profile? Reach out to <strong>djjdk</strong> on Discord.</p></main>`);
    refreshResults();
    applyTheme();
  }
  function tabsMarkup(pid, profile, active) {
    return `<div class="wide-tabs" role="tablist" aria-label="Player lists">${profile.lists.map(entry=>`<button type="button" role="tab" aria-selected="${entry.id===active}" data-player-tab="${esc(entry.id)}" data-player-id="${esc(pid)}">${gameBanner(profile,entry)}<span class="list-tab-label">${esc(entry.title)}</span></button>`).join('')}${profile.editable===false?'':`<button type="button" data-list-editor data-player-id="${esc(pid)}" data-list-id="${esc(active)}">Edit</button>`}</div>`;
  }
  function playerAvatar(player) {
    const initial = esc(player.name.slice(0, 1).toUpperCase());
    const image = player.avatar === 'avatar.webp' && validId(player.id)
      ? `<img src="players/${player.id}/avatar.webp" alt="" data-player-avatar>` : '';
    return `<span class="player-avatar-small" aria-hidden="true" style="--accent:${window.PlayerListsTheme.colors(player).right}">${initial}${image}</span>`;
  }
  function colorDifficultyPixels(pixels, width, left, right) {
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (!pixels[offset + 3]) continue;
      const maximum = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      const minimum = Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      const lightness = (maximum + minimum) / 510;
      // Match Layout List. Neutral horns, teeth and outlines retain their original pixels.
      const amount = Math.max(0, Math.min(1, (maximum - minimum - 8) / 38));
      const x = (offset / 4) % width;
      const blend = Math.max(0, Math.min(1, (x / Math.max(1, width - 1) - 0.2) / 0.6));
      for (let channel = 0; channel < 3; channel++) {
        const accent = left[channel] + (right[channel] - left[channel]) * blend;
        const tone = lightness <= 0.5
          ? accent * lightness * 2
          : accent + (255 - accent) * (lightness - 0.5) * 2;
        pixels[offset + channel] = Math.round(
          pixels[offset + channel] * (1 - amount) + tone * amount
        );
      }
    }
  }
  const difficultyImageCache = new Map();
  const difficultyColorCache = new Map();
  function coloredDifficulty(difficulty, left, right) {
    const key = difficulty + '/' + left + '/' + right;
    if (!difficultyColorCache.has(key)) {
      if (!difficultyImageCache.has(difficulty)) {
        const image = new Image();
        const ready = new Promise((resolve, reject) => {
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('Difficulty face could not load.'));
        });
        image.src = 'assets/' + difficulty + '.png';
        difficultyImageCache.set(difficulty, ready);
      }
      const rendered = difficultyImageCache.get(difficulty).then(image => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Difficulty coloring is unavailable.');
        context.drawImage(image, 0, 0);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const rgb = color => color.slice(1).match(/../g).map(channel => parseInt(channel, 16));
        colorDifficultyPixels(frame.data, canvas.width, rgb(left), rgb(right));
        context.putImageData(frame, 0, 0);
        return canvas.toDataURL('image/png');
      });
      difficultyColorCache.set(key, rendered);
    }
    return difficultyColorCache.get(key);
  }
  function applyDifficultyColors() {
    app.querySelectorAll('img[data-difficulty-tint]').forEach(image => {
      coloredDifficulty(image.dataset.difficultyTint, image.dataset.leftColor, image.dataset.rightColor)
        .then(url => {
          if (!image.isConnected) return;
          image.src = url;
          image.removeAttribute('data-difficulty-tint');
        })
        .catch(() => {
          // Keep the original face available when a browser cannot generate its tint.
          image.removeAttribute('data-difficulty-tint');
        });
    });
  }
  const difficultyLabels = new Map([["easy","Easy"],["normal","Normal"],["hard","Hard"],["harder","Harder"],["insane","Insane"],["easy-demon","Easy Demon"],["medium-demon","Medium Demon"],["hard-demon","Hard Demon"],["insane-demon","Insane Demon"],["extreme-demon","Extreme Demon"]]);
  function demonFace(difficulty, profile) {
    const label = difficultyLabels.get(difficulty);
    if (!label) return '';
    const left = checkedColor(profile.backgroundLeft || profile.backgroundTint || profile.backgroundRight);
    const right = checkedColor(profile.backgroundRight || profile.backgroundTint || profile.backgroundLeft);
    const hasPreTintedFace = difficulty === 'insane-demon' || difficulty === 'extreme-demon';
    const preset = hasPreTintedFace && left.toLowerCase() === right.toLowerCase() &&
      ['#78bdf4', '#a83136'].includes(left.toLowerCase());
    if (preset) {
      return `<img class="player-demon-face" src="assets/${difficulty}-${left.slice(1).toLowerCase()}.png" alt="${label}" title="${label}">`;
    }
    return `<img class="player-demon-face" src="assets/${difficulty}.png" alt="${label}" title="${label}" data-difficulty-tint="${difficulty}" data-left-color="${left}" data-right-color="${right}">`;
  }
  function celesteMeterRank(value) {
    const rank = String(value || '').trim().toLowerCase();
    const plus = rank.match(/(?:\bgm|grand\s*master)\s*\+\s*(\d+)/);
    if (plus) return plus[1] === '1' ? { state: 'cracked', tier: 'GM+1' }
      : plus[1] === '2' ? { state: 'shattered', tier: 'GM+2' }
      : { state: 'unrated', tier: '' };
    if (/cracked\s*(?:grand\s*master|gm\b)/.test(rank)) return { state: 'red', tier: 'Cracked GM' };
    if (/\bgm\b|grand\s*master/.test(rank)) return { state: 'orange', tier: 'GM' };
    const tiers = [
      ['beginner', 'blue', 'Beginner'], ['intermediate', 'green', 'Intermediate'],
      ['advanced', 'lime', 'Advanced'], ['expert', 'yellow', 'Expert'],
      ['shattered', 'shattered', 'GM+2'], ['cracked', 'cracked', 'GM+1'],
      ['blue', 'blue', 'Beginner'], ['green', 'green', 'Intermediate'],
      ['lime', 'lime', 'Advanced'], ['yellow', 'yellow', 'Expert'],
      ['orange', 'orange', 'GM'], ['red', 'red', 'Cracked GM']
    ];
    for (const [word, state, tier] of tiers) {
      if (new RegExp('\\b' + word + '\\b').test(rank)) return { state, tier };
    }
    return { state: 'unrated', tier: '' };
  }
  function celesteMeter(rank) {
    const { state, tier } = celesteMeterRank(rank);
    if (state === 'unrated') return '';
    const label = 'Celeste rank: ' + rank;
    return `<span class="celeste-meter" role="img" aria-label="${esc(label)}" title="${esc(label)}"><img src="assets/celeste-${state}.png" alt="" aria-hidden="true" width="66" height="62"><span class="celeste-meter-tier" aria-hidden="true">${esc(tier)}</span></span>`;
  }
  function beatSaberGrade(value) {
    const match = String(value ?? '').trim().match(/^(?:grade\s*)?(\d{1,2})$/i);
    const grade = match ? Number(match[1]) : 0;
    if (grade < 1 || grade > 40) return '';
    return `<img class="player-demon-face beat-saber-grade" src="assets/beat-saber/grade${String(grade).padStart(2, '0')}.webp" alt="Beat Saber Grade ${grade}" title="Grade ${grade}" width="56" height="56" style="width:56px;height:56px">`;
  }
  function difficultyBadge(item, profile, game) {
    if (game === 'geometry-dash') return demonFace(item.difficulty, profile);
    if (game === 'celeste') return celesteMeter(item.gameRank, profile);
    if (game === 'beat-saber') return beatSaberGrade(item.gameRank);
    return '';
  }
  function badgesMarkup(profile) {
    const icons={milestone:'★','personal-best':'↗',count:'#',perfect:'◆',challenge:'⚑',endurance:'◷',favorite:'♥'};
    return `<div class="profile-badges" aria-label="Player highlights">${(profile.badges||[]).filter(b=>!b.list||b.list===state.route?.listId).map(b=>`<span class="profile-badge" title="Player-created highlight"><span aria-hidden="true">${icons[b.style]||'★'}</span> ${esc(b.name)}</span>`).join('')}</div>`;
  }
  function gameBanner(profile,entry) {
    const custom = entry.bannerImage === 'banner-'+entry.id+'.webp' && /^[a-f0-9]{64}$/.test(entry.bannerVersion||'');
    const defaults = {'geometry-dash':'geometry-dash','celeste':'celeste','beat-saber':'beat-saber','fnaf-challenges':'fnaf','fnaf':'fnaf'};
    const artwork = defaults[listGame(entry)];
    if (!custom && !artwork) return '';
    const src = custom ? `players/${esc(profile.id)}/${esc(entry.bannerImage)}?v=${entry.bannerVersion}` : `assets/game-art/${artwork}.webp`;
    const opacity = custom ? Math.max(5,Math.min(50,entry.bannerOpacity||15))/100 : .65;
    return `<img class="list-tab-banner" src="${src}" alt="" aria-hidden="true" style="opacity:${opacity}">`;
  }
  function playerIntro(profile) {
    return `<div class="pageintro"><a href="#/" class="inline-back">‹ Back to player search</a><div class="player-title-wrap" style="margin-top:13px">${playerAvatar(profile)}<div><h1>${esc(profile.name)}</h1></div></div>${badgesMarkup(profile)}</div>`;
  }
  function sidebar(profile, doc) {
    const src = safeLink(doc.sourceUrl);
    return `<aside class="sidebar"><section class="panel"><h2>About this list</h2><p>${esc(doc.description||'Personal challenge rankings.')}</p>${src?`<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${esc(sourceLabel(doc))} ↗</a>`:''}</section><section class="panel"><h2>List statistics</h2><div class="bulletrows"><div><span>Ranked entries</span><strong>${(doc.levels||[]).length.toLocaleString()}</strong></div><div><span>Player</span><strong>${esc(profile.name)}</strong></div></div></section>${profile.lists.length>1?`<section class="panel"><h2>Other lists</h2><div class="tierlinks">${profile.lists.map(list=>`<a class="tierchip" href="${esc(playerRoute(profile.id,list.id))}">${esc(list.title)}</a>`).join('')}</div></section>`:''}</aside>`;
  }
  function levelVideo(item) { return safeLink(item.videoUrl); }
  function displayDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value || '');
    const date = new Date(value + 'T00:00:00Z');
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', {
      timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric'
    });
  }
  function completionInfo(item, profile = state.activeProfile) {
    if(item.status === 'in-progress') return {prefix:'In Progress',label:'PROGRESS',value:item.progress || 'Not provided',year:''};
    if (item.completionDate) return { prefix: 'Completed on', label: 'COMPLETION DATE', value: displayDate(item.completionDate), year: String(item.completionDate).slice(0, 4) };
    if (item.completionYear) return { prefix: 'Completed in', label: 'COMPLETION YEAR', value: String(item.completionYear), year: String(item.completionYear) };
    if (item.videoPublishedDate) return { prefix: profile?.id === 'djjdk' ? 'Completed on' : 'Completed by', label: profile?.id === 'djjdk' ? 'COMPLETION DATE' : 'COMPLETED BY', value: displayDate(item.videoPublishedDate), year: String(item.videoPublishedDate).slice(0, 4) };
    return { prefix: '', label: 'COMPLETION DATE', value: 'Not provided', year: '' };
  }
  function sourceLabel(doc) {
    return doc.sourceLabel || (String(doc.sourceUrl).includes('youtube.com/playlist') ? 'View YouTube playlist' : 'View source');
  }
  function listGame(entry) {
    return entry?.game || entry?.id;
  }
  function renderCard(profile, listId, item, index) {
    const game = listGame(profile.lists.find(entry => entry.id === listId));
    const gd = game === 'geometry-dash';
    const rank = Number.isInteger(item.rank) ? item.rank : index+1;
    const displayRank = state.activeList.levels.filter(v => (v.status === 'in-progress') === (item.status === 'in-progress')).findIndex(v => v.rank === item.rank) + 1;
    const link = playerRoute(profile.id, listId, rank);
    const video = levelVideo(item);
    const thumbnail = thumbnailFor(item,profile);
    const name = item.name || `Entry ${rank}`;
    const completion = completionInfo(item, profile);
    return `<article class="listcard">
      <a class="card-stretched" href="${esc(link)}" aria-label="View ${esc(name)} details"></a>
      ${thumbnail ? (video
        ? `<a class="thumbnail has-video" href="${esc(video)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${esc(name)}"><img src="${esc(thumbnail)}" loading="lazy" alt="" data-thumbnail></a>`
        : `<span class="thumbnail"><img src="${esc(thumbnail)}" loading="lazy" alt="${esc(name)} thumbnail" data-thumbnail></span>`) : ''}
      <div class="listcardmeta"><h2 class="demon-title"><span><span class="hash">#${displayRank || rank}</span> – ${esc(name)}</span>${difficultyBadge(item, profile, game)}</h2>
      <p class="creator">${completion.prefix ? `${completion.prefix} <strong>${esc(completion.value)}</strong>` : 'Completion date unavailable'}</p>
      <p class="tiernote">${item.enjoyment != null ? `Enjoyment: ${esc(item.enjoyment)}/10` : 'Personal ranking'}${gd ? (item.attempts ? ` · ${esc(item.attempts)} attempts` : '') : (item.timeTaken ? ` · Game Time: ${esc(item.timeTaken)}` : '')}${!gd && item.gameRank ? ` · ${game === 'beat-saber' ? 'Grade' : 'Rank'}: ${esc(game === 'beat-saber' ? String(item.gameRank).replace(/^grade\s*/i, '') : item.gameRank)}` : ''}${item.worstFail != null ? ` · ${esc(item.worstFail)}% worst fail` : ''}</p></div></article>`;
  }
  function filteredLevels() {
    const items = Array.isArray(state.activeList?.levels) ? [...state.activeList.levels] : [];
    const q = state.listSearch.trim().toLocaleLowerCase();
    let list = items.filter(v => {
      if ((v.status === 'in-progress') !== !!state.inProgress) return false;
      if (state.year!=='all' && completionInfo(v).year!==state.year) return false;
      return !q || [v.name,completionInfo(v).year,v.videoTitle].some(x=>String(x||'').toLocaleLowerCase().includes(q));
    });
    if (state.order === 'reverse') list.reverse();
    else if (state.order === 'name') list.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    else if (state.order === 'year') list.sort((a,b)=>String(b.completionDate || b.completionYear || b.videoPublishedDate || '').localeCompare(String(a.completionDate || a.completionYear || a.videoPublishedDate || '')) || (Number(a.rank)||0)-(Number(b.rank)||0));
    return list;
  }
  function updateCardList() {
    const listEl = document.getElementById('level-list');
    const countEl = document.getElementById('result-count');
    if (!listEl || !state.activeProfile || !state.route) return;
    const items = filteredLevels();
    const total = state.activeList.levels.filter(v => (v.status === 'in-progress') === !!state.inProgress).length;
    if (countEl) countEl.textContent = `${items.length} of ${total} ranked ${total === 1 ? 'entry' : 'entries'}`;
    if (!total) {
      listEl.innerHTML = `<div class="empty list-empty"><strong>No levels added yet</strong><span>${esc(state.activeList.description||'This list is ready for entries.')}</span></div>`;
    } else if (!items.length) {
      listEl.innerHTML = `<div class="empty list-empty"><strong>No matching levels</strong><span>Change the search or completion-year filter.</span></div>`;
    } else {
      listEl.innerHTML = items.map((x,i)=>renderCard(state.activeProfile,state.route.listId,x,i)).join('');
    }
    applyDifficultyColors();
  }
  function listView(profile, entry, doc) {
    const years = [...new Set(doc.levels.map(x=>completionInfo(x).year).filter(Boolean))].sort((a,b)=>b-a);
    const content = `<p class="list-description-inline">${esc(doc.description||'Personal ranked list.')}</p>
      <div class="list-toolbar"><div class="list-filter-area">
      <input class="filter" type="search" id="level-search" aria-label="Search levels" placeholder="Search levels..." value="${esc(state.listSearch)}" autocomplete="off">
      <select class="select" id="year-filter" aria-label="Filter by completion year"><option value="all">All years</option>${years.map(year=>`<option value="${year}" ${state.year===String(year)?'selected':''}>${year}</option>`).join('')}</select>
      <select class="select" id="sort-order" aria-label="Sort levels"><option value="rank" ${state.order==='rank'?'selected':''}>Rank: hardest first</option><option value="reverse" ${state.order==='reverse'?'selected':''}>Rank: easiest first</option><option value="name" ${state.order==='name'?'selected':''}>Level name</option>${years.length?`<option value="year" ${state.order==='year'?'selected':''}>Newest first</option>`:''}</select><button class="ghostbutton" id="in-progress-toggle" aria-pressed="${!!state.inProgress}">In Progress</button></div></div>
      <div class="count-line" id="result-count"></div><div class="listcards" id="level-list"></div>`;
    shell(`<main class="container">${playerIntro(profile)}${tabsMarkup(profile.id,profile,entry.id)}<div class="layout"><div class="content">${content}</div>${sidebar(profile,doc)}</div></main>`);
    updateCardList();
  }
  function detailVideo(item) {
    const video = levelVideo(item);
    const thumb = thumbnailFor(item,state.activeProfile);
    if (video && thumb) return `<a class="videoarea detail-video-link" target="_blank" rel="noopener noreferrer" href="${esc(video)}" title="Watch the original video"><img data-thumbnail src="${esc(thumb)}" alt="${esc(item.name)} thumbnail"><span class="videoempty">Watch video ↗</span></a>`;
    if (thumb) return `<div class="videoarea"><img data-thumbnail src="${esc(thumb)}" alt="${esc(item.name)} thumbnail"></div>`;
    if (video) return `<div class="video-area-empty"><a href="${esc(video)}" target="_blank" rel="noopener noreferrer">Watch video ↗</a></div>`;
    return `<div class="video-area-empty">No direct video link was provided for this entry.</div>`;
  }
  function detailView(profile, entry, doc, rank) {
    const levels = doc.levels;
    const game = listGame(entry);
    const gd = game === 'geometry-dash';
    const index = levels.findIndex(x => x.rank === rank);
    if (index < 0) {showError('Level not found', `No level with rank #${rank} exists in this list.`);return;}
    const item = levels[index];
    const prev = levels[index-1];
    const next = levels[index+1];
    const source = safeLink(doc.sourceUrl);
    const proof = levelVideo(item);
    const attr = (key, fallback='Not provided') => item[key] != null && item[key] !== '' ? esc(item[key]) : fallback;
    const completion = completionInfo(item, profile);
    const facts = [
      [ `#${esc(item.rank)}`, 'LIST RANK' ],
      [ esc(completion.value), completion.label ],
      [ gd ? attr('attempts') : attr('timeTaken'), gd ? 'ATTEMPTS' : 'GAME TIME' ],
      ...(gd ? [[ item.worstFail != null ? `${esc(item.worstFail)}%` : 'Not provided', 'WORST FAIL' ]] : [])
    ];
    const body = `<div class="backrow"><a href="${esc(playerRoute(profile.id,entry.id))}" class="backbutton">‹ Back to list</a><div class="prevnext">
      <button type="button" ${prev?'':'disabled'} data-rank-nav="${prev?prev.rank:''}">‹ Previous</button><button type="button" ${next?'':'disabled'} data-rank-nav="${next?next.rank:''}">Next ›</button></div></div>
      <section class="singlepanel"><div class="detailheading"><h1 class="demon-title"><span>#${esc(item.rank)} – ${esc(item.name)}</span>${difficultyBadge(item, profile, game)}</h1><p>${esc(doc.title||entry.title)} · ${esc(profile.name)}</p></div>
      ${detailVideo(item)}
      <div class="facts detail-grid">${facts.map(([value,label])=>`<div class="fact"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
      <p class="statline"><strong>Enjoyment rating:</strong> ${item.enjoyment == null ? 'Not provided' : `${esc(item.enjoyment)}/10`}</p>
      ${gd ? `<p class="statline"><strong>Time taken:</strong> ${attr('timeTaken')}</p>` : `<p class="statline"><strong>${game === 'beat-saber' ? 'Grade' : 'Rank'}:</strong> ${game === 'beat-saber' ? attr('gameRank').replace(/^grade\s*/i, '') : attr('gameRank')}</p>`}
      ${item.videoTitle ? `<p class="statline"><strong>Video title:</strong> ${esc(item.videoTitle)}</p>` : ''}
      ${item.rankLabel && item.rankLabel !== String(item.rank) ? `<p class="statline"><strong>Original ranking label:</strong> ${esc(item.rankLabel)}</p>` : ''}
      ${item.name.includes('*') ? `<p class="statline"><strong>Source notation:</strong> Asterisk(s) are retained as written in the source spreadsheet.</p>` : ''}
      ${proof ? `<p class="statline"><a href="${esc(proof)}" target="_blank" rel="noopener noreferrer">Watch video ↗</a></p>` : ''}
      ${source ? `<p class="statline"><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${esc(sourceLabel(doc))}${item.sourceRow?` (row ${esc(item.sourceRow)})`:''} ↗</a></p>` : ''}
      </section>`;
    shell(`<main class="container">${playerIntro(profile)}${tabsMarkup(profile.id,profile,entry.id)}<div class="layout"><div class="content">${body}</div>${sidebar(profile,doc)}</div></main>`);
  }
  async function routeView() {
    const seq = ++state.request;
    state.menuOpen = false;
    state.route = parseRoute();
    if (state.route.type === 'home') {homeView();return;}
    if (state.route.type === 'missing') {state.activeProfile=null;showError('Player not found',`No registered player named ${state.route.id}.`);return;}
    const {player} = state.route;
    const folder = validId(player.folder) ? player.folder : player.id;
    try {
      const currentTab = app.querySelector('.wide-tabs [aria-selected="true"][data-player-tab]');
      if (currentTab?.dataset.playerId !== player.id) {
        state.activeProfile = player;
        shell(`<main class="container"><div class="pageintro"><h1>${esc(player.name)}</h1></div><div class="singlepanel">Loading player data…</div></main>`);
      }
      const profile = await fetchJson(`players/${folder}/profile.json`);
      if (seq !== state.request) return;
      if (!profile || profile.id !== player.id || !Array.isArray(profile.lists)) throw new Error('Player profile is invalid.');
      state.activeProfile = {...profile, accent: checkedColor(player.accent), backgroundTint: player.backgroundTint, avatar: player.avatar};
      applyTheme();
      let entry = profile.lists.find(x=>x.id===state.route.listId);
      if (!entry) entry = profile.lists[0];
      if (!entry || !validId(entry.id) || (!entry.data && !validJsonName(entry.file))) throw new Error('No valid lists are configured for this player.');
      if (entry.id !== state.route.listId) {
        const destination=playerRoute(player.id,entry.id);
        // Resolve the default tab without a full page reload.
        history.replaceState(history.state, '', destination);
        routeView();
        return;
      }
      const key = `${folder}/${entry.id}`;
      if (state.activeKey !== key) {
        state.listSearch='';state.year='all';state.order='rank';state.inProgress=false;state.activeKey=key;
      }
      const data = entry.data || await fetchJson(`players/${folder}/${entry.file}`);
      if (seq !== state.request) return;
      if (!data || !Array.isArray(data.levels)) throw new Error('The list data is invalid.');
      state.activeList = data;
      if (state.route.rank != null) detailView(state.activeProfile,entry,data,state.route.rank);
      else listView(state.activeProfile,entry,data);
    } catch (err) {
      if (seq !== state.request) return;
      showError('Unable to load player data',`${err.message}. Check that the player JSON files are present and that the site is being served over HTTP (not file://).`);
    }
  }
  function routeTo(href) {
    state.menuOpen=false;
    if (location.hash===href) {routeView();return;}
    history.pushState({ playerListsBack: true }, '', href);
    routeView();
  }
  function syncSearch(e) {
    state.search=e.target.value;
    state.highlightedResult=0;
    refreshResults();
  }
  app.addEventListener('click',e=>{if(e.target.id==='in-progress-toggle'){state.inProgress=!state.inProgress;state.year='all';document.getElementById('year-filter').value='all';e.target.setAttribute('aria-pressed',String(state.inProgress));updateCardList();}});
  app.addEventListener('input',e=>{
    if (e.target.id==='player-search') syncSearch(e);
    if (e.target.id==='level-search') {state.listSearch=e.target.value;updateCardList();}
  });
  app.addEventListener('change',e=>{
    if (e.target.id==='year-filter') {state.year=e.target.value;updateCardList();}
    if (e.target.id==='sort-order') {state.order=e.target.value;updateCardList();}
  });
  app.addEventListener('keydown',e=>{
    if (e.target.id!=='player-search') return;
    const matches=matchingPlayers();
    if (e.key==='ArrowDown' || e.key==='ArrowUp') {
      if (!matches.length) return;
      e.preventDefault();
      state.highlightedResult=(state.highlightedResult+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;
      refreshResults();
      document.getElementById(`player-option-${state.highlightedResult}`)?.scrollIntoView({block:'nearest'});
    } else if (e.key==='Enter' && matches.length) {
      e.preventDefault();routeTo(playerRoute(matches[state.highlightedResult].id));
    } else if (e.key==='Escape') {
      state.search='';e.target.value='';refreshResults();
    }
  });
  app.addEventListener('click',e=>{
    const theme=e.target.closest('[data-theme-toggle]');
    if (theme) {setTheme(state.theme==='dark'?'light':'dark');return;}
    const game = e.target.closest('[data-game-filter]');
    if (game) {
      state.game = state.game === game.dataset.gameFilter ? '' : game.dataset.gameFilter;
      state.highlightedResult = 0;
      app.querySelectorAll('[data-game-filter]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.gameFilter === state.game));
      });
      refreshResults();
      return;
    }
    const menu=e.target.closest('[data-menu-toggle]');
    if (menu) {
      state.menuOpen=!state.menuOpen;
      const pane=document.getElementById('site-menu');
      pane?.classList.toggle('open',state.menuOpen);
      pane?.setAttribute('aria-hidden',String(!state.menuOpen));
      if(pane) pane.inert=!state.menuOpen;
      menu.classList.toggle('is-open',state.menuOpen);
      menu.setAttribute('aria-expanded',String(state.menuOpen));
      return;
    }
    const editor=e.target.closest('[data-list-editor]');
    if (editor) {
      location.href = 'editor/?' + new URLSearchParams({ player: editor.dataset.playerId, list: editor.dataset.listId });
      return;
    }
    const tab=e.target.closest('[data-player-tab]');
    if (tab) {routeTo(playerRoute(tab.dataset.playerId,tab.dataset.playerTab));return;}
    const arrow=e.target.closest('[data-rank-nav]');
    if (arrow && !arrow.disabled && state.route?.type==='player') {
      routeTo(playerRoute(state.route.player.id,state.route.listId,arrow.dataset.rankNav));return;
    }
    const retry=e.target.closest('[data-retry]');
    if(retry) {cache.clear();state.activeKey='';routeView();}
  });
  app.addEventListener('error',e=>{
    if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-player-avatar')) e.target.remove();
    if(e.target instanceof HTMLImageElement && e.target.hasAttribute('data-thumbnail')) {
      const frame = e.target.closest('.thumbnail, .videoarea:not(a)');
      (frame || e.target).remove();
    }
  },true);
  document.addEventListener('click',e=>{
    const anchor=e.target.closest('a[href^="#/"]');
    if (!anchor || e.defaultPrevented || e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    routeTo(anchor.getAttribute('href'));
  });
  window.addEventListener('hashchange',routeView);
  window.addEventListener('resize',fitPlayerResults);
  window.visualViewport?.addEventListener('resize',fitPlayerResults);
  window.visualViewport?.addEventListener('scroll',fitPlayerResults);
  app.addEventListener('focusin',e=>{
    if (e.target.id === 'player-search') requestAnimationFrame(fitPlayerResults);
  });
  async function boot() {
    try {
      const data=await fetchJson(directoryUrl);
      if(!Array.isArray(data.players)) throw new Error('Invalid player directory');
      state.directory=data.players.filter(p=>validId(p.id) && validId(p.folder) && typeof p.name==='string').sort((a,b)=>a.name.localeCompare(b.name, undefined, {sensitivity:'base'}));
      routeView();
      await Promise.allSettled(state.directory.map(async player => {
        const profile = await fetchJson(`players/${player.folder}/profile.json`);
        player.games = [...new Set(profile.lists.map(entry => listGame(entry)))];
        for (const entry of profile.lists) {
          if (/^game-[a-z0-9-]{1,70}$/.test(entry.game || '') && typeof entry.gameTitle === 'string') games[entry.game] = entry.gameTitle;
        }
      }));
      if (state.route?.type === 'home') {
        const filters = document.querySelector('.game-filters');
        if (filters) filters.innerHTML = Object.entries(games).sort((a,b)=>a[1].localeCompare(b[1], 'en', {sensitivity:'base'})).map(([id,name])=>`<button type="button" data-game-filter="${esc(id)}" aria-pressed="${state.game === id}">${esc(name)}</button>`).join('');
        refreshResults();
      }
    } catch(e) {
      state.route={type:'home'};
      state.activeProfile=null;
      showError('Player directory unavailable',`${e.message}. Run this site through a local web server or GitHub Pages.`);
    }
  }
  setTheme(state.theme);
  boot();
})();








