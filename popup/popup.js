import { ROUTE_GROUPS } from "../shared/routes.js";
import { buildUrl } from "../shared/url-builder.js";
import {
  loadSettings,
  saveSettings,
  credentialRelatesToEnv,
  credentialLabel
} from "../shared/storage.js";

let settings = null;
let currentTab = null; // { id, url } of the active tab, if readable
const ui = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  ui.env = document.getElementById("env-select");
  ui.cred = document.getElementById("cred-select");
  ui.newTab = document.getElementById("open-new-tab");
  ui.keepHost = document.getElementById("keep-host");
  ui.currentPath = document.getElementById("current-path");
  ui.warning = document.getElementById("warning");
  ui.groups = document.getElementById("route-groups");
  ui.optionsBtn = document.getElementById("open-options");

  settings = await loadSettings();
  currentTab = await queryActiveTab();

  populateSelectors();
  renderRouteGroups();
  bindEvents();
  refresh();
}

// A tab whose URL we can actually navigate to and read. We deliberately do NOT
// validate the protocol (http vs https) — a local http:// dev server is valid
// even when the selected env is https. We only exclude browser-internal and
// extension pages, which can never be a real app target.
function isUsableUrl(url) {
  if (typeof url !== "string" || !url) return false;
  return !/^(chrome|chrome-extension|about|edge|devtools|view-source|moz-extension):/i.test(url);
}

function pickTab(t) {
  return t ? { id: t.id, url: t.url || "" } : null;
}

// Find the browser tab the user is actually looking at. The popup may live in
// its own window (detached popup, device-mode window, etc.), so the active tab
// of "currentWindow" can be the extension page itself. We therefore prefer the
// active tab of the last focused NORMAL browser window, and fall back to any
// active usable tab across normal windows. Reading tab URLs requires the
// "tabs" permission.
function queryActiveTab() {
  const query = (opts) =>
    new Promise((resolve) => {
      try {
        chrome.tabs.query(opts, (tabs) => {
          if (chrome.runtime && chrome.runtime.lastError) return resolve([]);
          resolve(tabs || []);
        });
      } catch (e) {
        resolve([]);
      }
    });

  return (async () => {
    // 1) Active tab of the last focused normal window.
    let tabs = await query({ active: true, lastFocusedWindow: true, windowType: "normal" });
    let t = tabs[0];
    if (t && isUsableUrl(t.url)) return pickTab(t);

    // 2) Any active tab in a normal window that is a real (non-internal) page.
    const all = await query({ active: true, windowType: "normal" });
    const usable = all.find((x) => isUsableUrl(x.url));
    if (usable) return pickTab(usable);

    // 3) Last resort: whatever the last focused normal window's active tab was.
    return pickTab(t || all[0] || null);
  })();
}

// Origin (protocol + host + port) of the current tab. No protocol validation —
// any real (non-internal) page counts, including local http:// dev servers.
function currentOrigin() {
  if (!isUsableUrl(currentTab && currentTab.url)) return "";
  try {
    return new URL(currentTab.url).origin;
  } catch (e) {
    return "";
  }
}

// Pathname of the current tab (any real, non-internal page).
function currentPath() {
  if (!isUsableUrl(currentTab && currentTab.url)) return "";
  try {
    return new URL(currentTab.url).pathname;
  } catch (e) {
    return "";
  }
}

// Navigate to a URL, honoring the "open in new tab" checkbox. When unchecked,
// we navigate the tab the user is on (falling back to a new tab if we can't
// resolve it).
function go(url) {
  const wantNewTab = ui.newTab.checked || !(currentTab && currentTab.id != null);
  if (wantNewTab) {
    window.open(url, "_blank");
  } else {
    chrome.tabs.update(currentTab.id, { url });
    window.close();
  }
}

function populateSelectors() {
  // Environments
  ui.env.innerHTML = "";
  settings.environments.forEach((env) => {
    const opt = document.createElement("option");
    opt.value = env.id;
    opt.textContent = env.baseUrl ? env.name : `${env.name} (not configured)`;
    ui.env.appendChild(opt);
  });
  ui.env.value = pickDefault(settings.environments, settings.defaults.environmentId);

  // Credentials (filtered to the selected environment)
  populateCredentials();

  // Navigation options (openInNewTab defaults to true when unset)
  ui.newTab.checked = settings.defaults.openInNewTab !== false;
  ui.keepHost.checked = !!settings.defaults.keepHostname;
}

// Return the configured default id if it still exists, else the first item's id.
function pickDefault(list, preferredId) {
  if (list.some((item) => item.id === preferredId)) return preferredId;
  return list.length ? list[0].id : "";
}

// Credentials available for the currently-selected environment.
function credentialsForEnv() {
  return settings.credentials.filter((c) => credentialRelatesToEnv(c, ui.env.value));
}

// (Re)build the credential dropdown using only credentials linked to the
// selected environment. Preserves the current selection when still valid,
// otherwise falls back to the saved default, then the first available item.
function populateCredentials() {
  const list = credentialsForEnv();
  const previous = ui.cred.value;
  ui.cred.innerHTML = "";

  if (list.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "— no credentials for this environment —";
    opt.disabled = true;
    ui.cred.appendChild(opt);
    ui.cred.value = "";
    return;
  }

  list.forEach((cred) => {
    const opt = document.createElement("option");
    opt.value = cred.id;
    opt.textContent = credentialLabel(cred);
    ui.cred.appendChild(opt);
  });

  if (list.some((c) => c.id === previous)) {
    ui.cred.value = previous;
  } else if (list.some((c) => c.id === settings.defaults.credentialId)) {
    ui.cred.value = settings.defaults.credentialId;
  } else {
    ui.cred.value = list[0].id;
  }
}

function renderRouteGroups() {
  ui.groups.innerHTML = "";
  ROUTE_GROUPS.forEach((group) => {
    const section = document.createElement("section");
    section.className = "route-group";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "group-header";
    header.innerHTML = `<span class="chevron">▾</span><span>${group.name}</span>`;
    header.addEventListener("click", () => section.classList.toggle("collapsed"));

    const body = document.createElement("div");
    body.className = "group-body";

    group.routes.forEach((route) => {
      const a = document.createElement("a");
      a.className = "route-btn";
      a.textContent = route.label;
      a.dataset.path = route.path;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.addEventListener("click", (e) => {
        // Route all navigation through go() so the "open in new tab" checkbox
        // governs new-tab vs current-tab uniformly.
        e.preventDefault();
        if (a.getAttribute("href")) go(a.href);
      });
      body.appendChild(a);
    });

    section.appendChild(header);
    section.appendChild(body);
    ui.groups.appendChild(section);
  });
}

function bindEvents() {
  // Persist selection changes as the new defaults so the popup remembers them.
  // Changing the environment also re-filters the credential dropdown.
  ui.env.addEventListener("change", () => {
    populateCredentials();
    onSelectionChange();
  });
  ui.cred.addEventListener("change", onSelectionChange);
  ui.newTab.addEventListener("change", onSelectionChange);
  // Keep hostname changes which origin route buttons use, so re-render on toggle.
  ui.keepHost.addEventListener("change", onSelectionChange);

  // "Current path": apply the selected credentials to the page you're on,
  // keeping its origin + path and preserving other query params.
  ui.currentPath.addEventListener("click", (e) => {
    e.preventDefault();
    if (ui.currentPath.classList.contains("disabled") || !ui.currentPath.getAttribute("href")) {
      return;
    }
    go(ui.currentPath.href);
  });

  ui.optionsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/options.html"));
    }
  });
}

async function onSelectionChange() {
  settings.defaults = Object.assign({}, settings.defaults, {
    environmentId: ui.env.value,
    credentialId: ui.cred.value,
    openInNewTab: ui.newTab.checked,
    keepHostname: ui.keepHost.checked
  });
  try {
    await saveSettings(settings);
  } catch (e) {
    // Non-fatal: selection still works for this session.
    console.warn("Could not persist defaults:", e);
  }
  refresh();
}

// Recompute every button's href and tooltip based on current selections.
function refresh() {
  const env = settings.environments.find((e) => e.id === ui.env.value);
  const cred = settings.credentials.find((c) => c.id === ui.cred.value);
  const keepHost = ui.keepHost.checked;
  const tabOrigin = currentOrigin();

  // With "Keep hostname" on, route buttons use the current tab's protocol +
  // host (strictly — never the env base URL). Otherwise use the selected
  // environment's base URL.
  const origin = keepHost ? tabOrigin : env ? env.baseUrl : "";

  const problems = [];
  if (keepHost && !tabOrigin) {
    problems.push(
      "Keep hostname is on but the current tab is a browser or extension page — switch to the app tab first."
    );
  } else if (!origin) {
    problems.push("Selected environment has no base URL — set one in Options.");
  }
  if (!cred) {
    problems.push("No credentials are linked to this environment — link one in Options.");
  } else if (!cred.reference_id) {
    problems.push("Selected credential is missing a reference_id.");
  } else if (!cred.public_token) {
    problems.push("Selected credential has no public_token.");
  }

  const credOk = !!cred && !!cred.reference_id;
  const routesDisabled = !origin || !credOk;

  ui.warning.hidden = problems.length === 0;
  ui.warning.textContent = problems.join(" ");

  // Route group buttons → selected environment origin + route path.
  ui.groups.querySelectorAll(".route-btn").forEach((btn) => {
    const path = btn.dataset.path;
    if (routesDisabled) {
      btn.classList.add("disabled");
      btn.removeAttribute("href");
      btn.title = problems.join(" ");
      return;
    }
    btn.classList.remove("disabled");
    btn.href = safeBuild({ baseUrl: origin, path, cred });
    btn.title = btn.href; // full URL on hover for debugging
  });

  refreshCurrentPathButton(cred);
}

// "Current path" button → current tab origin + current tab path + creds,
// preserving any other existing query params (e.g. spoof, t).
function refreshCurrentPathButton(cred) {
  const tabOrigin = currentOrigin();
  const path = currentPath();
  const credOk = !!cred && !!cred.reference_id;
  const canApply = !!tabOrigin && !!path && credOk;

  if (!canApply) {
    ui.currentPath.classList.add("disabled");
    ui.currentPath.removeAttribute("href");
    ui.currentPath.textContent = "Current path";
    ui.currentPath.title = !tabOrigin || !path
      ? "Open an app tab to apply credentials to its current path"
      : "Select a valid credential first";
    return;
  }

  // Preserve existing query params except the ones we manage.
  const managed = new Set(["reference_id", "public_token"]);
  const extraParams = {};
  try {
    new URL(currentTab.url).searchParams.forEach((value, key) => {
      if (!managed.has(key)) extraParams[key] = value;
    });
  } catch (e) {
    /* no extra params */
  }

  const url = safeBuild({ baseUrl: tabOrigin, path, cred, extraParams });
  ui.currentPath.classList.remove("disabled");
  ui.currentPath.href = url;
  ui.currentPath.textContent = "Current path (" + path + ")";
  ui.currentPath.title = url;
}

function safeBuild({ baseUrl, path, cred, extraParams }) {
  try {
    return buildUrl({
      baseUrl,
      path,
      reference_id: cred.reference_id,
      public_token: cred.public_token || "",
      extraParams
    });
  } catch (e) {
    return "";
  }
}
