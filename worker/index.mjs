const files = {
  blathers: ['geometry-dash'],
  disastrum: ['geometry-dash', 'fnaf-challenges'],
  kayceenoelle: ['celeste', 'beat-saber', 'geometry-dash']
};
const github = 'https://api.github.com/repos/thedjjdk/playerdatabase/contents/';
const encoder = new TextEncoder();
const youtubeId = /^[\w-]{11}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedDifficulties = new Set(['extreme-demon', 'insane-demon']);

function statsFromDescription(description) {
  const attempts = description.match(/^\s*Attempts\s*:\s*(~?\s*[\d,]+)|^\s*(~?\s*[\d,]+)\s+attempts\b/im);
  const enjoyment = description.match(/^\s*Enjoyment\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*(100|10)\b/im);
  const worst = description.match(/^\s*Worst\s+Fail\s*:\s*(\d+(?:\.\d+)?)\s*%/im);
  const completed = description.match(/^\s*(?:Date completed|Completed(?: on)?|Completion date)\s*:\s*(\d{4}-\d{2}-\d{2})\b/im);
  const time = description.match(/^\s*Time taken\s*:[ \t]*([^\r\n]+)/im);
  const result = {};
  if (attempts) result.attempts = (attempts[1] || attempts[2]).replace(/\s/g, '');
  if (enjoyment && +enjoyment[1] <= +enjoyment[2]) result.enjoyment = +enjoyment[1] * 10 / +enjoyment[2];
  if (worst && +worst[1] <= 100) result.worstFail = +worst[1];
  if (completed && validDate(completed[1])) result.completionDate = completed[1];
  if (time) result.timeTaken = time[1].trim().slice(0, 100);
  return result;
}

function validDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

function validVideo(value) {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be', 'www.twitch.tv', 'twitch.tv', 'clips.twitch.tv'].includes(url.hostname);
  } catch { return false; }
}

function normalizeLevels(rows, original) {
  if (!Array.isArray(rows) || rows.length > 400) throw new Error('The list must contain at most 400 entries.');
  const used = new Set();
  const normalized = rows.map((row, i) => {
    if (!row || typeof row !== 'object' || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 160) throw new Error('Every entry needs a name of at most 160 characters.');
    if (row.originalRank != null && (!Number.isInteger(row.originalRank) || !original.has(row.originalRank) || used.has(row.originalRank))) throw new Error('Invalid or repeated existing entry.');
    const existing = original.get(row.originalRank);
    if (existing) used.add(row.originalRank);
    const rank = i + 1;
    const entry = { ...existing, rank, name: row.name.trim() };
    for (const [field, limit] of [['attempts', 80], ['timeTaken', 100]]) {
      if (row[field] === existing?.[field]) continue;
      if (row[field] == null || row[field] === '') delete entry[field];
      else if (typeof row[field] !== 'string' || row[field].length > limit) throw new Error('Invalid ' + field + '.');
      else entry[field] = row[field].trim();
    }
    for (const [field, maximum] of [['enjoyment', 10], ['worstFail', 100]]) {
      if (row[field] === existing?.[field]) continue;
      if (row[field] == null || row[field] === '') delete entry[field];
      else if (!Number.isFinite(row[field]) || row[field] < 0 || row[field] > maximum) throw new Error('Invalid ' + field + '.');
      else entry[field] = row[field];
    }
    for (const field of ['completionDate', 'videoPublishedDate']) {
      if (!row[field]) delete entry[field];
      else if (!validDate(row[field])) throw new Error('Invalid ' + field + '.');
      else entry[field] = row[field];
    }
    if (entry.completionDate) entry.completionYear = +entry.completionDate.slice(0, 4);
    else if (existing?.completionDate) delete entry.completionYear;
    if (row.videoUrl && !validVideo(row.videoUrl)) throw new Error('Use a valid YouTube or Twitch video link.');
    if (row.videoUrl !== existing?.videoUrl) {
      delete entry.thumbnail;
      delete entry.videoTitle;
    }
    if (row.videoUrl) entry.videoUrl = row.videoUrl;
    else if (existing?.videoUrl) delete entry.videoUrl;
    if (row.difficulty && !allowedDifficulties.has(row.difficulty)) throw new Error('Invalid difficulty.');
    if (row.difficulty) entry.difficulty = row.difficulty;
    else if (allowedDifficulties.has(existing?.difficulty)) delete entry.difficulty;
    if (existing && rank !== existing.rank) delete entry.rankLabel;
    return entry;
  });
  if (used.size !== original.size) throw new Error("Existing entries must remain in the list.");
  return normalized;
}

async function authorized(code, expected) {
  if (typeof code !== 'string' || !/^[0-9]{16}$/.test(code) || !/^[a-f0-9]{64}$/.test(expected || '')) return false;
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(code)));
  let difference = 0;
  for (let i = 0; i < bytes.length; i++) difference |= bytes[i] ^ parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  return difference === 0;
}

function toBase64(text) {
  const bytes = encoder.encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = { 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    const reply = (data, status = 200) => Response.json(data, { status, headers });
    if (origin !== env.EDITOR_ORIGIN) return reply({ error: 'Origin not allowed.' }, 403);
    headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') return new Response(null, {
      status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' }
    });
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (env.EDITOR_LIMIT && !(await env.EDITOR_LIMIT.limit({ key: ip })).success) return reply({ error: 'Too many requests. Try again shortly.' }, 429);
    try {
      if (request.method === 'GET' && url.pathname === '/metadata') {
        const id = url.searchParams.get('id') || '';
        if (!youtubeId.test(id)) return reply({ error: 'Enter a valid YouTube link.' }, 400);
        if (!env.YOUTUBE_API_KEY) return reply({ error: 'Video lookup is unavailable. You can enter stats manually.' }, 503);
        const query = new URLSearchParams({ part: 'snippet', id, key: env.YOUTUBE_API_KEY });
        const result = await fetch('https://www.googleapis.com/youtube/v3/videos?' + query);
        if (!result.ok) return reply({ error: 'YouTube lookup failed. You can enter stats manually.' }, 502);
        const snippet = (await result.json()).items?.[0]?.snippet;
        if (!snippet) return reply({ error: 'YouTube did not return details for this video.' }, 404);
        const difficulty = /\bextreme demon\b/i.test(snippet.title) ? 'extreme-demon' : /\binsane demon\b/i.test(snippet.title) ? 'insane-demon' : '';
        return reply({
          name: snippet.title.split(/\s*\((?:Extreme|Insane) Demon\)|\s+100%/i)[0].trim().slice(0, 160),
          videoUrl: 'https://youtu.be/' + id,
          videoPublishedDate: snippet.publishedAt?.slice(0, 10),
          difficulty,
          ...statsFromDescription(snippet.description || '')
        });
      }

      const player = url.searchParams.get('player');
      const list = url.searchParams.get('list');
      if (url.pathname !== '/list' || !Object.hasOwn(files, player) || !files[player].includes(list)) return reply({ error: 'Unknown player or list.' }, 404);
      if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed.' }, 405);
      if (!env.GITHUB_TOKEN || !env.PLAYER_CODE_HASHES) return reply({ error: 'Editor has not been configured.' }, 503);
      let body;
      if (request.method === 'POST') {
        const raw = await request.text();
        if (raw.length > 250000) return reply({ error: 'List is too large.' }, 413);
        try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid request.' }, 400); }
        const hashes = JSON.parse(env.PLAYER_CODE_HASHES);
        const expected = hashes[player];
        if (expected && Object.entries(hashes).some(([owner, hash]) => owner !== player && hash === expected)) {
          return reply({ error: 'Player IDs must be unique across profiles.' }, 503);
        }
        if (!body || !await authorized(body.code, expected)) return reply({ error: 'Incorrect player ID for this profile.' }, 403);
      }
      const path = github + 'players/' + player + '/' + list + '.json';
      const ghHeaders = { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'playerdatabase-editor', 'Content-Type': 'application/json' };
      const current = await fetch(path + '?ref=main', { headers: ghHeaders });
      if (!current.ok) return reply({ error: 'Could not read the list from GitHub.' }, 502);
      const file = await current.json();
      const document = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content), c => c.charCodeAt(0))));
      if (request.method === 'GET') return reply({ document, revision: file.sha });
      if (body.revision !== file.sha) return reply({ error: 'This list changed while you were editing. Reload it before saving again.' }, 409);
      const original = new Map(document.levels.map(entry => [entry.rank, entry]));
      let levels;
      try { levels = normalizeLevels(body.levels, original); } catch (e) { return reply({ error: e.message }, 400); }
      if (JSON.stringify(levels) === JSON.stringify(document.levels)) return reply({ document, revision: file.sha, unchanged: true });
      document.levels = levels;
      const result = await fetch(path, { method: 'PUT', headers: ghHeaders, body: JSON.stringify({
        message: 'Update ' + player + ' ' + list + ' rankings', branch: 'main', sha: file.sha,
        content: toBase64(JSON.stringify(document, null, 2) + '\n')
      }) });
      if (result.status === 409) return reply({ error: 'A concurrent save changed this list. Reload before saving again.' }, 409);
      if (!result.ok) return reply({ error: 'GitHub rejected the save. Your draft is still open.' }, 502);
      const saved = await result.json();
      return reply({ document, revision: saved.content.sha, commit: saved.commit.html_url });
    } catch {
      return reply({ error: 'Editor service unavailable. Try again shortly.' }, 502);
    }
  }
};
