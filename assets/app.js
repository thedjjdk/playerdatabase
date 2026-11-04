/* Player Lists: lightweight shared renderer. No frameworks, no player data in index.html. */
(() => {
  'use strict';
  const app = document.getElementById('app');
  const directoryUrl = 'players.json';
  const cache = new Map();
  const state = {
    directory: [],
    loadError: null,
    theme: readTheme(),
    search: '',
    highlightedResult: 0,
    listSearch: '',
    year: 'all',
    order: 'rank',
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
      return `players/${profile.id}/${item.thumbnail}`;
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
    applyTheme();
    const btn = document.querySelector('[data-theme-toggle]');
    if (btn) {
      btn.innerHTML = state.theme === 'light' ? ICON_SUN : ICON_MOON;
      btn.title = state.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
      btn.setAttribute('aria-label',btn.title);
    }
  }
  const pixelPatterns = new Map();
  function playerPixelPattern(tint) {
    if (!/^#[0-9a-f]{6}$/i.test(tint || '')) return '';
    if (!pixelPatterns.has(tint)) {
      const pattern = getComputedStyle(document.documentElement).getPropertyValue('--laylist-pixel-pattern');
      const encoded = pattern.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
      if (!encoded) return '';
      const rgb = tint.slice(1).match(/../g).map(channel => parseInt(channel, 16));
      const svg = atob(encoded).replace(/fill="#([0-9a-f]{2})\1\1"/gi, (_, gray) => {
        // Match Layout List: the #4e4e4e tile receives the exact tint.
        const shade = parseInt(gray, 16) / 0x4e;
        return 'fill="#' + rgb.map(channel => Math.min(255, Math.round(channel * shade)).toString(16).padStart(2, '0')).join('') + '"';
      });
      pixelPatterns.set(tint, `url(data:image/svg+xml;base64,${btoa(svg)})`);
    }
    return pixelPatterns.get(tint);
  }
  function applyTheme(accent) {
    document.body.classList.toggle('light-mode',state.theme === 'light');
    const color = checkedColor(accent || (state.activeProfile?.accent || '#aeb4bc'));
    // Inline properties override the base stylesheet's light-mode fallback.
    document.body.style.setProperty('--player-pixel-pattern',playerPixelPattern(state.activeProfile?.backgroundTint));
    document.body.style.setProperty('--accent',color);
    document.body.style.setProperty('--accent-strong',color);
    document.body.style.setProperty('--accent-button',color);
    document.body.style.setProperty('--accent-button-hover',`color-mix(in srgb, ${color} 82%, white)`);
    document.documentElement.style.colorScheme = state.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',state.theme === 'light' ? '#fff' : '#1b1e22');
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
      cache.set(path, fetch(path, path === directoryUrl ? {cache: 'no-cache'} : undefined).then(r => {
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
      <nav class="navlinks" aria-label="Main navigation"><a class="${isHome?'active':''}" href="#/">Players</a></nav>
      <div class="appearance-tools theme-only"><button type="button" class="appearance-button" data-theme-toggle title="${state.theme==='light'?'Switch to dark mode':'Switch to light mode'}" aria-label="${state.theme==='light'?'Switch to dark mode':'Switch to light mode'}">${state.theme==='light'?ICON_SUN:ICON_MOON}</button></div>
      <div class="mobilehead-tools"><button type="button" class="mobileicon ${state.menuOpen?'is-open':''}" data-menu-toggle aria-label="${state.menuOpen?'Close':'Open'} navigation" aria-controls="site-menu" aria-expanded="${state.menuOpen}"><span class="menu-bars" aria-hidden="true"><i></i><i></i><i></i></span></button></div>
    </div><div id="site-menu" class="mobile-menu ${state.menuOpen?'open':''}" role="navigation" aria-label="Mobile navigation" aria-hidden="${!state.menuOpen}" ${state.menuOpen?'':'inert'}><div class="mobile-menu-inner"><a href="#/">Search players</a>${state.route?.type==='player'?`<a href="${esc(playerRoute(state.route.player.id))}">${esc(state.route.player.name)}'s lists</a>`:''}</div></div></header>`;
  }
  function footer() {
    return `<footer class="container player-foot"><span>Player Lists · Built from the supplied Layout List design</span><a href="#/">Search players</a></footer>`;
  }
  function shell(body) {app.innerHTML = `${header()}${body}${footer()}`; applyTheme();}
  function showError(title, detail) {
    shell(`<main class="container"><section class="singlepanel player-route-error"><h2>${esc(title)}</h2><p class="data-note">${esc(detail)}</p><button type="button" class="ghostbutton" data-retry>Try again</button><div class="buttonrow"><a class="inline-back" href="#/">← Back to player search</a></div></section></main>`);
  }
  function resultMarkup(players) {
    if (!players.length) return `<div class="player-empty">No matching players.</div>`;
    return players.map((p,i)=>`<a class="player-result ${i===state.highlightedResult?'is-highlighted':''}" href="${esc(playerRoute(p.id))}" role="option" aria-selected="${i===state.highlightedResult}" id="player-option-${i}"><span class="player-avatar-small" style="--accent:${checkedColor(p.accent)}">${esc(p.name.slice(0,1).toUpperCase())}</span><span><span class="result-name">${esc(p.name)}</span><span class="result-meta">Open personal lists</span></span><span class="result-arrow" aria-hidden="true">›</span></a>`).join('');
  }
  function matchingPlayers() {
    const query = state.search.trim().toLocaleLowerCase();
    return query ? state.directory.filter(p=>p.name.toLocaleLowerCase().includes(query)) : [];
  }
  function refreshResults() {
    const results = document.getElementById('player-results');
    const input = document.getElementById('player-search');
    if (!results || !input) return;
    const matches = matchingPlayers();
    state.highlightedResult = Math.max(0, Math.min(state.highlightedResult, matches.length - 1));
    results.hidden = !state.search.trim();
    results.innerHTML = state.search.trim() ? resultMarkup(matches) : '';
    input.setAttribute('aria-expanded',String(!results.hidden));
    input.setAttribute('aria-activedescendant',matches.length && !results.hidden ? `player-option-${state.highlightedResult}` : '');
  }
  function homeView() {
    state.activeProfile = null;
    state.activeList = null;
    shell(`<main class="container home-main"><section class="home-focus" aria-label="Player search">
      <div class="home-kicker">PLAYER DIRECTORY</div><h1>Find a player</h1>
      <div class="player-search-wrap"><div class="player-search-box">${ICON_SEARCH}<input type="search" id="player-search" placeholder="Search for a player..." autocomplete="off" aria-label="Search players" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="player-results" value="${esc(state.search)}"></div>
      <div class="player-results" id="player-results" role="listbox" hidden></div></div>
      <p class="home-helper">Search by player name to view their personal lists.</p></section></main>`);
    refreshResults();
    applyTheme('#aeb4bc');
  }
  function tabsMarkup(pid, profile, active) {
    return `<div class="wide-tabs" role="tablist" aria-label="Player lists">${profile.lists.map(entry=>`<button type="button" role="tab" aria-selected="${entry.id===active}" data-player-tab="${esc(entry.id)}" data-player-id="${esc(pid)}">${esc(entry.title)}</button>`).join('')}</div>`;
  }
  function playerIntro(profile) {
    return `<div class="pageintro"><a href="#/" class="inline-back">‹ Back to players</a><div class="player-title-wrap" style="margin-top:13px"><div class="player-avatar-small">${esc(profile.name[0]||'?')}</div><div><h1>${esc(profile.name)}</h1><p class="player-subheading">${esc(profile.description||'Personal ranked lists')}</p></div></div></div>`;
  }
  function sidebar(profile, doc) {
    const src = safeLink(doc.sourceUrl);
    return `<aside class="sidebar"><section class="panel"><h2>About this list</h2><p>${esc(doc.description||'Personal challenge rankings.')}</p>${src?`<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">View original spreadsheet ↗</a>`:''}</section><section class="panel"><h2>List Statistics</h2><div class="bulletrows"><div><span>Ranked entries</span><strong>${(doc.levels||[]).length.toLocaleString()}</strong></div><div><span>Player</span><strong>${esc(profile.name)}</strong></div></div></section>${profile.lists.length>1?`<section class="panel"><h2>Other Lists</h2><div class="tierlinks">${profile.lists.map(list=>`<a class="tierchip" href="${esc(playerRoute(profile.id,list.id))}">${esc(list.title)}</a>`).join('')}</div></section>`:''}</aside>`;
  }
  function levelVideo(item) { return safeLink(item.videoUrl); }
  function renderCard(profile, listId, item, index) {
    const rank = Number.isInteger(item.rank) ? item.rank : index+1;
    const link = playerRoute(profile.id, listId, rank);
    const video = levelVideo(item);
    const thumbnail = thumbnailFor(item,profile);
    const name = item.name || `Entry ${rank}`;
    return `<article class="listcard">
      <a class="card-stretched" href="${esc(link)}" aria-label="View ${esc(name)} details"></a>
      ${thumbnail ? (video
        ? `<a class="thumbnail has-video" href="${esc(video)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${esc(name)}"><img src="${esc(thumbnail)}" loading="lazy" alt="" data-thumbnail></a>`
        : `<span class="thumbnail"><img src="${esc(thumbnail)}" loading="lazy" alt="${esc(name)} thumbnail" data-thumbnail></span>`) : ''}
      <div class="listcardmeta"><h2><span class="hash">#${rank}</span> ${esc(name)}</h2>
      <p class="creator">${item.completionYear ? `Completed in <strong>${esc(item.completionYear)}</strong>` : 'Challenge entry'}</p>
      <p class="tiernote">${item.enjoyment != null ? `Enjoyment: ${esc(item.enjoyment)}/10` : 'Personal ranking'}${item.attempts ? ` · ${esc(item.attempts)} attempts` : ''}${item.worstFail != null ? ` · ${esc(item.worstFail)}% worst fail` : ''}</p></div></article>`;
  }
  function filteredLevels() {
    const items = Array.isArray(state.activeList?.levels) ? [...state.activeList.levels] : [];
    const q = state.listSearch.trim().toLocaleLowerCase();
    let list = items.filter(v => {
      if (state.year!=='all' && String(v.completionYear||'')!==state.year) return false;
      return !q || [v.name,v.completionYear,v.videoTitle].some(x=>String(x||'').toLocaleLowerCase().includes(q));
    });
    if (state.order === 'reverse') list.reverse();
    else if (state.order === 'name') list.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    else if (state.order === 'year') list.sort((a,b)=>(Number(b.completionYear)||0)-(Number(a.completionYear)||0) || (Number(a.rank)||0)-(Number(b.rank)||0));
    return list;
  }
  function updateCardList() {
    const listEl = document.getElementById('level-list');
    const countEl = document.getElementById('result-count');
    if (!listEl || !state.activeProfile || !state.route) return;
    const items = filteredLevels();
    const total = state.activeList.levels.length;
    if (countEl) countEl.textContent = `${items.length} of ${total} ranked ${total === 1 ? 'entry' : 'entries'}`;
    if (!total) {
      listEl.innerHTML = `<div class="empty list-empty"><strong>No levels added yet</strong><span>${esc(state.activeList.description||'This list is ready for entries.')}</span></div>`;
    } else if (!items.length) {
      listEl.innerHTML = `<div class="empty list-empty"><strong>No matching levels</strong><span>Change the search or completion-year filter.</span></div>`;
    } else {
      listEl.innerHTML = items.map((x,i)=>renderCard(state.activeProfile,state.route.listId,x,i)).join('');
    }
  }
  function listView(profile, entry, doc) {
    const years = [...new Set(doc.levels.map(x=>x.completionYear).filter(Boolean))].sort((a,b)=>b-a);
    const content = `<p class="list-description-inline">${esc(doc.description||'Personal ranked list.')}</p>
      <div class="list-toolbar"><div class="list-filter-area">
      <input class="filter" type="search" id="level-search" aria-label="Search levels" placeholder="Search levels..." value="${esc(state.listSearch)}" autocomplete="off">
      <select class="select" id="year-filter" aria-label="Filter by completion year"><option value="all">All years</option>${years.map(year=>`<option value="${year}" ${state.year===String(year)?'selected':''}>${year}</option>`).join('')}</select>
      <select class="select" id="sort-order" aria-label="Sort levels"><option value="rank" ${state.order==='rank'?'selected':''}>Rank: hardest first</option><option value="reverse" ${state.order==='reverse'?'selected':''}>Rank: easiest first</option><option value="name" ${state.order==='name'?'selected':''}>Level name</option>${years.length?`<option value="year" ${state.order==='year'?'selected':''}>Newest first</option>`:''}</select></div></div>
      <div class="count-line" id="result-count"></div><div class="listcards" id="level-list"></div>`;
    shell(`<main class="container">${playerIntro(profile)}${tabsMarkup(profile.id,profile,entry.id)}<div class="layout"><div class="content">${content}</div>${sidebar(profile,doc)}</div></main>`);
    updateCardList();
  }
  function detailVideo(item) {
    const video = levelVideo(item);
    const thumb = thumbnailFor(item,state.activeProfile);
    if (video && thumb) return `<a class="videoarea detail-video-link" target="_blank" rel="noopener noreferrer" href="${esc(video)}" title="Watch the original video"><img data-thumbnail src="${esc(thumb)}" alt="${esc(item.name)} thumbnail"><span class="videoempty">Open source video ↗</span></a>`;
    if (thumb) return `<div class="videoarea"><img data-thumbnail src="${esc(thumb)}" alt="${esc(item.name)} thumbnail"></div>`;
    if (video) return `<div class="video-area-empty"><a href="${esc(video)}" target="_blank" rel="noopener noreferrer">Open source video ↗</a></div>`;
    return `<div class="video-area-empty">No direct video link was provided for this entry.</div>`;
  }
  function detailView(profile, entry, doc, rank) {
    const levels = doc.levels;
    const index = levels.findIndex(x => x.rank === rank);
    if (index < 0) {showError('Level not found', `No level with rank #${rank} exists in this list.`);return;}
    const item = levels[index];
    const prev = levels[index-1];
    const next = levels[index+1];
    const source = safeLink(doc.sourceUrl);
    const proof = levelVideo(item);
    const attr = (key, fallback='Not provided') => item[key] != null && item[key] !== '' ? esc(item[key]) : fallback;
    const facts = [
      [ `#${esc(item.rank)}`, 'LIST RANK' ],
      [ attr('completionYear'), 'COMPLETION YEAR' ],
      [ attr('attempts'), 'ATTEMPTS' ],
      [ item.worstFail != null ? `${esc(item.worstFail)}%` : 'Not provided', 'WORST FAIL' ]
    ];
    const body = `<div class="backrow"><a href="${esc(playerRoute(profile.id,entry.id))}" class="backbutton">‹ Back to list</a><div class="prevnext">
      <button type="button" ${prev?'':'disabled'} data-rank-nav="${prev?prev.rank:''}">‹ Previous</button><button type="button" ${next?'':'disabled'} data-rank-nav="${next?next.rank:''}">Next ›</button></div></div>
      <section class="singlepanel"><div class="detailheading"><h1>#${esc(item.rank)} – ${esc(item.name)}</h1><p>${esc(doc.title||entry.title)} · ${esc(profile.name)}</p></div>
      ${detailVideo(item)}
      <div class="facts detail-grid">${facts.map(([value,label])=>`<div class="fact"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
      <p class="statline"><strong>Enjoyment rating:</strong> ${item.enjoyment == null ? 'Not provided' : `${esc(item.enjoyment)}/10`}</p>
      <p class="statline"><strong>Time taken:</strong> ${attr('timeTaken')}</p>
      ${item.videoTitle ? `<p class="statline"><strong>Video reference in the spreadsheet:</strong> ${esc(item.videoTitle)}</p>` : ''}
      ${item.rankLabel && item.rankLabel !== String(item.rank) ? `<p class="statline"><strong>Original ranking label:</strong> ${esc(item.rankLabel)}</p>` : ''}
      ${item.name.includes('*') ? `<p class="statline"><strong>Source notation:</strong> Asterisk(s) are retained as written in the source spreadsheet.</p>` : ''}
      ${proof ? `<p class="statline"><a href="${esc(proof)}" target="_blank" rel="noopener noreferrer">Watch source video ↗</a></p>` : ''}
      ${source ? `<p class="statline"><a href="${esc(source)}" target="_blank" rel="noopener noreferrer">View original spreadsheet${item.sourceRow?` (row ${esc(item.sourceRow)})`:''} ↗</a></p>` : ''}
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
      shell(`<main class="container"><div class="pageintro"><h1>${esc(player.name)}</h1></div><div class="singlepanel">Loading player data…</div></main>`);
      const profile = await fetchJson(`players/${folder}/profile.json`);
      if (seq !== state.request) return;
      if (!profile || profile.id !== player.id || !Array.isArray(profile.lists)) throw new Error('Player profile is invalid.');
      state.activeProfile = {...profile, accent: checkedColor(player.accent), backgroundTint: player.backgroundTint};
      applyTheme(player.accent);
      let entry = profile.lists.find(x=>x.id===state.route.listId);
      if (!entry) entry = profile.lists[0];
      if (!entry || !validId(entry.id) || !validJsonName(entry.file)) throw new Error('No valid lists are configured for this player.');
      if (entry.id !== state.route.listId) {
        const destination=playerRoute(player.id,entry.id);
        // Resolve the default tab without a full page reload.
        history.replaceState(null, '', destination);
        routeView();
        return;
      }
      const key = `${folder}/${entry.file}`;
      if (state.activeKey !== key) {
        state.listSearch='';state.year='all';state.order='rank';state.activeKey=key;
      }
      const data = await fetchJson(`players/${key}`);
      if (seq !== state.request) return;
      if (!data || !Array.isArray(data.levels)) throw new Error('The list data is invalid.');
      state.activeList = data;
      if (state.route.rank != null) detailView(profile,entry,data,state.route.rank);
      else listView(profile,entry,data);
    } catch (err) {
      if (seq !== state.request) return;
      showError('Unable to load player data',`${err.message}. Check that the player JSON files are present and that the site is being served over HTTP (not file://).`);
    }
  }
  function routeTo(href) {
    state.menuOpen=false;
    if (location.hash===href) {routeView();return;}
    location.hash=href;
  }
  function syncSearch(e) {
    state.search=e.target.value;
    state.highlightedResult=0;
    refreshResults();
  }
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
    } else if (e.key==='Enter' && matches.length) {
      e.preventDefault();routeTo(playerRoute(matches[state.highlightedResult].id));
    } else if (e.key==='Escape') {
      state.search='';e.target.value='';refreshResults();
    }
  });
  app.addEventListener('click',e=>{
    const theme=e.target.closest('[data-theme-toggle]');
    if (theme) {setTheme(state.theme==='dark'?'light':'dark');return;}
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
    if(e.target instanceof HTMLImageElement && e.target.hasAttribute('data-thumbnail')) {
      const frame = e.target.closest('.thumbnail, .videoarea:not(a)');
      (frame || e.target).remove();
    }
  },true);
  document.addEventListener('click',e=>{
    const anchor=e.target.closest('a[href^="#/"]');
    if(anchor && location.hash===anchor.getAttribute('href')) routeView();
  });
  window.addEventListener('hashchange',routeView);
  async function boot() {
    try {
      const data=await fetchJson(directoryUrl);
      if(!Array.isArray(data.players)) throw new Error('Invalid player directory');
      state.directory=data.players.filter(p=>validId(p.id) && validId(p.folder) && typeof p.name==='string');
      routeView();
    } catch(e) {
      state.route={type:'home'};
      state.activeProfile=null;
      showError('Player directory unavailable',`${e.message}. Run this site through a local web server or GitHub Pages.`);
    }
  }
  setTheme(state.theme);
  boot();
})();
