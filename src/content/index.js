import { state, PANEL_ID, MARKER_ATTR } from "./state.js";
import { getSite, getVideoId, isVideoPage, waitForElement } from "./utils.js";
import { stopSubtitles } from "./subtitles.js";
import { createPanel } from "./panel.js";

function removePanel() {
  stopSubtitles();
  document.querySelectorAll(`[${MARKER_ATTR}]`).forEach((el) => el.remove());
}

async function handleVideoPage() {
  removePanel();

  const site = getSite();

  if (site === "youtube") {
    const sidebar =
      (await waitForElement("#secondary", 8000)) ||
      (await waitForElement("#related", 4000));

    if (!sidebar) {
      console.warn("[Jusur] Sidebar not found");
      return;
    }

    if (document.getElementById(PANEL_ID) || state.dismissed) return;

    sidebar.prepend(createPanel());
    console.log("[Jusur] Panel injected into", sidebar.id);
  }

  startReinjectionObserver();
}

function startReinjectionObserver() {
  if (state.reinjectionObserver) state.reinjectionObserver.disconnect();

  const site = getSite();
  const target =
    site === "youtube"
      ? document.querySelector("ytd-app") || document.documentElement
      : document.documentElement;

  state.reinjectionObserver = new MutationObserver(() => {
    if (state.dismissed || !isVideoPage()) return;
    if (!document.getElementById(PANEL_ID)) {
      if (site === "youtube") {
        const sidebar =
          document.querySelector("#secondary") ||
          document.querySelector("#related");
        if (sidebar) {
          sidebar.prepend(createPanel());
          console.log("[Jusur] Panel re-injected (destroyed by YT)");
        }
      }
    }
  });

  state.reinjectionObserver.observe(target, { childList: true, subtree: true });
}

let debounceTimer = null;

function onNavigate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!isVideoPage()) {
      removePanel();
      state.currentVideoId = null;
      state.dismissed = false;
      if (state.reinjectionObserver) state.reinjectionObserver.disconnect();
      return;
    }

    const videoId = getVideoId();
    if (!videoId) return;

    if (videoId !== state.currentVideoId) {
      state.currentVideoId = videoId;
      state.dismissed = false;
      handleVideoPage();
    }
  }, 300);
}

// 1. Background script sends these on every navigation (most reliable)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "YT_NAVIGATION") {
    onNavigate();
  }
});

// 2. YouTube's own SPA events (backup)
document.addEventListener("yt-navigate-finish", onNavigate);
document.addEventListener("yt-page-data-updated", onNavigate);

// 3. Initial page load
onNavigate();
