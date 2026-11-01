/* GlassTab — Gemini prefill helper (content script).
   gemini.google.com ignores ?q= natively, so this content script reads the
   parameter, types the prompt into Gemini's editor, and strips the param
   from the URL so a refresh doesn't re-trigger. Fails silently. */

(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || params.get("prompt") || "").trim();
  if (!q) return;

  // Clean the URL first so reloads don't re-run the prefill.
  try {
    history.replaceState(null, "", location.origin + location.pathname);
  } catch { /* ignore */ }

  const SELECTORS = [
    "rich-textarea .ql-editor",
    ".ql-editor[contenteditable='true']",
    "div[contenteditable='true']",
    "textarea"
  ];

  const MAX_TRIES = 50; // ~15s at 300ms
  let tries = 0;

  function findEditor() {
    for (const sel of SELECTORS) {
      const node = document.querySelector(sel);
      if (node) return node;
    }
    return null;
  }

  function fill(editor) {
    editor.focus();
    // insertText is deprecated but still the most reliable way to type
    // into contenteditable surfaces (fires the editor's own input path).
    if (!document.execCommand("insertText", false, q)) {
      editor.textContent = q;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }

  const timer = setInterval(() => {
    tries += 1;
    const editor = findEditor();
    if (editor) {
      clearInterval(timer);
      try { fill(editor); } catch { /* give up quietly */ }
    } else if (tries >= MAX_TRIES) {
      clearInterval(timer);
    }
  }, 300);
})();
