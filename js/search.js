/* GlassTab — search pill behavior: mode chips, default-engine web search
   via chrome.search, and AI handoff to the configured provider. */

GT.search = (function () {
  let mode = "search"; // search | ai
  let settings = null;

  function providerById(id) {
    return GT.AI_PROVIDERS.find((p) => p.id === id) || GT.AI_PROVIDERS[0];
  }

  function aiUrl(text) {
    const provider = providerById(settings.search.aiProvider);
    let template = provider.url;
    if (provider.id === "custom") {
      template = settings.search.customUrl || "https://www.google.com/search?q={q}";
    }
    if (!template.includes("{q}")) {
      template = template.endsWith("=") ? `${template}{q}` : `${template} {q}`;
    }
    return template.replace("{q}", encodeURIComponent(text));
  }

  function submit(text) {
    const value = (text || "").trim();
    if (!value) return;

    if (mode === "ai") {
      const url = aiUrl(value);
      if (settings.search.openInNewTab) {
        chrome.tabs ? chrome.tabs.create({ url }) : window.open(url, "_blank");
      } else {
        window.location.href = url;
      }
      return;
    }

    // Web search with the browser's actual default engine.
    const disposition = settings.search.openInNewTab ? "NEW_TAB" : "CURRENT_TAB";
    if (chrome.search && chrome.search.query) {
      try {
        chrome.search.query({ text: value, disposition });
        return;
      } catch { /* fall through to a safe default */ }
    }
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  }

  function setMode(next) {
    mode = next;
    document.querySelectorAll("#chips .chip").forEach((chip) => {
      const active = chip.dataset.mode === mode;
      chip.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function providerName() {
    const provider = providerById(settings.search.aiProvider);
    return provider.id === "custom" ? "AI" : provider.name;
  }

  function init(currentSettings) {
    settings = currentSettings;

    const form = document.getElementById("search-form");
    const input = document.getElementById("search-input");
    const chips = document.getElementById("chips");

    setMode(settings.search.defaultMode === "ai" ? "ai" : "search");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(input.value);
    });

    chips.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip");
      if (chip) setMode(chip.dataset.mode);
    });

    // "/" focuses the search box from anywhere (unless already typing)
    document.addEventListener("keydown", (event) => {
      if (event.key !== "/" || event.defaultPrevented) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      event.preventDefault();
      input.focus();
      input.select();
    });

    if (settings.search.focusOnLoad) {
      setTimeout(() => input.focus(), 60);
    }
  }

  function refresh(settingsNow) {
    settings = settingsNow;
    const label = document.getElementById("ai-chip-label");
    if (label) label.textContent = `Ask ${providerName()}`;
  }

  return { init, refresh, setMode, submit };
})();
