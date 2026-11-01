/* GlassTab — bootstrap: load settings, apply theme/glass/accent, clock,
   greeting, and wire all modules together. */

(function () {
  "use strict";

  const state = { settings: null, themeMedia: null, clockTimer: null };

  function hexToHsl(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return { h: 258, s: 90, l: 66 };
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function effectiveTheme() {
    if (state.settings.theme !== "auto") return state.settings.theme;
    if (!state.themeMedia) {
      state.themeMedia = window.matchMedia("(prefers-color-scheme: light)");
      state.themeMedia.addEventListener("change", applyTheme);
    }
    return state.themeMedia.matches ? "light" : "dark";
  }

  function applyTheme() {
    document.documentElement.dataset.theme = effectiveTheme();
  }

  function applyAccent() {
    const { h, s, l } = hexToHsl(state.settings.accent);
    const root = document.documentElement.style;
    root.setProperty("--accent-h", String(h));
    root.setProperty("--accent-s", `${s}%`);
    root.setProperty("--accent-l", `${l}%`);
  }

  function applyGlass() {
    const root = document.documentElement.style;
    root.setProperty("--blur", `${state.settings.glass.blur}px`);
    root.setProperty("--radius", `${state.settings.glass.radius}px`);
    root.setProperty("--glass-tint-alpha", String(state.settings.glass.opacity / 100));
    document.body.classList.toggle("reduce-transparency", !!state.settings.reduceTransparency);
  }

  /* ---------- clock & greeting ---------- */

  function tick() {
    const c = state.settings.clock;
    const now = new Date();

    const timeEl = document.getElementById("clock");
    const dateEl = document.getElementById("date");
    const greetEl = document.getElementById("greeting");
    const wrap = document.getElementById("clock-wrap");

    wrap.hidden = !c.show && !c.showDate;
    timeEl.hidden = !c.show;
    dateEl.hidden = !c.showDate;

    const opts = c.hour12 ? { hour: "numeric", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit", hour12: false };
    if (c.seconds) opts.second = "2-digit";
    timeEl.textContent = now.toLocaleTimeString(undefined, opts);

    dateEl.textContent = now.toLocaleDateString(undefined,
      { weekday: "long", month: "long", day: "numeric" });

    if (state.settings.greeting.show) {
      const h = now.getHours();
      const part =
        h < 5 ? "Up late" :
        h < 12 ? "Good morning" :
        h < 17 ? "Good afternoon" :
        h < 21 ? "Good evening" : "Up late";
      const name = state.settings.greeting.name.trim();
      greetEl.textContent = name ? `${part}, ${name}` : part;
    } else {
      greetEl.textContent = "";
    }

    const interval = state.settings.clock.seconds ? 1000 : 15000;
    if (state.clockTimer) clearInterval(state.clockTimer);
    state.clockTimer = setInterval(tick, interval);
  }

  /* ---------- theme cycle button ---------- */

  function bindThemeButton() {
    const order = ["auto", "light", "dark"];
    const labels = { auto: "Auto", light: "Light", dark: "Dark" };
    document.getElementById("btn-theme").addEventListener("click", () => {
      const next = order[(order.indexOf(state.settings.theme) + 1) % order.length];
      state.settings.theme = next;
      persist();
      applyTheme();
      GT.toast(`Theme: ${labels[next]}`);
    });
  }

  /* ---------- persistence + re-apply ---------- */

  async function persist() {
    try { await GT.saveSettings(state.settings); } catch { /* quota errors are non-fatal */ }
  }

  function applyAll() {
    applyTheme();
    applyAccent();
    applyGlass();
    GT.backgrounds.apply(state.settings);
    GT.search.refresh(state.settings);
    tick();
  }

  function onChange() {
    persist();
    applyAll();
    GT.cards.renderAll();
  }

  /* ---------- external changes (sync from other tabs) ---------- */

  function watchStorage() {
    if (!chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes.settings) return;
      GT.loadSettings().then((fresh) => {
        state.settings = fresh;
        applyAll();
        GT.cards.renderAll();
      });
    });
  }

  /* ---------- boot ---------- */

  async function boot() {
    state.settings = await GT.loadSettings();

    applyTheme();
    applyAccent();
    applyGlass();

    GT.search.init(state.settings);
    GT.search.refresh(state.settings);
    GT.cards.init(state.settings, onChange);
    GT.cards.renderAll();
    GT.backgrounds.apply(state.settings);
    GT.settingsDrawer.init(state.settings, onChange);

    bindThemeButton();
    tick();
    watchStorage();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
