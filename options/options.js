import {
  loadSettings,
  saveSettings,
  makeId,
  DEFAULT_SETTINGS,
  credentialLabel
} from "../shared/storage.js";

// Working copy of settings, mutated in-memory until the user clicks Save.
let working = null;
const el = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  el.envRows = document.getElementById("env-rows");
  el.credRows = document.getElementById("cred-rows");
  el.addEnv = document.getElementById("add-env");
  el.addCred = document.getElementById("add-cred");
  el.defEnv = document.getElementById("def-env");
  el.defCred = document.getElementById("def-cred");
  el.importCred = document.getElementById("import-cred");
  el.exportCred = document.getElementById("export-cred");
  el.importFile = document.getElementById("import-file");
  el.importEnv = document.getElementById("import-env");
  el.exportEnv = document.getElementById("export-env");
  el.importEnvFile = document.getElementById("import-env-file");
  el.save = document.getElementById("save");
  el.reset = document.getElementById("reset");
  el.status = document.getElementById("status");

  working = await loadSettings();

  renderEnvRows();
  renderCredRows();
  refreshDefaultSelectors();

  el.addEnv.addEventListener("click", () => {
    working.environments.push({ id: makeId("env"), name: "New environment", baseUrl: "" });
    renderEnvRows();
    renderCredRows(); // credential rows show a checkbox per environment
    refreshDefaultSelectors();
  });

  el.addCred.addEventListener("click", () => {
    working.credentials.push({
      id: makeId("cred"),
      name: "", // name is optional — popup falls back to reference_id
      reference_id: "",
      public_token: "",
      // New credentials default to the first environment; change in the dropdown.
      environmentId: working.environments[0] ? working.environments[0].id : ""
    });
    renderCredRows();
    refreshDefaultSelectors();
  });

  el.exportCred.addEventListener("click", exportCredentials);
  el.importCred.addEventListener("click", () => el.importFile.click());
  el.importFile.addEventListener("change", onImportFile);

  el.exportEnv.addEventListener("click", exportEnvironments);
  el.importEnv.addEventListener("click", () => el.importEnvFile.click());
  el.importEnvFile.addEventListener("change", onImportEnvFile);

  el.save.addEventListener("click", onSave);
  el.reset.addEventListener("click", onReset);
}

/* ---------- Environments ---------- */

function renderEnvRows() {
  el.envRows.innerHTML = "";
  working.environments.forEach((env, i) => {
    const tr = document.createElement("tr");
    tr.appendChild(inputCell(env.name, (v) => (working.environments[i].name = v), "Name"));
    tr.appendChild(
      inputCell(env.baseUrl, (v) => (working.environments[i].baseUrl = v.trim()), "https://...")
    );
    tr.appendChild(removeCell(() => {
      const removed = working.environments[i];
      working.environments.splice(i, 1);
      // Unlink any credential pointing at the removed environment (falls back
      // to "all environments" so the credential isn't orphaned).
      working.credentials.forEach((c) => {
        if (c.environmentId === removed.id) c.environmentId = "";
      });
      renderEnvRows();
      renderCredRows();
      refreshDefaultSelectors();
    }));
    el.envRows.appendChild(tr);
  });
}

/* ---------- Credentials ---------- */

function renderCredRows() {
  el.credRows.innerHTML = "";
  working.credentials.forEach((cred, i) => {
    const tr = document.createElement("tr");
    tr.appendChild(inputCell(cred.name, (v) => (working.credentials[i].name = v), "(optional)"));
    tr.appendChild(
      inputCell(cred.reference_id, (v) => (working.credentials[i].reference_id = v.trim()), "UUID")
    );
    tr.appendChild(
      inputCell(cred.public_token, (v) => (working.credentials[i].public_token = v.trim()), "token")
    );
    tr.appendChild(envSelectCell(i));
    tr.appendChild(credActionsCell(i));
    el.credRows.appendChild(tr);
  });
}

/* ---------- Defaults ---------- */

function refreshDefaultSelectors() {
  fillSelect(
    el.defEnv,
    working.environments,
    working.defaults.environmentId,
    (e) => e.name || e.baseUrl || e.id
  );
  fillSelect(el.defCred, working.credentials, working.defaults.credentialId, credentialLabel);
}

function fillSelect(select, list, selectedId, labelFn) {
  select.innerHTML = "";
  list.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = labelFn ? labelFn(item) : item.name || item.id;
    select.appendChild(opt);
  });
  if (list.some((i) => i.id === selectedId)) {
    select.value = selectedId;
  } else if (list.length) {
    select.value = list[0].id;
  }
}

/* ---------- Save / Reset ---------- */

async function onSave() {
  // Pull current default selections from the dropdowns, preserving the
  // navigation flags that are managed from the popup.
  working.defaults = Object.assign({}, working.defaults, {
    environmentId: el.defEnv.value,
    credentialId: el.defCred.value
  });

  // Drop fully-empty rows so they don't clutter the popup.
  working.environments = working.environments.filter(
    (e) => (e.name && e.name.trim()) || (e.baseUrl && e.baseUrl.trim())
  );
  working.credentials = working.credentials.filter(
    (c) => (c.name && c.name.trim()) || (c.reference_id && c.reference_id.trim())
  );

  try {
    await saveSettings(working);
    showStatus("Saved.");
  } catch (e) {
    showStatus("Could not save: " + (e.message || e), true);
  }
  // Re-render in case empty rows were dropped.
  renderEnvRows();
  renderCredRows();
  refreshDefaultSelectors();
}

async function onReset() {
  if (!confirm("Reset all environments, credentials, and defaults to the built-in values?")) {
    return;
  }
  // Deep clone the defaults so we don't mutate the shared constant.
  working = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  await saveSettings(working);
  renderEnvRows();
  renderCredRows();
  refreshDefaultSelectors();
  showStatus("Reset to defaults.");
}

/* ---------- Small DOM helpers ---------- */

function inputCell(value, onInput, placeholder) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener("input", (e) => onInput(e.target.value));
  td.appendChild(input);
  return td;
}

// A single-select dropdown linking a credential to one environment.
// The leading "(all environments)" option (value "") represents an unscoped
// credential and is also how legacy/untagged credentials are displayed.
function envSelectCell(credIndex) {
  const td = document.createElement("td");
  const cred = working.credentials[credIndex];

  const select = document.createElement("select");
  select.className = "env-select-cell";

  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "(all environments)";
  select.appendChild(allOpt);

  working.environments.forEach((env) => {
    const opt = document.createElement("option");
    opt.value = env.id;
    opt.textContent = env.name || "(unnamed)";
    select.appendChild(opt);
  });

  // If the stored environmentId no longer exists, the select falls back to
  // the "(all environments)" option automatically.
  select.value = cred.environmentId || "";
  select.addEventListener("change", () => {
    working.credentials[credIndex].environmentId = select.value;
  });

  td.appendChild(select);
  return td;
}

// Actions cell for a credential row: Duplicate (insert a copy right below) and
// Remove. Duplicating is the intended way to reuse one token across envs.
function credActionsCell(index) {
  const td = document.createElement("td");
  const wrap = document.createElement("div");
  wrap.className = "row-actions";

  const dup = document.createElement("button");
  dup.type = "button";
  dup.className = "row-dup";
  dup.textContent = "Duplicate";
  dup.title = "Duplicate this credential";
  dup.addEventListener("click", () => {
    const copy = JSON.parse(JSON.stringify(working.credentials[index]));
    copy.id = makeId(copy.name || copy.reference_id || "cred");
    if (copy.name && copy.name.trim()) copy.name = copy.name + " (copy)";
    working.credentials.splice(index + 1, 0, copy);
    renderCredRows();
    refreshDefaultSelectors();
  });

  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "row-remove";
  rm.textContent = "✕";
  rm.title = "Remove";
  rm.addEventListener("click", () => {
    working.credentials.splice(index, 1);
    renderCredRows();
    refreshDefaultSelectors();
  });

  wrap.appendChild(dup);
  wrap.appendChild(rm);
  td.appendChild(wrap);
  return td;
}

/* ---------- Import / export credentials ---------- */

// Download the current (working) credential list as JSON.
function exportCredentials() {
  const data = JSON.stringify(working.credentials, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "raas-credentials.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showStatus(`Exported ${working.credentials.length} credential(s).`);
}

// Read a JSON file and append its credentials to the working list. Accepts
// either a bare array or an object with a "credentials" array (so a full
// settings export also works). New ids are generated to avoid collisions.
function onImportFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed && parsed.credentials)
        ? parsed.credentials
        : null;
      if (!arr) throw new Error("Expected a JSON array of credentials.");

      let added = 0;
      arr.forEach((raw) => {
        if (!raw || typeof raw !== "object") return;
        working.credentials.push({
          id: makeId(raw.name || raw.reference_id || "cred"),
          name: typeof raw.name === "string" ? raw.name : "",
          reference_id: typeof raw.reference_id === "string" ? raw.reference_id : "",
          public_token: typeof raw.public_token === "string" ? raw.public_token : "",
          environmentId: typeof raw.environmentId === "string" ? raw.environmentId : ""
        });
        added++;
      });

      renderCredRows();
      refreshDefaultSelectors();
      showStatus(`Imported ${added} credential(s). Click "Save changes" to persist.`);
    } catch (err) {
      showStatus("Import failed: " + (err.message || err), true);
    }
  };
  reader.onerror = () => showStatus("Could not read the selected file.", true);
  reader.readAsText(file);
  event.target.value = ""; // reset so the same file can be re-imported
}

/* ---------- Import / export environments ---------- */

// Download the current (working) environment list as JSON.
function exportEnvironments() {
  const data = JSON.stringify(working.environments, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "raas-environments.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showStatus(`Exported ${working.environments.length} environment(s).`);
}

// Read a JSON file and append its environments to the working list. Accepts
// either a bare array or an object with an "environments" array (so a full
// settings export also works). Original ids are preserved when free so that
// credential→environment links survive a matched import; ids that would
// collide with an existing environment get a fresh one.
function onImportEnvFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed && parsed.environments)
        ? parsed.environments
        : null;
      if (!arr) throw new Error("Expected a JSON array of environments.");

      const usedIds = new Set(working.environments.map((e) => e.id));
      let added = 0;
      arr.forEach((raw) => {
        if (!raw || typeof raw !== "object") return;
        let id = typeof raw.id === "string" ? raw.id : "";
        if (!id || usedIds.has(id)) id = makeId(raw.name || "env");
        usedIds.add(id);
        working.environments.push({
          id,
          name: typeof raw.name === "string" ? raw.name : "",
          baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl.trim() : ""
        });
        added++;
      });

      renderEnvRows();
      renderCredRows(); // env dropdowns in credential rows need refreshing
      refreshDefaultSelectors();
      showStatus(`Imported ${added} environment(s). Click "Save changes" to persist.`);
    } catch (err) {
      showStatus("Import failed: " + (err.message || err), true);
    }
  };
  reader.onerror = () => showStatus("Could not read the selected file.", true);
  reader.readAsText(file);
  event.target.value = ""; // reset so the same file can be re-imported
}

function removeCell(onClick) {
  const td = document.createElement("td");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "row-remove";
  btn.textContent = "✕";
  btn.title = "Remove";
  btn.addEventListener("click", onClick);
  td.appendChild(btn);
  return td;
}

let statusTimer = null;
function showStatus(msg, isError) {
  el.status.hidden = false;
  el.status.textContent = msg;
  el.status.style.background = isError ? "#fee2e2" : "";
  el.status.style.color = isError ? "#991b1b" : "";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.status.hidden = true;
  }, 2500);
}
