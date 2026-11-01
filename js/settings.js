/* GlassTab — settings drawer. Builds all customization controls and binds
   them live to GT.settings; every change persists and re-applies instantly. */

GT.settingsDrawer = (function () {
  let settings = null;
  let onChange = null; // () => re-applies live state

  /* ---------- tiny builders ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function section(title) {
    const sec = el("section");
    if (title) sec.appendChild(el("h3", null, title));
    return sec;
  }

  function row(labelText, control) {
    const r = el("div", "row");
    const label = el("label", null, labelText);
    r.append(label, control);
    return r;
  }

  function switchEl(get, set) {
    const btn = el("button", "switch");
    btn.type = "button";
    btn.role = "switch";
    btn.setAttribute("aria-checked", get() ? "true" : "false");
    btn.addEventListener("click", () => {
      set(!get());
      btn.setAttribute("aria-checked", get() ? "true" : "false");
      commit();
    });
    return btn;
  }

  function segEl(options, get, set) {
    const wrap = el("div", "seg");
    options.forEach((opt) => {
      const b = el("button", null, opt.label);
      b.type = "button";
      b.setAttribute("aria-pressed", get() === opt.value ? "true" : "false");
      b.addEventListener("click", () => {
        set(opt.value);
        wrap.querySelectorAll("button").forEach((x) => x.removeAttribute("aria-pressed"));
        b.setAttribute("aria-pressed", "true");
        commit();
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function rangeEl(min, max, step, get, set, suffix) {
    const wrap = el("span");
    const input = el("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(get());
    const value = el("span", null, fmt());
    value.style.cssText = "font-size:12px;color:var(--text-faint);min-width:38px;text-align:right;";
    function fmt() { return `${get()}${suffix || ""}`; }
    input.addEventListener("input", () => {
      set(Number(input.value));
      value.textContent = fmt();
      commit();
    });
    wrap.append(input, value);
    return wrap;
  }

  function colorEl(get, set) {
    const input = el("input");
    input.type = "color";
    input.value = get();
    input.addEventListener("input", () => { set(input.value); commit(); });
    return input;
  }

  function selectEl(options, get, set) {
    const select = el("select");
    options.forEach((opt) => {
      const o = el("option", null, opt.label);
      o.value = opt.value;
      select.appendChild(o);
    });
    select.value = get();
    select.addEventListener("change", () => { set(select.value); commit(); });
    return select;
  }

  function textEl(placeholder, get, set) {
    const input = el("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = get();
    let debounce = null;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { set(input.value); commit(); }, 350);
    });
    return input;
  }

  function commit() {
    if (onChange) onChange();
  }

  /* ---------- drawer content ---------- */

  function build() {
    const drawer = document.getElementById("drawer");
    drawer.textContent = "";

    const head = el("div", "drawer-head");
    head.appendChild(el("h2", null, "GlassTab settings"));
    const close = el("button", "icon-btn");
    close.innerHTML = "×";
    close.style.fontSize = "20px";
    close.setAttribute("aria-label", "Close settings");
    close.addEventListener("click", api.close);
    head.appendChild(close);
    drawer.appendChild(head);

    /* Appearance */
    const sAppearance = section("Appearance");
    sAppearance.appendChild(row("Theme", segEl(
      [{ value: "auto", label: "Auto" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }],
      () => settings.theme,
      (v) => { settings.theme = v; }
    )));
    sAppearance.appendChild(row("Accent color", colorEl(
      () => settings.accent,
      (v) => { settings.accent = v; }
    )));
    drawer.appendChild(sAppearance);

    /* Background */
    const sBg = section("Background");
    sBg.appendChild(row("Type", selectEl([
      { value: "gradient", label: "Mesh gradient" },
      { value: "daily", label: "Daily gradient" },
      { value: "solid", label: "Solid color" },
      { value: "image", label: "Image" }
    ],
      () => settings.background.type,
      (v) => { settings.background.type = v; refreshDynamic(sBg); }
    )));

    const gradWrap = el("div");
    gradWrap.className = "gradient-grid";
    GT.GRADIENTS.forEach((g) => {
      const sw = el("button", "swatch");
      sw.type = "button";
      sw.title = g.name;
      sw.setAttribute("data-active",
        (settings.background.type === "daily" ? true : settings.background.gradientId === g.id) ? "true" : "false");
      sw.style.background =
        `radial-gradient(circle at 30% 30%, ${g.blobs[0]}, transparent 60%),` +
        `radial-gradient(circle at 70% 60%, ${g.blobs[1]}, transparent 60%),` +
        `radial-gradient(circle at 50% 85%, ${g.blobs[2]}, transparent 55%),` +
        g.base;
      sw.appendChild(el("span", null, g.name));
      sw.addEventListener("click", () => {
        settings.background.type = "gradient";
        settings.background.gradientId = g.id;
        commit();
        refreshDynamic(sBg);
      });
      gradWrap.appendChild(sw);
    });
    const gradRow = el("div", "row");
    gradRow.style.flexDirection = "column";
    gradRow.style.alignItems = "stretch";
    gradRow.appendChild(gradWrap);
    gradRow.dataset.dynamic = "gradient";

    const solidCtl = colorEl(() => settings.background.solid, (v) => { settings.background.solid = v; });
    solidCtl.parentElement; // no-op
    const solidRow = row("Solid color", solidCtl);
    solidRow.dataset.dynamic = "solid";

    const imgRow = el("div", "row");
    imgRow.style.flexDirection = "column";
    imgRow.style.alignItems = "stretch";
    imgRow.dataset.dynamic = "image";
    const urlInput = textEl("Paste image URL…",
      () => settings.background.imageUrl,
      (v) => { settings.background.imageUrl = v.trim(); });
    urlInput.style.width = "100%";
    imgRow.appendChild(urlInput);
    const fileRow = el("div");
    fileRow.style.cssText = "display:flex;gap:8px;margin-top:8px;";
    const fileBtn = el("button", "btn-file", "Upload image");
    const clearBtn = el("button", "btn-file", "Remove");
    const fileInput = el("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.hidden = true;
    fileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      GT.toast("Processing image…");
      try {
        await GT.backgrounds.saveImageFile(file);
        settings.background.imageUrl = "";
        GT.toast("Image set");
        commit();
      } catch {
        GT.toast("Could not read image");
      }
    });
    clearBtn.addEventListener("click", async () => {
      await GT.backgrounds.clearImage();
      settings.background.imageUrl = "";
      commit();
    });
    fileRow.append(fileBtn, clearBtn, fileInput);
    imgRow.appendChild(fileRow);
    imgRow.appendChild(el("p", "hint", "Image URL or upload — uploads are stored locally, scaled to 1920px."));

    sBg.appendChild(gradRow);
    sBg.appendChild(solidRow);
    sBg.appendChild(imgRow);

    sBg.appendChild(row("Background dim", rangeEl(0, 0.8, 0.05,
      () => settings.background.dim,
      (v) => { settings.background.dim = v; }
    )));
    drawer.appendChild(sBg);

    function refreshDynamic(parent) {
      const type = settings.background.type;
      parent.querySelectorAll("[data-dynamic]").forEach((n) => {
        n.hidden = n.dataset.dynamic !== type;
      });
      parent.querySelectorAll(".swatch").forEach((sw) => {
        sw.setAttribute("data-active",
          (type === "daily" || settings.background.gradientId === sw.title.toLowerCase()) ? "true" : "false");
      });
    }
    sBg.refreshDynamic = refreshDynamic;

    /* Glass */
    const sGlass = section("Glass");
    sGlass.appendChild(row("Blur", rangeEl(0, 40, 1,
      () => settings.glass.blur, (v) => { settings.glass.blur = v; }, "px")));
    sGlass.appendChild(row("Card opacity", rangeEl(30, 85, 1,
      () => settings.glass.opacity, (v) => { settings.glass.opacity = v; }, "%")));
    sGlass.appendChild(row("Corner radius", rangeEl(8, 32, 1,
      () => settings.glass.radius, (v) => { settings.glass.radius = v; }, "px")));
    sGlass.appendChild(row("Reduce transparency", switchEl(
      () => settings.reduceTransparency,
      (v) => { settings.reduceTransparency = v; }
    )));
    drawer.appendChild(sGlass);

    /* Clock & greeting */
    const sClock = section("Clock & greeting");
    sClock.appendChild(row("Show clock", switchEl(
      () => settings.clock.show, (v) => { settings.clock.show = v; })));
    sClock.appendChild(row("12-hour format", switchEl(
      () => settings.clock.hour12, (v) => { settings.clock.hour12 = v; })));
    sClock.appendChild(row("Show seconds", switchEl(
      () => settings.clock.seconds, (v) => { settings.clock.seconds = v; })));
    sClock.appendChild(row("Show date", switchEl(
      () => settings.clock.showDate, (v) => { settings.clock.showDate = v; })));
    sClock.appendChild(row("Show greeting", switchEl(
      () => settings.greeting.show, (v) => { settings.greeting.show = v; })));
    sClock.appendChild(row("Your name", textEl("Optional",
      () => settings.greeting.name, (v) => { settings.greeting.name = v; })));
    drawer.appendChild(sClock);

    /* Cards */
    const sCards = section("Cards");
    sCards.appendChild(row("Quick links", switchEl(
      () => settings.cards.quickLinks.show, (v) => { settings.cards.quickLinks.show = v; })));
    sCards.appendChild(row("Weather", switchEl(
      () => settings.cards.weather.show, (v) => { settings.cards.weather.show = v; })));
    sCards.appendChild(row("Bookmarks", switchEl(
      () => settings.cards.bookmarks.show, (v) => { settings.cards.bookmarks.show = v; })));
    drawer.appendChild(sCards);

    /* Search */
    const sSearch = section("Search");
    sSearch.appendChild(row("Enter key does", segEl(
      [{ value: "search", label: "Search" }, { value: "ai", label: "Ask AI" }],
      () => settings.search.defaultMode,
      (v) => { settings.search.defaultMode = v; }
    )));
    sSearch.appendChild(row("AI provider", selectEl(
      GT.AI_PROVIDERS.map((p) => ({ value: p.id, label: p.name })),
      () => settings.search.aiProvider,
      (v) => { settings.search.aiProvider = v; refreshDynamic(sSearch); }
    )));
    const customRow = row("Custom URL template", textEl("https://…?q={q}",
      () => settings.search.customUrl,
      (v) => { settings.search.customUrl = v; }));
    customRow.dataset.dynamic = "custom";
    sSearch.appendChild(customRow);
    sSearch.appendChild(row("Open results in new tab", switchEl(
      () => settings.search.openInNewTab, (v) => { settings.search.openInNewTab = v; })));
    sSearch.appendChild(row("Focus search on load", switchEl(
      () => settings.search.focusOnLoad, (v) => { settings.search.focusOnLoad = v; })));
    drawer.appendChild(sSearch);

    function refreshDynamic(parent) {
      parent.querySelectorAll("[data-dynamic]").forEach((n) => {
        n.hidden = n.dataset.dynamic !== settings.search.aiProvider;
      });
    }
    sSearch.refreshDynamic = refreshDynamic;

    /* Reset */
    const reset = el("button", "reset-btn", "Reset all settings");
    reset.addEventListener("click", async () => {
      if (!confirm("Reset all GlassTab settings to defaults?")) return;
      const fresh = structuredClone(GT.DEFAULTS);
      Object.keys(fresh).forEach((k) => { settings[k] = fresh[k]; });
      await GT.saveSettings(settings);
      build();
      commit();
      GT.toast("Settings reset");
    });
    drawer.appendChild(reset);

    refreshDynamic(sBg);
    refreshDynamic(sSearch);
  }

  /* ---------- open/close ---------- */

  const api = {
    init(currentSettings, onChangeFn) {
      settings = currentSettings;
      onChange = onChangeFn;

      document.getElementById("btn-settings").addEventListener("click", api.open);
      document.getElementById("scrim").addEventListener("click", api.close);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") api.close();
      });
    },

    open() {
      build(); // rebuild so controls reflect current settings
      const drawer = document.getElementById("drawer");
      const scrim = document.getElementById("scrim");
      drawer.hidden = false;
      scrim.hidden = false;
      document.getElementById("btn-settings").setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => drawer.classList.add("open"));
    },

    close() {
      const drawer = document.getElementById("drawer");
      const scrim = document.getElementById("scrim");
      if (drawer.hidden) return;
      drawer.classList.remove("open");
      scrim.hidden = true;
      document.getElementById("btn-settings").setAttribute("aria-expanded", "false");
      setTimeout(() => { drawer.hidden = true; }, 300);
    }
  };

  return api;
})();
