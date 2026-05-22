# RaaS Dev Navigator

A zero-dependency Chrome extension (Manifest V3) that lets you jump straight into
any `raas-b2b-app` route with the right environment, credentials, and query
params already filled in. Internal dev tool — not a production product.

## Features

The popup is a 3-step flow:

1. **Select environment** (Local, Local E2E, Sandbox, Staging, Production).
2. **Select credential** (`reference_id` + `public_token`, filtered to the chosen environment).
3. **Open a path** — click any of the 25 user-facing routes to open it with the
   correct `reference_id` and `public_token` pre-filled.

Also:

- Full generated URL shown on hover (button tooltip) for debugging.
- **Current path** — the first button in step 3. Applies the selected
  credentials to the page you're already on: keeps the current origin + path,
  swaps `reference_id` / `public_token`, and preserves any other query params
  (e.g. `spoof`, `t`).
- **Open in new tab** — a footer checkbox (on by default). When on, route
  buttons (including Current path) open in a new tab; when off, they navigate
  the tab you're on.
- **Keep hostname** — a header checkbox. When on, route buttons use the current
  tab's protocol + host (only changing path and credentials); when off, they use
  the selected environment's base URL.
- Options page for full CRUD of environments, credentials, and defaults.
- Settings persist across browser restarts via `chrome.storage.sync`
  (falls back to `chrome.storage.local`).

## Install (Load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the `raas-dev-navigator/` folder (the one containing `manifest.json`).
5. The extension icon appears in the toolbar. Click it to open the popup.

To pick up code changes, return to `chrome://extensions` and click the
**reload** ↻ icon on the extension card.

## Usage

1. Make sure the app is running locally (`http://localhost:5173`, or `5174` for E2E).
2. Click the extension icon.
3. Step 1 — choose **Environment**. Step 2 — choose **Credential**.
4. Step 3 — click **Current path** to re-apply creds to the page you're on, or
   expand a route group (Onboarding / Profile / Widgets) and click a route.
   It opens in a new tab (or the current tab if "Open in new tab" is unchecked).
   The generated URL looks like:

   ```
   <env base URL>/onboarding/consent?reference_id=<REFERENCE_ID>&public_token=<PUBLIC_TOKEN>
   ```

Your last selections are remembered as the new defaults.

### First-run setup

The extension ships with **no environments or credentials** — these hold
environment URLs and `reference_id` / `public_token` values that intentionally
do not live in source control. On first launch you'll see empty dropdowns and a
prompt to configure them.

**Fastest path — import the shared startup files.** Ping **@lameira** in Slack
for the link to download the startup files (the environments and credentials
JSON). Once you have them, you can import and use the extension right away:

1. Open the **Options** page (⚙ Options link in the popup).
2. In the **Environments** card, click **Import**, select the environments JSON,
   then click **Save changes**.
3. In the **Credential presets** card, click **Import**, select the credentials
   JSON, then click **Save changes**.

That's it — open the popup and you're ready to go.

If you'd rather configure things by hand, you can also **Add** environments and
credentials manually in the Options page.

Settings live in `chrome.storage` per browser profile, so they persist locally
without ever touching the repo.

## Options page

Open via the **⚙ Options** link in the popup, or right-click the toolbar icon →
**Options**. You can:

- Add / edit / remove **environments** (name + base URL).
- **Import / Export** environments as JSON via the buttons in the Environments
  header. Export downloads `raas-environments.json`; import accepts either a bare
  array of environments or a full settings export, and waits for you to click
  **Save changes**. Original environment ids are kept when free (so any
  credential→environment links survive a matched import) and only regenerated on
  collision.
- Add / edit / remove **credentials** (`reference_id` + `public_token`). The
  **name is optional** — leave it blank and the popup will show the
  `reference_id` in the dropdown instead.
- **Duplicate** any credential with the button beside Remove — handy for reusing
  the same token across environments (a copy is inserted right below).
- **Import / Export** credentials as JSON via the buttons in the Credentials
  header. Export downloads `raas-credentials.json`; import accepts either a bare
  array of credentials or a full settings export, appends them with fresh ids,
  and waits for you to click **Save changes**.
- **Link each credential to one environment** via the Environment dropdown.
  The popup only offers credentials linked to the selected environment — so a
  Local-only mock token won't clutter the dropdown when you're pointed at
  Staging. Credentials are single-environment by design; if the same token is
  valid in two environments, just duplicate the credential. Choosing
  "(all environments)" leaves a credential unscoped so it appears everywhere;
  legacy credentials saved before this feature show up as "(all environments)"
  until you scope them.
- Set the **default environment and credential**.
- **Reset to defaults** clears all environments and credentials back to the
  empty shipped state (the UX flags revert too). Export first if you want a
  backup.

Click **Save changes** to persist. Fully-empty rows are dropped on save.

## URL builder rules

- Always includes `reference_id`.
- Always includes `public_token`.
- Preserves any other existing query params when using **Current path**.

## File structure

```
raas-dev-navigator/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── shared/
│   ├── routes.js        # ROUTE_GROUPS
│   ├── storage.js       # load/save settings, defaults, id helper
│   └── url-builder.js   # buildUrl()
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Notes

- Permissions: `storage` and `tabs`. Routes open in a new tab via plain
  `<a target="_blank">` links by default. The `tabs` permission is needed to
  read the URL of the tab you're on (so "Current path" and "Keep hostname" know
  the current origin/path) and to navigate it when "Open in new tab" is off. The
  popup looks up
  the active tab of the last focused normal
  browser window, so it works even when the popup is detached or you're in
  device-emulation mode. (`activeTab` alone is insufficient here because it only
  grants URL access to a single tab in the popup's own window.)
- Vanilla JS, ES modules, no build step. Just load unpacked.
- The "Submit" / internal `/api/*` routes are intentionally excluded from the
  button list per spec.

## Not included (future ideas)

Copy-URL button per route, "reload current tab with selected credentials", and
recent-URL history are scoped as nice-to-haves and not yet implemented.
(JSON import/export of both environments and credentials is now built in — see
the Options page section above.)
