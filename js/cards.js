/* GlassTab — cards: quick links (topSites + custom), weather (Open-Meteo),
   bookmarks (recent). Renders into the containers in index.html. */

GT.cards = (function () {
  let settings = null;
  let save = null; // async () => persists GT.settings

  /* ---------- Quick links ---------- */

  async function renderQuickLinks() {
    const wrap = document.getElementById("quicklinks");
    wrap.textContent = "";
    if (!settings.cards.quickLinks.show) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;

    const hidden = new Set(settings.hiddenTopSites);
    let sites = [];
    try {
      sites = (await chrome.topSites.get()) || [];
    } catch { /* permission missing — ignore */ }

    const tiles = [];

    for (const site of sites) {
      if (hidden.has(site.url)) continue;
      if (tiles.length >= 8) break;
      tiles.push({ title: site.title || GT.hostOf(site.url), url: site.url, system: true });
    }
    for (const link of settings.customLinks) {
      if (tiles.length >= 10) break;
      tiles.push({ title: link.title || GT.hostOf(link.url), url: link.url, system: false });
    }

    for (const tile of tiles) {
      wrap.appendChild(qlTile(tile));
    }

    // "+" add tile
    const add = document.createElement("a");
    add.href = "#";
    add.className = "ql ql-add";
    add.title = "Add shortcut";
    add.innerHTML = '<span class="ql-icon">+</span><span class="ql-title">Add</span>';
    add.addEventListener("click", (event) => {
      event.preventDefault();
      showAddForm(wrap);
    });
    wrap.appendChild(add);
  }

  function qlTile(tile) {
    const a = document.createElement("a");
    a.className = "ql";
    a.href = tile.url;
    a.title = tile.url;

    const icon = document.createElement("span");
    icon.className = "ql-icon";
    const img = document.createElement("img");
    img.src = GT.faviconUrl(tile.url, 32);
    img.alt = "";
    img.onerror = () => {
      img.remove();
      icon.textContent = (tile.title || "?").trim().charAt(0).toUpperCase() || "?";
    };
    icon.appendChild(img);

    const label = document.createElement("span");
    label.className = "ql-title";
    label.textContent = tile.title || GT.hostOf(tile.url);

    a.appendChild(icon);
    a.appendChild(label);

    if (tile.system) {
      const x = document.createElement("button");
      x.className = "ql-remove";
      x.textContent = "×";
      x.title = "Hide this shortcut";
      x.setAttribute("aria-label", `Hide ${label.textContent}`);
      x.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        settings.hiddenTopSites.push(tile.url);
        save();
      });
      a.appendChild(x);
    } else {
      const x = document.createElement("button");
      x.className = "ql-remove";
      x.textContent = "×";
      x.title = "Remove shortcut";
      x.setAttribute("aria-label", `Remove ${label.textContent}`);
      x.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        settings.customLinks = settings.customLinks.filter((l) => l.url !== tile.url);
        save();
      });
      a.appendChild(x);
    }
    return a;
  }

  function showAddForm(wrap) {
    const old = wrap.querySelector(".ql-form");
    if (old) { old.remove(); return; }

    const form = document.createElement("form");
    form.className = "ql-form";
    form.innerHTML =
      '<input type="text" class="title" placeholder="Name (optional)" aria-label="Name">' +
      '<input type="text" class="url" placeholder="example.com" aria-label="URL" required>';
    const addBtn = document.createElement("button");
    addBtn.type = "submit";
    addBtn.textContent = "Add";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => form.remove());
    form.append(addBtn, cancel);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = form.querySelector(".title").value.trim();
      const url = GT.normalizeUrl(form.querySelector(".url").value);
      if (!url) return;
      settings.customLinks.push({ title, url });
      save();
    });

    wrap.appendChild(form);
    form.querySelector(".url").focus();
  }

  /* ---------- Weather (Open-Meteo, no API key) ---------- */

  async function renderWeather() {
    const body = document.getElementById("weather-body");
    const card = document.getElementById("card-weather");
    card.hidden = !settings.cards.weather.show;
    if (!settings.cards.weather.show) return;

    const { city, lat, lon } = settings.cards.weather;
    if (lat == null || lon == null) {
      body.innerHTML = "";
      body.appendChild(cityForm());
      return;
    }

    body.innerHTML = '<div class="empty-note">Loading…</div>';
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const temp = Math.round(data.current.temperature_2m);
      const wmo = GT.wmoFor(data.current.weather_code);

      body.innerHTML = "";
      const now = document.createElement("div");
      now.className = "wx-now";
      now.innerHTML =
        `<span class="wx-emoji">${wmo.emoji}</span>` +
        `<span><span class="wx-temp">${temp}°C</span>` +
        `<div class="wx-desc">${wmo.label}</div></span>`;
      const place = document.createElement("div");
      place.className = "wx-city";
      place.textContent = city || "—";
      const change = document.createElement("button");
      change.className = "hint";
      change.textContent = "Change location";
      change.style.cssText = "background:none;border:0;cursor:pointer;padding:0;display:block;margin-top:8px;";
      change.addEventListener("click", () => {
        body.innerHTML = "";
        body.appendChild(cityForm());
      });
      body.append(now, place, change);
    } catch {
      body.innerHTML = '<div class="empty-note">Weather unavailable. Check connection.</div>';
    }
  }

  function cityForm() {
    const wrap = document.createElement("div");
    wrap.innerHTML = '<div class="empty-note">Enter a city for local weather:</div>';
    const form = document.createElement("form");
    form.className = "wx-set";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "e.g. Mumbai";
    input.setAttribute("aria-label", "City");
    const go = document.createElement("button");
    go.type = "submit";
    go.textContent = "Set";
    form.append(input, go);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`
        );
        const data = await res.json();
        const hit = data.results && data.results[0];
        if (!hit) { GT.toast("City not found"); return; }
        settings.cards.weather.city = hit.name;
        settings.cards.weather.lat = hit.latitude;
        settings.cards.weather.lon = hit.longitude;
        await save();
      } catch {
        GT.toast("Could not look up city");
      }
    });
    wrap.appendChild(form);
    return wrap;
  }

  /* ---------- Bookmarks ---------- */

  async function renderBookmarks() {
    const body = document.getElementById("bookmarks-body");
    const card = document.getElementById("card-bookmarks");
    card.hidden = !settings.cards.bookmarks.show;
    if (!settings.cards.bookmarks.show) return;

    let items = [];
    try {
      items = (await chrome.bookmarks.getRecent(8)) || [];
    } catch { /* permission missing */ }
    items = items.filter((b) => b.url);

    body.innerHTML = "";
    if (!items.length) {
      body.innerHTML = '<div class="empty-note">No recent bookmarks yet.</div>';
      return;
    }

    const list = document.createElement("div");
    list.className = "bm-list";
    for (const bm of items) {
      const a = document.createElement("a");
      a.className = "bm";
      a.href = bm.url;
      a.title = bm.title || bm.url;
      const img = document.createElement("img");
      img.src = GT.faviconUrl(bm.url, 16);
      img.alt = "";
      const span = document.createElement("span");
      span.textContent = bm.title || GT.hostOf(bm.url);
      a.append(img, span);
      list.appendChild(a);
    }
    body.appendChild(list);
  }

  /* ---------- Card hide buttons (synced to settings) ---------- */

  function bindHideButtons() {
    document.querySelectorAll(".card-min").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        if (target === "card-weather") settings.cards.weather.show = false;
        if (target === "card-bookmarks") settings.cards.bookmarks.show = false;
        save();
      });
    });
  }

  function init(currentSettings, saveFn) {
    settings = currentSettings;
    save = saveFn;
    bindHideButtons();
  }

  function renderAll() {
    renderQuickLinks();
    renderWeather();
    renderBookmarks();
  }

  return { init, renderAll, renderWeather };
})();
