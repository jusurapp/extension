import { state, PANEL_ID, MARKER_ATTR } from "./state.js";
import { TRANSLATE_SVG, EYE_SVG, EYE_OFF_SVG, LOGO_SVG } from "./icons.js";
import { parseTimestamp, formatTime, getSite } from "./utils.js";
import { startSubtitles } from "./subtitles.js";

const LANG_STORAGE_KEY = "jusurTargetLang";

// Languages the video's Arabic audio can be translated into.
const LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Turkish",
  "Russian",
  "Urdu",
  "Indonesian",
  "Chinese",
];

// Load the persisted language choice and reflect it in the UI. Called once at
// content-script startup so the selection survives page refreshes.
export function loadTargetLang() {
  try {
    chrome.storage.local.get(LANG_STORAGE_KEY, (res) => {
      const saved = res && res[LANG_STORAGE_KEY];
      if (saved && LANGUAGES.includes(saved)) {
        state.targetLang = saved;
        refreshLangUI();
      }
    });
  } catch (_) {
    /* storage unavailable — fall back to the in-memory default */
  }
}

function saveTargetLang(lang) {
  try {
    chrome.storage.local.set({ [LANG_STORAGE_KEY]: lang });
  } catch (_) {
    /* ignore persistence failures */
  }
}

// Sync any visible panel to the current state.targetLang.
function refreshLangUI() {
  const label = document.querySelector(".jusur-lang-badge-label");
  if (label) label.textContent = state.targetLang;
  document.querySelectorAll(".jusur-lang-option").forEach((o) => {
    o.classList.toggle("jusur-active", o.dataset.lang === state.targetLang);
  });
  const desc = document.querySelector("#jusur-panel-body .description");
  if (desc)
    desc.textContent = `Translate this video's audio from Arabic to ${state.targetLang}.`;
}

export function createPanel() {
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.setAttribute(MARKER_ATTR, "true");
  // Instagram has no sidebar; the panel is pinned beside the post
  // (see anchorInstagramPanel) and this class sizes/positions it for that.
  if (getSite() === "instagram") panel.classList.add("jusur-ig-panel");

  panel.innerHTML = `
    <div id="jusur-panel-header">
      <div class="jusur-logo">
        ${LOGO_SVG}
        <span class="logo-name">Jusur</span>
      </div>
      <button id="jusur-panel-close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>
    <div id="jusur-panel-body">
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
      <p class="description">Translate this video's audio from Arabic to ${state.targetLang}.</p>
      <button id="jusur-translate-btn">
        ${TRANSLATE_SVG}
        Translate
      </button>
    </div>
    <div id="jusur-panel-footer">
      <div class="jusur-lang-selector">
        <button class="jusur-lang-badge" id="jusur-lang-badge" title="Translation language">
          <span class="jusur-lang-badge-label">${state.targetLang}</span>
        </button>
        <div class="jusur-lang-menu" id="jusur-lang-menu"></div>
      </div>
      <button class="jusur-footer-btn" id="jusur-btn-download" style="display:none">
        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        Download
      </button>
      <button class="jusur-footer-btn" id="jusur-btn-search" style="display:none">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        Search
      </button>
      <button class="jusur-footer-btn" id="jusur-btn-settings">
        <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.22-.07.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        Settings
      </button>
    </div>
  `;

  panel.querySelector("#jusur-panel-close").addEventListener("click", () => {
    state.dismissed = true;
    panel.remove();
  });

  panel
    .querySelector("#jusur-translate-btn")
    .addEventListener("click", handleTranslate);

  setupLangSelector(panel);

  return panel;
}

function setupLangSelector(panel) {
  const badge = panel.querySelector("#jusur-lang-badge");
  const menu = panel.querySelector("#jusur-lang-menu");
  const label = panel.querySelector(".jusur-lang-badge-label");

  menu.innerHTML = LANGUAGES.map(
    (lang) =>
      `<button class="jusur-lang-option${lang === state.targetLang ? " jusur-active" : ""}" data-lang="${lang}">${lang}</button>`,
  ).join("");

  const closeMenu = () => {
    menu.classList.remove("jusur-open");
    document.removeEventListener("click", onOutsideClick);
  };
  const onOutsideClick = (e) => {
    if (!menu.contains(e.target) && e.target !== badge) closeMenu();
  };

  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle("jusur-open");
    if (isOpen) {
      document.addEventListener("click", onOutsideClick);
    } else {
      document.removeEventListener("click", onOutsideClick);
    }
  });

  menu.querySelectorAll(".jusur-lang-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      const lang = opt.dataset.lang;
      closeMenu();
      if (lang === state.targetLang) return;

      state.targetLang = lang;
      saveTargetLang(lang);
      label.textContent = lang;
      menu.querySelectorAll(".jusur-lang-option").forEach((o) => {
        o.classList.toggle("jusur-active", o.dataset.lang === lang);
      });

      // If subtitles are already showing, re-run the translation in the new
      // language; otherwise the choice applies to the next Translate click.
      if (document.querySelector(".jusur-timeline")) handleTranslate();
    });
  });
}

function showLoading(message) {
  const body = document.getElementById("jusur-panel-body");
  if (!body) return;
  body.innerHTML = `
    <div class="jusur-spinner"></div>
    <p class="description">${message}</p>
  `;
  // Drive the spin with the Web Animations API instead of a CSS keyframe. Some
  // host pages (e.g. Instagram) disable CSS animations globally, which freezes
  // a keyframe-based spinner; a script-driven animation can't be overridden.
  const spinner = body.querySelector(".jusur-spinner");
  if (spinner && spinner.animate) {
    spinner.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: 800, iterations: Infinity, easing: "linear" },
    );
  }
}

function restorePanel() {
  const body = document.getElementById("jusur-panel-body");
  if (!body) return;
  body.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
    <p class="description">Translate this video's audio from Arabic to ${state.targetLang}.</p>
    <button id="jusur-translate-btn">
      ${TRANSLATE_SVG}
      Translate
    </button>
  `;
  body
    .querySelector("#jusur-translate-btn")
    .addEventListener("click", handleTranslate);
}

function showAppNotRunning() {
  const body = document.getElementById("jusur-panel-body");
  if (!body) return;
  body.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" fill="currentColor" style="color:#f59e0b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
    <p class="description">The Jusur desktop app is not running. Open it and try again.</p>
    <a class="jusur-download-link" href="https://jusur.video" target="_blank">Download Jusur</a>
    <button id="jusur-translate-btn" style="margin-top:4px">
      ${TRANSLATE_SVG}
      Try again
    </button>
  `;
  body
    .querySelector("#jusur-translate-btn")
    .addEventListener("click", handleTranslate);
}

async function handleTranslate() {
  showLoading("Translating\u2026");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "transcribe",
      url: window.location.href,
      lang: state.targetLang,
    });
    if (response.ok) {
      startSubtitles(response.data.segments);
      showSubtitlesActive(response.data.segments);
    } else if (response.error && response.error.includes("Failed to fetch")) {
      console.error("[Jusur] App not running:", response.error);
      showAppNotRunning();
    } else {
      console.error("[Jusur] Server error:", response.error);
      restorePanel();
    }
  } catch (err) {
    console.error("[Jusur] Failed to reach Jusur:", err);
    showAppNotRunning();
  }
}

function showSubtitlesActive(segments) {
  const body = document.getElementById("jusur-panel-body");
  if (!body) return;

  const parsed = segments.map((seg) => ({
    from: parseTimestamp(seg.timestamps.from),
    to: parseTimestamp(seg.timestamps.to),
    translation: seg.translation || seg.text,
    original: seg.text,
  }));

  const rowsHtml = parsed
    .map(
      (seg, i) =>
        `<div class="jusur-timeline-row" data-index="${i}">` +
        `<span class="jusur-timeline-timestamp">${formatTime(seg.from)}</span>` +
        `<span class="jusur-timeline-text">${seg.translation}</span>` +
        `</div>`,
    )
    .join("");

  const downloadFooterBtn = document.getElementById("jusur-btn-download");
  if (downloadFooterBtn) downloadFooterBtn.style.display = "";

  body.innerHTML = `
    <div class="jusur-subtitles-toolbar">
      <div class="jusur-subtitles-search">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <input type="text" class="jusur-subtitles-search-input" placeholder="Search" />
      </div>
      <div class="jusur-subtitles-actions">
        <button class="jusur-toggle-original" title="Show Arabic">\u0639</button>
        <button class="jusur-toggle-subtitles" title="Hide subtitles">${EYE_SVG}</button>
      </div>
    </div>
    <div class="jusur-timeline-box">
      <div class="jusur-timeline">${rowsHtml}</div>
    </div>
  `;
  body.style.padding = "0";
  body.style.gap = "0";
  body.style.justifyContent = "flex-start";
  body.style.alignItems = "stretch";

  const searchInput = body.querySelector(".jusur-subtitles-search-input");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    rows.forEach((row, i) => {
      const haystack = (
        state.showOriginal ? parsed[i].original : parsed[i].translation
      ).toLowerCase();
      row.style.display = !q || haystack.includes(q) ? "" : "none";
    });
  });

  const originalBtn = body.querySelector(".jusur-toggle-original");
  originalBtn.addEventListener("click", () => {
    state.showOriginal = !state.showOriginal;
    originalBtn.classList.toggle("jusur-active", state.showOriginal);
    originalBtn.title = state.showOriginal ? "Show English" : "Show Arabic";
    if (state.subtitleOverlay)
      state.subtitleOverlay.classList.toggle("jusur-arabic", state.showOriginal);
    rows.forEach((row, i) => {
      row.querySelector(".jusur-timeline-text").textContent = state.showOriginal
        ? parsed[i].original
        : parsed[i].translation;
    });
  });

  const toggleBtn = body.querySelector(".jusur-toggle-subtitles");
  toggleBtn.addEventListener("click", () => {
    state.subtitleVisible = !state.subtitleVisible;
    toggleBtn.innerHTML = state.subtitleVisible ? EYE_SVG : EYE_OFF_SVG;
    toggleBtn.title = state.subtitleVisible ? "Hide subtitles" : "Show subtitles";
  });

  const rows = body.querySelectorAll(".jusur-timeline-row");
  const video = document.querySelector("video");
  if (!video) return;

  rows.forEach((row, i) => {
    row.addEventListener("click", () => {
      video.currentTime = parsed[i].from;
    });
  });

  let lastActiveIdx = -1;

  function timelineTick() {
    const t = video.currentTime;
    let activeIdx = -1;
    for (let i = 0; i < parsed.length; i++) {
      if (t >= parsed[i].from && t < parsed[i].to) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx !== lastActiveIdx) {
      if (lastActiveIdx >= 0)
        rows[lastActiveIdx].classList.remove("jusur-active");
      if (activeIdx >= 0) {
        rows[activeIdx].classList.add("jusur-active");
        rows[activeIdx].scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
      lastActiveIdx = activeIdx;
    }
    state.timelineRafId = requestAnimationFrame(timelineTick);
  }
  state.timelineRafId = requestAnimationFrame(timelineTick);
}
