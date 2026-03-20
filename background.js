chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId === 0) {
      chrome.tabs.sendMessage(details.tabId, {
        type: "YT_NAVIGATION",
        url: details.url,
      });
    }
  },
  { url: [{ hostContains: "youtube.com" }] },
);

chrome.webNavigation.onCompleted.addListener(
  (details) => {
    if (details.frameId === 0) {
      chrome.tabs.sendMessage(details.tabId, {
        type: "YT_NAVIGATION",
        url: details.url,
      });
    }
  },
  { url: [{ hostContains: "youtube.com" }] },
);

// Uses a keepalive interval to prevent the MV3 service worker from being
// terminated during long-running transcription + translation requests.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "transcribe") {
    const keepAlive = setInterval(
      () => chrome.runtime.getPlatformInfo(),
      20000,
    );
    fetch("http://127.0.0.1:8765/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: message.url }),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
      .finally(() => clearInterval(keepAlive));
    return true;
  }
});
