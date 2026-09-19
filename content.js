// Content script: runs on youtube.com pages.
(function () {
  'use strict';

  let recorder = null;
  let chunks = [];
  let mimeType = '';
  let activeStream = null;
  let audioCtx = null;
  let mediaSrcNode = null;
  let recordingStartedAt = 0;
  let lastVideo = null;

  function getVideo() {
    return (
      document.querySelector('#movie_player video') ||
      document.querySelector('video')
    );
  }

  function pickMimeType() {
    const candidates = [
      'video/mp4',
      'video/webm;codecs="vp9,opus"',
      'video/webm;codecs="vp8,opus"',
      'video/webm;codecs="vp9"',
      'video/webm'
    ];
    for (const c of candidates) {
      try {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
          return c;
        }
      } catch (e) { /* ignore */ }
    }
    return '';
  }

  function notifyBackground(type, payload) {
    try {
      chrome.runtime.sendMessage({ type, ...(payload || {}) });
    } catch (e) { /* context may be going away */ }
  }

  function sanitizeFilename(name) {
    const base = (name || 'youtube-live')
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return base || 'youtube-live';
  }

  async function ensureAudioTrack(stream, video) {
    if (stream.getAudioTracks().length > 0) {
      return { viaWebAudio: false, reason: '' };
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      if (audioCtx.state !== 'running') {
        throw new Error('audio-suspended');
      }
      mediaSrcNode = audioCtx.createMediaElementSource(video);
      mediaSrcNode.connect(audioCtx.destination); // keep speakers working
      const dest = audioCtx.createMediaStreamDestination();
      mediaSrcNode.connect(dest);
      stream.addTrack(dest.stream.getAudioTracks()[0]);
      return { viaWebAudio: true, reason: '' };
    } catch (err) {
      return { viaWebAudio: false, reason: String(err) };
    }
  }

  async function startRecording() {
    if (recorder) {
      return { ok: false, error: 'Already recording' };
    }

    const video = getVideo();
    if (!video) {
      return { ok: false, error: 'No <video> element found on this page. Open the live video first.' };
    }
    if (!video.captureStream) {
      return { ok: false, error: 'captureStream() not supported in this browser.' };
    }

    lastVideo = video;

    let stream;
    try {
      stream = video.captureStream();
    } catch (err) {
      return { ok: false, error: 'captureStream() failed: ' + err.message };
    }

    if (stream.getVideoTracks().length === 0) {
      return { ok: false, error: 'Captured stream has no video track.' };
    }

    const audio = await ensureAudioTrack(stream, video);
    mimeType = pickMimeType();

    let bitsPerSecond = 6000000;
    const vTrack = stream.getVideoTracks()[0];
    const settings = vTrack.getSettings ? vTrack.getSettings() : {};
    if (settings.width && settings.width >= 1920) bitsPerSecond = 10000000;
    else if (settings.width && settings.width >= 1280) bitsPerSecond = 7000000;

    try {
      const opts = { videoBitsPerSecond: bitsPerSecond };
      if (mimeType) opts.mimeType = mimeType;
      recorder = new MediaRecorder(stream, opts);
    } catch (err) {
      try {
        recorder = new MediaRecorder(stream);
        mimeType = recorder.mimeType;
      } catch (err2) {
        return { ok: false, error: 'MediaRecorder unavailable: ' + err2.message };
      }
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = (e) => {
      notifyBackground('RECORDING_ERROR', { error: String(e.error || e.message || 'recorder error') });
    };

    recordingStartedAt = Date.now();
    recorder.start(5000);

    notifyBackground('RECORDING_STARTED', {});
    return {
      ok: true,
      audioViaWebAudio: audio.viaWebAudio,
      audioReason: audio.reason,
      mimeType: recorder.mimeType,
      bitrate: bitsPerSecond,
      live: video.duration === Infinity
    };
  }

  function stopRecording() {
    if (!recorder) {
      return Promise.resolve({ ok: false, error: 'Not recording' });
    }

    return new Promise((resolve) => {
      const rec = recorder;
      recorder = null;
      const startTs = recordingStartedAt;

      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        chunks = [];
        const ext = mimeType.indexOf('video/mp4') === 0 ? 'mp4' : 'webm';
        const title = document.title ? document.title.replace(/ - YouTube.*$/, '') : 'youtube';
        const stamp = tsToISO(startTs).replace(/[-:T]/g, '').slice(0, 14);
        const filename = sanitizeFilename(title) + '_' + stamp + '.' + ext;

        const url = URL.createObjectURL(blob);
        const sizeBytes = blob.size;

        chrome.runtime.sendMessage(
          { type: 'DOWNLOAD_RECORDING', url, filename, sizeBytes },
          () => {
            notifyBackground('RECORDING_STOPPED', {});
            if (audioCtx) {
              if (audioCtx.state === 'running') audioCtx.close().catch(() => {});
              audioCtx = null;
            }
            if (activeStream) {
              activeStream.getTracks().forEach((t) => t.stop());
              activeStream = null;
            }
            mediaSrcNode = null;
            resolve({
              ok: !chrome.runtime.lastError,
              filename,
              sizeBytes,
              seconds: Math.round((Date.now() - startTs) / 1000)
            });
          }
        );
      };

      rec.stop();
    });
  }

  function getStatus() {
    const video = getVideo();
    let live = false;
    if (video) {
      live = video.duration === Infinity;
    }
    if (!live) {
      live = !!document.querySelector(
        'yt-live-chip-bar, #info-contents ytd-badge-supported-renderer, live-chat-header'
      );
    }
    return {
      recording: !!recorder,
      live: !!video && live,
      hasVideo: !!video,
      startedAt: recordingStartedAt,
      seconds: recordingStartedAt ? Math.round((Date.now() - recordingStartedAt) / 1000) : 0
    };
  }

  function tsToISO(ts) {
    const d = new Date(ts);
    return d.toISOString();
  }

  // Auto-stop when the active stream ends.
  function watchForEnd() {
    setInterval(() => {
      const video = getVideo();
      if (recorder && video && video === lastVideo) {
        if (video.ended) {
          stopRecording();
        }
      }
    }, 30000);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'START') {
      startRecording().then(sendResponse);
      return true;
    }
    if (msg.type === 'STOP') {
      stopRecording().then(sendResponse);
      return true;
    }
    if (msg.type === 'GET_STATUS') {
      sendResponse(getStatus());
    }
  });

  watchForEnd();
})();