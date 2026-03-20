import { state, MARKER_ATTR } from "./state.js";
import { EYE_OFF_SVG, LOGO_SVG, CLOSE_SVG } from "./icons.js";
import { parseTimestamp, getSite } from "./utils.js";

export function stopSubtitles() {
  if (state.subtitleRafId) {
    cancelAnimationFrame(state.subtitleRafId);
    state.subtitleRafId = null;
  }
  if (state.timelineRafId) {
    cancelAnimationFrame(state.timelineRafId);
    state.timelineRafId = null;
  }
  if (state.subtitleOverlay) {
    state.subtitleOverlay.remove();
    state.subtitleOverlay = null;
  }
  state.subtitleVisible = true;
  state.showOriginal = false;
}

export function startSubtitles(segments) {
  stopSubtitles();

  const site = getSite();
  let video, container;

  if (site === "youtube") {
    video = document.querySelector("video");
    container = document.querySelector(".html5-video-player");
  }

  if (!video || !container) {
    console.warn("[Jusur] Video or container element not found");
    return;
  }

  const parsed = segments.map((seg) => ({
    from: parseTimestamp(seg.timestamps.from),
    to: parseTimestamp(seg.timestamps.to),
    translation: seg.translation || seg.text,
    original: seg.text,
  }));

  const posState = {
    bottom: 60,
    centerX: null,
  };

  state.subtitleOverlay = document.createElement("div");
  state.subtitleOverlay.className = "jusur-subtitle-overlay";
  state.subtitleOverlay.setAttribute(MARKER_ATTR, "true");

  state.subtitleOverlay.innerHTML = `
    <div class="jusur-subtitle-body">
      <div class="jusur-subtitle-text"></div>
    </div>
    <div class="jusur-subtitle-toolbar">
      <span class="jusur-subtitle-toolbar-label">
        ${LOGO_SVG} Jusur
      </span>
      <button class="jusur-subtitle-close-btn" title="Close">
        ${CLOSE_SVG}
      </button>
    </div>
  `;

  const pos = window.getComputedStyle(container).position;
  if (pos === "static") container.style.position = "relative";

  function applyState() {
    state.subtitleOverlay.style.bottom = posState.bottom + "px";
    state.subtitleOverlay.style.left =
      posState.centerX === null ? "50%" : posState.centerX + "px";
    state.subtitleOverlay.style.transform = "translateX(-50%)";
  }
  applyState();

  container.appendChild(state.subtitleOverlay);

  // Close button
  state.subtitleOverlay
    .querySelector(".jusur-subtitle-close-btn")
    .addEventListener("click", () => {
      state.subtitleVisible = false;
      const toggleBtn = document.querySelector(".jusur-toggle-subtitles");
      if (toggleBtn) {
        toggleBtn.innerHTML = EYE_OFF_SVG;
        toggleBtn.title = "Show subtitles";
      }
    });

  // Drag to move
  state.subtitleOverlay.addEventListener("mousedown", (e) => {
    if (e.target.closest(".jusur-subtitle-close-btn")) return;
    e.preventDefault();
    const containerRect = container.getBoundingClientRect();
    const overlayRect = state.subtitleOverlay.getBoundingClientRect();
    const halfW = overlayRect.width / 2;
    const startCenterX =
      posState.centerX !== null
        ? posState.centerX
        : overlayRect.left + halfW - containerRect.left;
    const startBottom = posState.bottom;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const overlayHeight = overlayRect.height;

    document.body.style.userSelect = "none";

    function onMove(ev) {
      const dx = ev.clientX - startMouseX;
      const dy = ev.clientY - startMouseY;
      posState.centerX = Math.max(
        halfW,
        Math.min(startCenterX + dx, containerRect.width - halfW),
      );
      posState.bottom = Math.max(
        0,
        Math.min(startBottom - dy, containerRect.height - overlayHeight),
      );
      applyState();
    }
    function onUp() {
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  const textEl = state.subtitleOverlay.querySelector(".jusur-subtitle-text");

  function tick() {
    const t = video.currentTime;
    const seg = parsed.find((s) => t >= s.from && t < s.to);
    if (seg && state.subtitleVisible) {
      textEl.textContent = state.showOriginal ? seg.original : seg.translation;
      state.subtitleOverlay.style.display = "";
    } else {
      state.subtitleOverlay.style.display = "none";
    }
    state.subtitleRafId = requestAnimationFrame(tick);
  }
  state.subtitleRafId = requestAnimationFrame(tick);

  console.log("[Jusur] Subtitles started with", parsed.length, "segments");
}
