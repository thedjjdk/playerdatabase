# Enable Player Database edits

The public site can stay on GitHub Pages. The Cloudflare Worker verifies private player IDs and writes the selected list to GitHub. Each list file is saved against the revision the editor loaded, so a stale draft cannot overwrite a newer save.

1. Create a fine-grained GitHub token restricted to `thedjjdk/playerdatabase` with **Contents: Read and write**. Use an account that can push to `main`. Keep the token in the Worker only.
2. Create or select a Google Cloud API key with **YouTube Data API v3** enabled for the optional autofill. The Worker reads public video descriptions and posting dates. Attempts, enjoyment, worst fail, completion date, and time are only populated if recognized in the description. Use `Date completed: YYYY-MM-DD` for exact completion dates. Users can edit or add fields manually.
3. From the repository's `worker` directory, log in with `npx wrangler login` and run `npx wrangler deploy`. Set the Worker secrets:

   ```sh
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put YOUTUBE_API_KEY
   python3 hash-codes.py | npx wrangler secret put PLAYER_CODE_HASHES
   ```

   For the last command, enter the two player IDs when prompted. The Worker stores their SHA-256 hashes. Keep the actual IDs out of GitHub, Cloudflare source code, and screenshots. To rotate an ID, issue a new random 16-digit numeric code and replace its hash while retaining the other player's hash.

4. Set `editorApi` in `editor/config.js` to the HTTPS Worker origin, with no trailing slash, and commit it. The Worker is configured for `https://thedjjdk.github.io`. If the frontend moves hosts, update `EDITOR_ORIGIN` in `wrangler.toml` and redeploy.
5. Confirm the right player ID can save that player's test draft, the other player's ID is rejected, and the resulting GitHub Pages build publishes the new ordering.

Before step 4, Edit opens in draft preview mode. It supports manual additions and reordering while save and YouTube autofill are unavailable.
