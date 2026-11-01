/* GlassTab — background engine: mesh gradients, solid, image, daily rotate.
   Custom uploaded images are downscaled and kept in chrome.storage.local
   (too large for the sync quota). */

GT.backgrounds = (function () {
  const IMAGE_KEY = "bgImageDataUrl";
  const MAX_DIM = 1920;

  function gradientById(id) {
    return GT.GRADIENTS.find((g) => g.id === id) || GT.GRADIENTS[0];
  }

  function pickDaily() {
    const day = Math.floor(Date.now() / 86400000);
    return GT.GRADIENTS[day % GT.GRADIENTS.length];
  }

  function applyGradient(grad) {
    const bg = document.getElementById("bg");
    bg.querySelector(".bg-base").style.setProperty("--bg-base", grad.base);
    const blobs = bg.querySelectorAll(".blob");
    ["--b1", "--b2", "--b3", "--b4"].forEach((v, i) => {
      bg.style.setProperty(v, grad.blobs[i]);
    });
    blobs.forEach((b) => { b.style.visibility = ""; });
    // re-trigger a soft fade when palette changes
    const layer = bg.querySelector(".bg-blobs");
    layer.style.animation = "none";
    void layer.offsetWidth;
    layer.style.animation = "";
  }

  async function loadImageDataUrl() {
    try {
      return (await chrome.storage.local.get(IMAGE_KEY))[IMAGE_KEY] || "";
    } catch {
      return "";
    }
  }

  async function saveImageFile(file) {
    const dataUrl = await downscale(file);
    const store = {};
    store[IMAGE_KEY] = dataUrl;
    await chrome.storage.local.set(store);
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
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function apply(settings) {
    const bg = document.getElementById("bg");
    const imgEl = document.getElementById("bg-image");
    const blobs = bg.querySelectorAll(".blob");
    bg.style.setProperty("--dim", String(settings.background.dim ?? 0.25));

    const type = settings.background.type;

    if (type === "image") {
      blobs.forEach((b) => { b.style.visibility = "hidden"; });
      if (settings.background.imageUrl) {
        imgEl.src = settings.background.imageUrl;
        imgEl.hidden = false;
      } else {
        const data = await loadImageDataUrl();
        if (data) {
          imgEl.src = data;
          imgEl.hidden = false;
        } else {
          imgEl.hidden = true;
          applyGradient(GT.GRADIENTS[0]); // fallback while empty
        }
      }
      return;
    }

    imgEl.hidden = true;

    if (type === "solid") {
      blobs.forEach((b) => { b.style.visibility = "hidden"; });
      bg.querySelector(".bg-base").style.setProperty("--bg-base", settings.background.solid || "#0f1220");
      return;
    }

    const grad = type === "daily" ? pickDaily() : gradientById(settings.background.gradientId);
    applyGradient(grad);
  }

  return { apply, saveImageFile, clearImage, gradientById };
})();
