// Storage layer for the extension.
// Uses chrome.storage.sync when available, falling back to chrome.storage.local.
// All settings are stored under a single key so reads/writes are atomic.

const STORAGE_KEY = "raasDevNavigator";

// Shipped empty on purpose: environments and credentials hold environment-
// specific URLs and reference_id / public_token values that should not live in
// source control. Configure them at runtime in the Options page, or use
// Import to load a JSON file shared privately with your team. Only the
// non-sensitive UX flags carry real default values here.
const DEFAULT_SETTINGS = {
  environments: [],
  credentials: [],
  defaults: {
    environmentId: "",
    credentialId: "",
    openInNewTab: true,
    keepHostname: false
  }
};

// Pick the best available storage area. Returns chrome.storage.sync if present,
// otherwise chrome.storage.local. (sync can be unavailable in some contexts.)
function getArea() {
  if (typeof chrome !== "undefined" && chrome.storage) {
    return chrome.storage.sync || chrome.storage.local;
  }
  throw new Error("chrome.storage is not available");
}

// Promisified get of the entire settings object, merged over defaults so that
// missing keys (e.g. after a schema bump) are always populated.
function loadSettings() {
  return new Promise((resolve) => {
    const area = getArea();
    area.get([STORAGE_KEY], (result) => {
      const stored = (result && result[STORAGE_KEY]) || {};
      resolve(mergeWithDefaults(stored));
    });
  });
}

function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    const area = getArea();
    area.set({ [STORAGE_KEY]: settings }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Deep-ish merge: only top-level arrays/objects we care about. If the stored
// object has the key we use it as-is; otherwise the default fills in.
function mergeWithDefaults(stored) {
  return {
    environments: Array.isArray(stored.environments)
      ? stored.environments
      : DEFAULT_SETTINGS.environments,
    credentials: Array.isArray(stored.credentials)
      ? stored.credentials
      : DEFAULT_SETTINGS.credentials,
    defaults: Object.assign({}, DEFAULT_SETTINGS.defaults, stored.defaults || {})
  };
}

// Generate a stable-ish id from a name plus a short random suffix.
function makeId(name) {
  const slug = (name || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "item";
  return slug + "-" + Math.random().toString(36).slice(2, 6);
}

// Whether a credential should be offered for a given environment.
// Each credential is linked to a single environment via environmentId.
// Backwards-compatibility / fallback rule:
//   - falsy environmentId ("" or undefined) → untagged → available in ALL envs
//   - otherwise → available only when it matches the given environment
function credentialRelatesToEnv(credential, environmentId) {
  if (!credential) return false;
  if (!credential.environmentId) return true;
  return credential.environmentId === environmentId;
}

// Display label for a credential. Name is optional; when empty we fall back to
// the reference_id so the item is still selectable.
function credentialLabel(credential) {
  if (!credential) return "(unnamed)";
  const name = credential.name && credential.name.trim();
  return name || credential.reference_id || "(unnamed)";
}

export {
  STORAGE_KEY,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  makeId,
  credentialRelatesToEnv,
  credentialLabel
};
