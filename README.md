# MeowPlayer

A frosted-glass desktop music player for Windows. Electron + React + Web Audio: local library playback,
10-band equalizer, crossfade, synced lyrics, floating mini player and system tray.

```bash
npm install
npm run dev     # Vite + Electron with UI hot reload
npm start       # build, then launch
npm run dist    # Windows installer into ./release
```

## Interface

One continuous graphite shell instead of floating panels — the sidebar, library, dock and player are
separated only by brightness and hairline rules. Cold grey palette, translucent surface over the Windows 11
acrylic backdrop. Theme, accent colour and glass blur are adjustable; **Graphite** is the default.

- Collapsible sidebar (icons only) for more library space
- Now playing can be the centre pane instead of the library (*Settings → Now playing in the center*)
- Glassy spectrum visualizer and synced lyrics in every now-playing surface
- The supplied cat logo is used in the title bar and as the app/tray icon

## Playback

- MP3, FLAC, M4A/AAC, WAV, OGG/OPUS, WMA, AIFF via a range-capable `mp-media://` protocol
- Play/pause, next/previous, seek, volume, mute, shuffle, repeat, speed 0.5–2×, sleep timer
- **Crossfade** 0–12 s between tracks (dual-deck Web Audio engine)
- **Volume boost up to 150%** — off by default, enable in settings
- **Output device picker** for speakers, Bluetooth and other audio outputs (Web Audio `setSinkId`)
- **Session resume**: the app reopens on the last track and position, and Play picks up from there
- **Smart queue** extends the current queue with tracks from the same genre, artist and album
- **Sleep timer** with presets and any custom duration; the last 15 seconds fade out
- **Pause on sleep or lock** — playback stops when Windows sleeps
- Optional **track-change notifications** (off by default)
- OS media keys, Windows media overlay, taskbar thumbnail transport buttons

## Library and views

- Songs, Albums, Artists, **Folders**, **Genres**, Liked, Playlists, Search
- **Folders** with a per-folder menu (rename label, add to playlist, remove) and subfolder drilling
- **Playlist covers** — click the artwork on a playlist page to choose an image
- **Duplicate hiding** for the Songs view, and an **edit track details** dialog from the ⋯ menu
- **Home** shows a rotating greeting, a *Suggested from your library* row and recently played
- Playlists with drag reordering, `.m3u8` import/export, add-to-playlist from the player bar (**+**)
- **Drag and drop** audio files or folders onto the window — a "Drop to play" overlay appears, new files are
  indexed and playback starts
- Opening an audio file from Explorer launches the floating mini player; files outside the library show an
  **Add** button to include them

## Mini player, tray and window

- Transparent floating glass mini player with the same 18 px radius as the app's cards
- **System tray**: left-click the tray icon to open the app, right-click for the menu
  (open, play/pause, next/previous, quit)
- Closing the window sends the app to the tray (toggleable in settings)
- Installer registers mp3, flac, m4a, aac, wav, ogg, opus, wma, aiff — use *Settings → Default music player*
  to pick MeowPlayer in Windows default apps

## Lyrics

Synced lyrics come from [LRCLIB](https://lrclib.net) — free, no API key, matched by title, artist, album and
track length, then cached under `%APPDATA%/MeowPlayer/lyrics`. Disable them entirely, or turn off automatic
downloading and fetch on demand from the lyrics panel, in settings.

## Appearance

Four themes (Graphite, Light, Cherry, Navy), five accent swatches, adjustable glass blur, an interface scale
for HiDPI screens, and three flowing visualizer styles (**Ribbon**, **Aurora**, **Filament**) alongside the
bars. With **theme from album art** on, the accent follows the current cover.

## Updates

MeowPlayer checks `github.com/AminMGM/MeowPlayer/releases/latest` shortly after launch (and on demand from
**Settings → Updates**). New releases offer *Install update* (downloads the installer and relaunches it),
*Hide for 7 days,* or the release page. Everything can be turned off with one switch.

## Releasing

```bash
npm run dist    # builds and writes release/MeowPlayer-Setup-<version>.exe
```

Bump `version` in `package.json`, build, then publish the installer as a GitHub release tagged with that
version (for example `v1.4.2`). The updater compares that tag with the running version.

## Keyboard

| Keys | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` `→` | Seek 5 s |
| `Ctrl` + `←` `→` | Previous / next |
| `↑` `↓` | Volume |
| `M` / `S` / `R` / `F` | Mute / shuffle / repeat / like |
| `Ctrl` + `F` | Search |
| `Esc` | Close panels |

## Project layout

```
electron/        main process — window, tray, mini window, media protocol, scanner, lyrics, updater
src/             renderer — store, dual-deck audio engine, components, styles
src/styles/      shell.css · panels.css · overlays.css
src/greetings.ts generated from assets/for use/MeowPlayer Home Greeting System.md
assets/          logo, app icon, tray icon, Meowdownlaod logo
scripts/         dev launcher, greeting generator
backup/          previous framed ("glass panels") UI, kept for reference
```

State lives in `%APPDATA%/MeowPlayer/meowplayer-state.json`, artwork in `covers/`.
