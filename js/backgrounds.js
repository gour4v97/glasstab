/* GlassTab — background engine. Expensive work is skipped when only
   unrelated settings change, and video playback stops in hidden tabs. */

GT.backgrounds = (function () {
  const IMAGE_KEY = "bgImageDataUrl";
  const MAX_DIM = 1920;
  let appliedKey = "";
  let visibilityBound = false;

  function gradientById(id) {
    return GT.GRADIENTS.find((g) => g.id === id) || GT.GRADIENTS[0];
  }

  function pickDaily() {
    return GT.GRADIENTS[Math.floor(Date.now() / 86400000) % GT.GRADIENTS.length];
  }

  function setBlobsVisible(visible) {
    document.querySelectorAll(".blob").forEach((blob) => {
      blob.style.visibility = visible ? "" : "hidden";
    });
  }

  function applyGradient(grad) {
    const bg = document.getElementById("bg");
    bg.querySelector(".bg-base").style.setProperty("--bg-base", grad.base);
    grad.blobs.forEach((color, index) => bg.style.setProperty(`--b${index + 1}`, color));
    setBlobsVisible(true);
  }

  async function loadImageDataUrl() {
    try { return (await chrome.storage.local.get(IMAGE_KEY))[IMAGE_KEY] || ""; }
    catch { return ""; }
  }

  async function saveImageFile(file) {
    const dataUrl = await downscale(file);
    await chrome.storage.local.set({ [IMAGE_KEY]: dataUrl });
  }

  async function clearImage() {
    try { await chrome.storage.local.remove(IMAGE_KEY); } catch { /* ignore */ }
  }

  function downscale(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("decode failed"));
        img.onload = () => {
          const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function stopVideo(video) {
    video.pause();
    video.hidden = true;
    if (video.dataset.active === "true") {
      video.removeAttribute("src");
      video.load();
      video.dataset.active = "false";
    }
  }

  function syncVideoPlayback() {
    const video = document.getElementById("bg-video");
    if (!video || video.hidden || document.hidden) {
      if (video) video.pause();
      return;
    }
    video.play().catch(() => { /* autoplay can be blocked until first interaction */ });
  }

  function bindVisibility() {
    if (visibilityBound) return;
    visibilityBound = true;
    document.addEventListener("visibilitychange", syncVideoPlayback);
  }

  async function apply(settings) {
    const bg = document.getElementById("bg");
    const image = document.getElementById("bg-image");
    const video = document.getElementById("bg-video");
    const background = settings.background;
    const type = background.type;
    bg.style.setProperty("--dim", String(background.dim ?? 0.25));
    bg.classList.toggle("motion-paused", background.motion === false);

    const key = JSON.stringify({
      type, gradientId: background.gradientId, solid: background.solid,
      imageUrl: background.imageUrl, videoUrl: background.videoUrl
    });
    if (key === appliedKey) return;
    appliedKey = key;

    image.hidden = true;
    if (type !== "video") stopVideo(video);

    if (type === "video") {
      setBlobsVisible(false);
      video.muted = background.videoMuted !== false;
      video.defaultMuted = video.muted;
      if (!background.videoUrl) {
        stopVideo(video);
        applyGradient(GT.GRADIENTS[0]);
        return;
      }
      if (video.src !== background.videoUrl) {
        video.src = background.videoUrl;
        video.dataset.active = "true";
      }
      video.hidden = false;
      bindVisibility();
      syncVideoPlayback();
      return;
    }

    if (type === "image") {
      setBlobsVisible(false);
      const source = background.imageUrl || await loadImageDataUrl();
      if (source) {
        if (image.src !== source) image.src = source;
        image.hidden = false;
      } else {
        applyGradient(GT.GRADIENTS[0]);
      }
      return;
    }

    if (type === "solid") {
      setBlobsVisible(false);
      bg.querySelector(".bg-base").style.setProperty("--bg-base", background.solid || "#0f1220");
      return;
    }

    applyGradient(type === "daily" ? pickDaily() : gradientById(background.gradientId));
  }

  return { apply, saveImageFile, clearImage, gradientById };
})();