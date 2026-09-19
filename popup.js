'use strict';

const toggle = document.getElementById('toggle');
const msg = document.getElementById('msg');
const liveDot = document.getElementById('liveDot');
const recDot = document.getElementById('recDot');
const liveText = document.getElementById('liveText');
const recText = document.getElementById('recText');
const elapsed = document.getElementById('elapsed');

let status = null;
let ticker = null;

function setLive(ok) {
  liveDot.className = 'dot ' + (ok ? 'green' : 'gray');
  liveText.textContent = ok ? 'yes' : 'no';
}

function setRec(ok) {
  recDot.className = 'dot ' + (ok ? 'red' : 'gray');
  recText.textContent = ok ? 'recording' : 'idle';
  toggle.textContent = ok ? 'Stop and save' : 'Start recording';
  toggle.classList.toggle('stop', ok);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

async function refreshStatus() {
  const tab = await getActiveTab();
  if (!tab || !tab.url || !tab.url.includes('youtube.com')) {
    status = null;
    setLive(false);
    setRec(false);
    toggle.disabled = true;
    showMsg('Open a YouTube video in the active tab.', 'info');
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
    status = res;
    setLive(res.live);
    setRec(res.recording);
    toggle.disabled = false;
    elapsed.textContent = fmt(res.seconds);
    if (!res.recording) {
      showMsg(res.live ? 'Live stream detected. Press Start to record.' : 'Video found. Press Start to record.', 'info');
    }
  } catch (e) {
    status = null;
    setLive(false);
    setRec(false);
    toggle.disabled = true;
    showMsg('Extension not loaded on this page yet. Reload the YouTube tab.', 'error');
  }
}

function showMsg(text, kind) {
  msg.textContent = text;
  msg.className = 'msg ' + (kind || 'info');
}

function updateElapsed() {
  if (status && status.recording) {
    status.seconds = Math.round((Date.now() - status.startedAt) / 1000);
    elapsed.textContent = fmt(status.seconds);
  }
}

toggle.addEventListener('click', async () => {
  const tab = await getActiveTab();
  toggle.disabled = true;
  try {
    if (status && status.recording) {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'STOP' });
      if (res && res.ok) {
        showMsg(
          `Saved "${res.filename}" (${(res.sizeBytes / 1048576).toFixed(1)} MB, ${fmt(res.seconds)}).`,
          'info'
        );
      } else if (res && res.error) {
        showMsg('Stop failed: ' + res.error, 'error');
      }
    } else {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'START' });
      if (res && res.ok) {
        showMsg(
          'Recording… press Stop when finished.' + (res.audioViaWebAudio ? '' : ''),
          'info'
        );
      } else if (res && res.error) {
        showMsg('Start failed: ' + res.error, 'error');
      } else {
        showMsg('Start failed: no response from the page.', 'error');
      }
    }
  } catch (e) {
    showMsg('Cannot reach the page. Reload the YouTube tab.', 'error');
  }
  toggle.disabled = false;
  await refreshStatus();
});

document.addEventListener('DOMContentLoaded', () => {
  refreshStatus();
  ticker = setInterval(() => {
    updateElapsed();
  }, 1000);
});