export function getSite() {
  const host = window.location.hostname;
  if (host.includes("youtube.com")) return "youtube";
  return null;
}

export function getVideoId() {
  const site = getSite();
  if (site === "youtube") {
    return new URLSearchParams(window.location.search).get("v");
  }
  return null;
}

export function isVideoPage() {
  const site = getSite();
  if (site === "youtube") return window.location.pathname === "/watch";
  return false;
}

export function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    let timeoutId;

    const observer = new MutationObserver((_, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        clearTimeout(timeoutId);
        resolve(el);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

export function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimestamp(ts) {
  const [h, m, s] = ts.replace(",", ".").split(":");
  return +h * 3600 + +m * 60 + parseFloat(s);
}
