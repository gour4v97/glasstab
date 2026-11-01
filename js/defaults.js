/* GlassTab — defaults, gradient presets, AI providers, WMO weather codes.
   Shared namespace: window.GT */

window.GT = {};

GT.SETTINGS_VERSION = 1;

GT.DEFAULTS = {
  version: GT.SETTINGS_VERSION,

  theme: "auto", // auto | light | dark
  accent: "#7c5cff",

  background: {
    type: "gradient",            // gradient | solid | image | daily
    gradientId: "aurora",
    solid: "#0f1220",
    imageUrl: "",
    dim: 0.25
  },

  glass: {
    blur: 24,        // px 0..40
    opacity: 55,     // % 30..85
    radius: 20       // px 8..32
  },

  reduceTransparency: false,

  clock: {
    show: true,
    hour12: false,
    seconds: false,
    showDate: true
  },

  greeting: {
    show: true,
    name: ""
  },

  cards: {
    quickLinks: { show: true },
    weather:    { show: true, city: "", lat: null, lon: null },
    bookmarks:  { show: true }
  },

  search: {
    defaultMode: "search",       // search | ai
    aiProvider: "gemini",        // gemini | perplexity | chatgpt | claude | duckai | custom
    customUrl: "",               // template with {q}
    openInNewTab: false,
    focusOnLoad: true
  },

  hiddenTopSites: [],            // urls hidden from quick links
  customLinks: []                // [{ title, url }]
};

/* Mesh-gradient presets: base + 4 blob colors (hex) */
GT.GRADIENTS = [
  { id: "aurora",  name: "Aurora",  base: "#0b0e1a", blobs: ["#7c5cff", "#22d3ee", "#f472b6", "#34d399"] },
  { id: "sunset",  name: "Sunset",  base: "#1a0f1e", blobs: ["#fb7185", "#f59e0b", "#a855f7", "#ef4444"] },
  { id: "ocean",   name: "Ocean",   base: "#071420", blobs: ["#0ea5e9", "#22d3ee", "#6366f1", "#14b8a6"] },
  { id: "forest",  name: "Forest",  base: "#0a140f", blobs: ["#34d399", "#a3e635", "#0d9488", "#84cc16"] },
  { id: "candy",   name: "Candy",   base: "#160d1c", blobs: ["#e879f9", "#818cf8", "#f472b6", "#60a5fa"] },
  { id: "ember",   name: "Ember",   base: "#170d0a", blobs: ["#ef4444", "#f97316", "#fbbf24", "#dc2626"] },
  { id: "mono",    name: "Mono",    base: "#0c0d10", blobs: ["#3f4453", "#565b6e", "#2c2f3a", "#6b7280"] },
  { id: "sunlight",name: "Sunlight",base: "#f4ead9", blobs: ["#fcd34d", "#fda4af", "#a5b4fc", "#f9a8d4"] }
];

GT.AI_PROVIDERS = [
  { id: "gemini",     name: "Gemini",      url: "https://gemini.google.com/app?q={q}" },
  { id: "perplexity", name: "Perplexity",  url: "https://www.perplexity.ai/search?q={q}" },
  { id: "chatgpt",    name: "ChatGPT",     url: "https://chatgpt.com/?q={q}" },
  { id: "claude",     name: "Claude",      url: "https://claude.ai/new?q={q}" },
  { id: "duckai",     name: "Duck.ai",     url: "https://duck.ai/?q={q}" },
  { id: "custom",     name: "Custom…",     url: "" }
];

GT.WMO = [
  { codes: [0],        emoji: "☀️", label: "Clear sky" },
  { codes: [1],        emoji: "🌤️", label: "Mostly clear" },
  { codes: [2],        emoji: "⛅",  label: "Partly cloudy" },
  { codes: [3],        emoji: "☁️",  label: "Overcast" },
  { codes: [45, 48],   emoji: "🌫️", label: "Fog" },
  { codes: [51, 53, 55, 56, 57], emoji: "🌦️", label: "Drizzle" },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], emoji: "🌧️", label: "Rain" },
  { codes: [71, 73, 75, 77, 85, 86], emoji: "❄️", label: "Snow" },
  { codes: [95, 96, 99], emoji: "⛈️", label: "Thunderstorm" }
];

GT.wmoFor = function (code) {
  for (const entry of GT.WMO) {
    if (entry.codes.includes(code)) return entry;
  }
  return { emoji: "🌡️", label: "—" };
};

/* Deep-merge stored settings over defaults (stored wins) */
GT.mergeSettings = function (defaults, stored) {
  if (!stored || typeof stored !== "object") return structuredClone(defaults);
  const out = Array.isArray(defaults) ? [] : {};
  const keys = new Set([...Object.keys(defaults), ...Object.keys(stored)]);
  for (const key of keys) {
    const d = defaults[key];
    const s = stored[key];
    if (d && typeof d === "object" && !Array.isArray(d) && s && typeof s === "object" && !Array.isArray(s)) {
      out[key] = GT.mergeSettings(d, s);
    } else if (s !== undefined) {
      out[key] = s;
    } else if (d !== undefined) {
      out[key] = d;
    }
  }
  return out;
};

GT.loadSettings = async function () {
  try {
    const stored = (await chrome.storage.sync.get("settings")).settings;
    return GT.mergeSettings(GT.DEFAULTS, stored);
  } catch {
    return structuredClone(GT.DEFAULTS);
  }
};

GT.saveSettings = async function (settings) {
  await chrome.storage.sync.set({ settings });
};

/* Favicon URL for a page, served by Chrome's built-in favicon endpoint */
GT.faviconUrl = function (pageUrl, size) {
  const s = size || 32;
  return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${s}`);
};

GT.normalizeUrl = function (input) {
  const value = (input || "").trim();
  if (!value) return "";
  return /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
};

GT.hostOf = function (url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url || ""; }
};

GT.toast = (function () {
  let timer = null;
  return function (message, ms) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => { el.hidden = true; }, 300);
    }, ms || 1800);
  };
})();
