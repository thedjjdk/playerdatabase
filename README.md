# Player Lists — modular static website

Built using the uploaded Layout List `index.html` as the styling reference. The appearance remains centralized in `assets/style.css`; the renderer is `assets/app.js`. The root `index.html` contains no player levels or color picker.

## What works

- Home page: search-only player discovery with keyboard-friendly autocomplete for **Blathers** and **Disastrum**.
- Blathers: **Geometry Dash List** with 82 ranked extreme-demon completions imported from the **Main** tab of his spreadsheet. Search by level name/year, filter by year, sort entries, and open rank detail pages. Attempts, enjoyment, worst fail, completion year, time taken, and sheet source references are preserved when provided.
- Disastrum: separate **Geometry Dash List** and **FNaF Challenge List** tabs, each ready for new entries. No fictional data is populated.
- Appearance: dark/light toggle saved per browser; per-player accent configured in `players.json` (Disastrum red; Blathers neutral for now). Hex color picker intentionally removed.
- Cards with direct YouTube links use YouTube video thumbnails; proof links open externally. Source entries that have only the *title* of a video are labeled as references, **not** presented as verified clickable video URLs. Twitch proof links open in Twitch.
- Only the selected player's profile and selected list JSON load. The browser caches fetched JSON during the session. Works as plain static files on GitHub Pages; no backend or build process.

## Project layout

```text
index.html                      Search page / entrypoint
players.json                    Small player directory
assets/style.css                Shared original styling + new page adaptations
assets/app.js                   Shared renderer and router
players/blathers/profile.json   Player description and available tabs
players/blathers/geometry-dash.json
players/blathers/thumbnails/
players/disastrum/profile.json
players/disastrum/geometry-dash.json
players/disastrum/fnaf-challenges.json
players/disastrum/thumbnails/
scripts/sync_blathers_from_csv.py
```

## Preview locally

From the project directory run:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/` in your browser. **Do not double-click `index.html` directly**: browsers generally block local JSON `fetch` requests using `file://`.

To publish, upload the **contents of this project folder** as the root of a GitHub Pages branch or as a Cloudflare Pages static site. The site uses relative paths, so it also works under a GitHub Pages repository subpath.

## Adding a player

1. Create `players/username/profile.json`, their list JSON files, and optional `thumbnails/`. Use `"thumbnail": "thumbnails/image.png"` for local level artwork.
2. Add `{ "id": "username", "name": "Username", "folder": "username", "accent": "#hexcolor" }` to `players.json`.
3. Change their accent in **`players.json` only**; the shared interface automatically discovers the player's tabs via `profile.json`.

`profile.json` example:

```json
{
  "schemaVersion": 1,
  "id": "username",
  "name": "Username",
  "description": "Personal challenge rankings",
  "lists": [
    {"id": "geometry-dash", "title": "Geometry Dash List", "file": "geometry-dash.json"},
    {"id": "fnaf-challenges", "title": "FNaF Challenge List", "file": "fnaf-challenges.json"}
  ]
}
```

`geometry-dash.json` or `fnaf-challenges.json` example:

```json
{
  "schemaVersion": 1,
  "title": "Geometry Dash List",
  "description": "My personal rankings",
  "levels": [
    {
      "rank": 1,
      "name": "Example challenge",
      "completionYear": 2026,
      "attempts": "1,000",
      "enjoyment": 8.5,
      "worstFail": 92,
      "timeTaken": "3 days",
      "videoUrl": "https://youtu.be/VIDEO_ID"
    }
  ]
}
```

Any unprovided field can be omitted. Only insert real video links; the script intentionally does not invent a YouTube URL from a text-only video title.

## Refreshing Blathers' spreadsheet snapshot

Spreadsheet: https://docs.google.com/spreadsheets/d/1vdxDUkCPygvrdDPuT1qq17umVgLI9Vcmhr65pT5SCVI/edit

Export/download the **Main** tab as CSV, then run:

```sh
python scripts/sync_blathers_from_csv.py /path/to/main-tab.csv
```

The importer uses rows in the ranked table **before the `Total:` marker**, and preserves original star marks / group rank labels / video text as supplied. It rejects missing or duplicate ranks rather than silently rewriting rankings. The provided JSON is a snapshot, **not a live Google Sheets sync**. You can add automation later if you want the public site to update when the spreadsheet changes.

## Important scope notes

- No changes have been made to the original attached HTML, the Google Sheet, or any existing GitHub repository.
- The original Layout List included unrelated Stats Viewer, roulette, packs, submissions, and admin features; they are intentionally excluded from this new player-specific project. The shared visual CSS is retained, but those features' JavaScript and data are not loaded.
- The source sheet includes unranked/in-progress notes outside the 82 numbered entries. Those notes have **not** been inserted as ranked completions. The source's text-only video names are not guaranteed to resolve to links.
