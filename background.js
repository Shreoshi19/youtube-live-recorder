// Chrome extension service worker.
let activeTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'RECORDING_STARTED':
      activeTabId = sender.tab ? sender.tab.id : null;
      if (activeTabId !== null) {
        chrome.action.setBadgeText({ text: 'REC', tabId: activeTabId });
        chrome.action.setBadgeBackgroundColor({ color: '#cc0000', tabId: activeTabId });
      }
      chrome.power.requestKeepAwake('system');
      sendResponse({ ok: true });
      break;

    case 'RECORDING_STOPPED':
      if (activeTabId !== null) {
        chrome.action.setBadgeText({ text: '', tabId: activeTabId });
      }
      chrome.power.releaseKeepAwake();
      activeTabId = null;
      sendResponse({ ok: true });
      break;

    case 'DOWNLOAD_RECORDING':
      try {
        chrome.downloads.download(
          { url: msg.url, filename: msg.filename, saveAs: false },
          () => {
            const ok = !chrome.runtime.lastError;
            if (ok) {
              setTimeout(() => URL.revokeObjectURL(msg.url), 120000);
            }
            sendResponse({ ok });
          }
        );
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
      return true; // async response

    default:
      sendResponse({ ok: false, error: 'Unknown message type' });
  }
});