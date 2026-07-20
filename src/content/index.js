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

// Instagram renders the whole post (video + caption/comments column) as a
// direct child <div> of the <main role="main"> landmark. Its class names are
// minified and unstable, but the landmark is semantic, so locate the post as
// the video's ancestor that is a direct child of <main>.
function findInstagramPost() {
  const video = document.querySelector("video");
  return (video && video.closest("main > div")) || null;
}

// Pin the panel just right of the post, in the empty margin between the post
// and the viewport edge. It is absolutely positioned in the document (top/left
// include the scroll offset), so it scrolls with the page instead of floating
// over it. Re-anchors when the window or the post changes size — Instagram
// lays the post out asynchronously and its width varies with the video's
// aspect ratio. If the margin is too narrow to fit the panel, it is placed
// below the post rather than overlapping it. The listeners remove themselves
// once the panel leaves the DOM.
function anchorInstagramPanel(panel, post) {
  const GAP = 16;
  const resizeObserver = new ResizeObserver(() => reposition());
  function reposition() {
    if (!document.contains(panel)) {
      window.removeEventListener("resize", reposition);
      resizeObserver.disconnect();
      return;
    }
    if (!document.contains(post)) {
      const replacement = findInstagramPost();
      if (!replacement) return;
      post = replacement;
      resizeObserver.observe(post);
    }
    const rect = post.getBoundingClientRect();
    // The post div has inner padding, so its rect starts above the visible
    // card, the <video> top matches where the post actually starts.
    const video = post.querySelector("video");
    const top = video ? video.getBoundingClientRect().top : rect.top;
    const width = panel.offsetWidth || 360;
    const fitsRight =
      rect.right + GAP + width <= document.documentElement.clientWidth - 8;
    if (fitsRight) {
      panel.style.left = rect.right + window.scrollX + GAP + "px";
      panel.style.top = top + window.scrollY + "px";
    } else {
      panel.style.left = rect.left + window.scrollX + "px";
      panel.style.top = rect.bottom + window.scrollY + GAP + "px";
    }
  }
  resizeObserver.observe(post);
  resizeObserver.observe(document.documentElement);
  window.addEventListener("resize", reposition);
  reposition();
}

function injectInstagramPanel() {
  const post = findInstagramPost();
  if (!post) {
    console.warn("[Jusur] Instagram post container not found");
    return null;
  }
  const panel = createPanel();
  document.body.appendChild(panel);
  anchorInstagramPanel(panel, post);
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
    // Instagram has no sidebar container, so the panel is pinned in the
    // margin right of the post. Wait for the video so we don't inject on a
    // not-yet-loaded page.
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
