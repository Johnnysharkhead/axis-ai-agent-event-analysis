const HLS_SCRIPT_ID = "dynamic-hls-script";
const HLS_CDN_URL = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";

let loadPromise = null;

export function loadHls() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("HLS cannot load outside the browser"));
  }

  if (window.Hls) {
    return Promise.resolve(window.Hls);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(HLS_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.Hls) {
          resolve(window.Hls);
        } else {
          reject(new Error("HLS library failed to expose a global constructor"));
        }
      });
      existingScript.addEventListener("error", () => {
        loadPromise = null;
        reject(new Error("Failed loading the HLS script"));
      });
      return;
    }

    const script = document.createElement("script");
    script.id = HLS_SCRIPT_ID;
    script.src = HLS_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.Hls) {
        resolve(window.Hls);
      } else {
        loadPromise = null;
        reject(new Error("HLS library failed to expose a global constructor"));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed loading the HLS script"));
    };

    document.body.appendChild(script);
  });

  return loadPromise;
}
