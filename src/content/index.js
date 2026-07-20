import { state, PANEL_ID, MARKER_ATTR } from "./state.js";
import { getSite, getVideoId, isVideoPage, waitForElement } from "./utils.js";
import { stopSubtitles } from "./subtitles.js";
import { createPanel, loadTargetLang } from "./panel.js";

// Restore the persisted translation language before any panel is injected.
loadTargetLang();

function removePanel() {
  stopSubtitles();
  document.querySelectorAll(`[${MARKER_ATTR}]`).forEach((el) => el.remove());
}

// Instagram's DOM has no stable ids, so locate the post by walking up from the
// reel <video> until we reach an ancestor wide enough to span both the video
// and the caption column (i.e. the whole post), stopping before the full-width
// page wrappers.
function findInstagramPost(video) {
  if (!video) return null;
  const videoWidth = video.getBoundingClientRect().width;
  let el = video.parentElement;
  while (el && el !== document.body) {
    const w = el.getBoundingClientRect().width;
    if (w > videoWidth + 200 && w < window.innerWidth - 8) return el;
    el = el.parentElement;
  }
  return null;
}

// Place the panel at the top-right corner of the post, just outside its right
// edge. It is absolutely positioned in the document (top/left include the
// scroll offset), so it stays attached to the post and scrolls away with the
// page rather than floating over it. Only re-aligns on resize (which shifts the
// centered post horizontally). The listener removes itself once the panel
// leaves the DOM.
function anchorInstagramPanel(panel) {
  const GAP = 16;
  function reposition() {
    if (!document.contains(panel)) {
      window.removeEventListener("resize", reposition);
      return;
    }
    const post = findInstagramPost(document.querySelector("video"));
    if (!post) return;
    const rect = post.getBoundingClientRect();
    const width = panel.offsetWidth || 360;
    const maxLeft = window.scrollX + window.innerWidth - width - 8;
    const left = Math.min(rect.right + window.scrollX + GAP, maxLeft);
    panel.style.left = Math.max(window.scrollX + 8, left) + "px";
    panel.style.top = rect.top + window.scrollY + "px";
  }
  window.addEventListener("resize", reposition);
  reposition();
  // Re-run after layout settles (Instagram finishes rendering asynchronously).
  setTimeout(reposition, 300);
}

function injectInstagramPanel() {
  const panel = createPanel();
  document.body.appendChild(panel);
  anchorInstagramPanel(panel);
  return panel;
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
  } else if (site === "instagram") {
    // Instagram's reel layout has no stable sidebar container, so the panel is
    // pinned to the top-right corner of the post. Wait for the video so we
    // don't inject on a not-yet-loaded page.
    await waitForElement("video", 8000);

    if (document.getElementById(PANEL_ID) || state.dismissed) return;

    injectInstagramPanel();
    console.log("[Jusur] Panel injected (Instagram)");
  }

  startReinjectionObserver();
}

function startReinjectionObserver() {
  if (state.reinjectionObserver) state.reinjectionObserver.disconnect();

  const site = getSite();
  const target =
    site === "youtube"
      ? document.querySelector("ytd-app") || document.documentElement
      : document.querySelector("main") || document.documentElement;

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
      } else if (site === "instagram" && document.querySelector("video")) {
        injectInstagramPanel();
        console.log("[Jusur] Panel re-injected (Instagram)");
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
