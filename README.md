# YouTube Live Recorder

A Chrome extension that records YouTube live streams (or any YouTube video) to a
file on your computer, entirely in your browser. No third-party services, no
external servers.

- Records video + audio from the page itself (`captureStream` + `MediaRecorder`)
- Saves the recording to your **Downloads** folder as an **MP4** file (plays in any modern player)
- Shows a `REC` badge in the toolbar and keeps the system awake while recording
- Works on any YouTube watch/live page without knowing the URL in advance

---

## Install

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this folder: `~/youtube-live-recorder`
5. Click the puzzle icon in the toolbar and **pin** "YouTube Live Recorder"

## How to use

1. Open the YouTube live stream in a normal (visible) tab.
2. Click the extension icon. The popup shows:
   - **Live stream: yes/no** — whether a live event is detected
   - **Elapsed** — how long you've been recording
3. Press **Start recording**. The toolbar icon turns into a red **REC** badge.
4. When the session is over, open the popup again and press **Stop and save**.

The file is saved as `StreamTitle_YYYYMMDDHHMMSS.mp4` in `~/Downloads`. The browser
records MP4 with its default codecs (VP9/Opus); if MP4 recording isn't supported it
falls back to a WebM (VP9/Opus) file.

## Important notes

- **Keep the tab open and visible** while recording. Closing the tab or having
  Chrome discard it (tab discarding, restart) will end the recording.
- **Set a fixed video quality** on YouTube (gear icon → Quality → pick a level).
  "Auto" quality changes produce video-size jumps in the recorded file.
- The system won't sleep while recording (extension holds a keep-awake request).
- Recommended for sessions of a few hours. The recording is buffered in memory
  before being written to disk, so very long sessions are memory-hungry.
- The recording captures exactly what the player renders — if the stream buffers,
  stops, or goes offline, that is what gets recorded.

## How it works

The extension's content script calls `HTMLMediaElement.captureStream()` on
YouTube's `<video>` element (audio falls back to a Web Audio route if needed),
feeds the stream into a `MediaRecorder` (MP4 with the browser's default codecs,
falling back to VP9/Opus WebM), and hands the result to the browser's
**Downloads** API when you press Stop. The recorded file plays in any standard
player.

---

## Alternative: command-line recording (source quality)

If you have the stream URL ahead of time and prefer to record at source quality
(unattended, auto-stops when the stream ends):

```bash
# one-time setup
sudo apt install yt-dlp ffmpeg
curl -fsSL https://deno.land/install.sh | sh        # required by yt-dlp for YouTube

# record a stream immediately
yt-dlp -o "~/Videos/%(title)s_%(date)s_%(start_time)s.%(ext)s" \
  'https://www.youtube.com/watch?v=VIDEOID'
```

Useful options:
- `--limit-rate 5M` — cap download speed
- `-f best` — highest quality (default)
- `--sleep-requests 1` — be gentle with requests if retrying

## Load an unpacked extension after an update

If files in the folder change, click the **rotate (reload)** icon on the
extension card in `chrome://extensions`, then reload any open YouTube tabs.

## Releasing & Packaging

Scripts in `scripts/` automate versioning and packaging for GitHub Releases.

### Bump version

```bash
# from repo root
./scripts/bump-version.sh patch   # 1.1.0 -> 1.1.1
./scripts/bump-version.sh minor   # 1.1.0 -> 1.2.0
./scripts/bump-version.sh major   # 1.1.0 -> 2.0.0
./scripts/bump-version.sh 1.2.3   # explicit version
```

The script updates `manifest.json` and prints the git commands to commit, tag, and push.

### Package for GitHub Release

```bash
./scripts/package-release.sh
```

Outputs `dist/youtube-live-recorder-vX.Y.Z.zip` (ready to attach to a GitHub Release).

### Publish a release

1. Bump version: `./scripts/bump-version.sh patch`
2. Commit & tag: `git add manifest.json && git commit -m "chore: release vX.Y.Z" && git tag vX.Y.Z`
3. Push: `git push && git push --tags`
4. Package: `./scripts/package-release.sh`
5. On GitHub: create a new Release from the tag, attach `dist/youtube-live-recorder-vX.Y.Z.zip`

### Chrome Web Store (optional)

Upload the same zip from `dist/` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Troubleshooting

| Problem                        | Fix                                      |
| ------------------------------ | ---------------------------------------- |
| "No `<video>` element found"   | Open the live video first, then reload the tab |
| "Cannot reach the page"        | Reload the YouTube tab.                  |
| Recording has no audio         | Verify the tab isn't muted; keep tab visible. |
| Tab closed / Chrome restarted  | Recording ends — restart it after.       |