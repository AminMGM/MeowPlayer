# Changelog

All notable changes to MeowPlayer are listed here. Versions follow [Semantic Versioning](https://semver.org).

## [2.2.5] - 2026-11-25

### Fixed

- **Large libraries are smooth and light.** The queue panel no longer builds a row for every song in the
  queue (playing a 6,000-song library froze Now playing at 6 fps), and the Albums and Artists grids only
  keep the cards near the screen. With 6,000 songs and 600 albums, Now playing went from 6 fps and 1.5 GB
  to a smooth 165 fps at under 900 MB, and browsing no longer piles up artwork in memory.
- Lyrics that wrap onto two lines fill one line after the other, instead of both lines at once.
  Right-to-left lyrics fill from the right, line by line.
- Songs has one search again: the filter box above the list is gone. Use the search at the top, or just
  type.
- Icon animations are quieter: no more icons popping in whenever a list redraws, only a small lift on
  hover and a squeeze on click.
- The A–Z scroller no longer sits on top of Settings and other dialogs, where it could block clicks.

## [2.2.4] - 2026-11-25

### New

- **Type to search.** On Songs, Albums, Artists, Genres and Liked songs, just start typing to filter the
  page. Backspace edits, Esc clears. The first time, MeowPlayer asks whether to keep it; it can be turned
  off in Settings → Library.
- **Alphabet scroller** on Songs: an A–Z rail appears while you scroll. Click or drag along it to jump.
- **Fix song info.** Finds better titles, artists, albums, years, track numbers and missing artwork from
  file names and [MusicBrainz](https://musicbrainz.org), then lists every change with a tick box so you
  apply only what you want. Settings → Library, or right-click a song.
- **Import from Spotify.** Rebuild Spotify playlists from the songs in your library: export them as CSV
  with Exportify (free, open source) and choose the files under Playlists → From Spotify. Songs you do
  not have are listed.
- **Listening stats for 7 days, 30 days and all time**, a **listening streak** (5 minutes a day keeps it
  going) and a **Most skipped** list.
- **New icons** drawn for MeowPlayer: rounder, filled when active, with small animations.
- **Shuffle and repeat** in the mini player.
- **Lyrics database** in Settings → Lyrics shows how many songs are saved and how much space they use,
  with a button to remove it.

### Changed

- A song counts as played after 10 seconds of listening; skipping it before then counts as a skip.
- *Download all* lyrics skips songs that already have lyrics, and remembers songs LRCLIB has nothing for
  instead of asking again every time.

### Fixed

- Synced lyrics follow the music closely again, with exactly one line lit at a time.
- Lyrics jump back to the top when a new song starts.
- Persian, Arabic and Hebrew lyrics are right-aligned and fill from the right.
- Instrumental songs show *Instrumental* instead of "no lyrics found".
- Much lower memory use: lists use small artwork thumbnails, the visualizer draws at most 60 frames per
  second and pauses when hidden, and MeowPlayer no longer starts the camera service while listing audio
  devices. A 400-song library with large artwork went from about 1.3 GB to about 0.7–0.9 GB.

## [2.1.0] - 2026-11-21

### New

- **Smaller, smarter updates.** Updates now download only the parts of MeowPlayer that changed, usually
  a few megabytes instead of the whole 118 MB installer. Interrupted downloads can be retried, and every
  download is checked against the release before it can run.
- **In-app downloader.** Settings → System shows the download with its progress, size and speed, while you
  keep listening. When it is done, choose **Restart to update**, or it installs the next time you quit.

### Note

Updating from 2.0.0 or 1.8.5 still downloads the full installer once, because those versions have the old
updater built in. From 2.1.0 on, every update is a small one.

## [2.0.0] - 2026-11-21

A rebuilt MeowPlayer: a new interface on the same frosted glass, a faster and safer core, and many fixes.

### New

- **Smart playlists**: Recently added, Most played and Recently played.
- **Listening stats**: listening time, the last 30 days and your top artists, albums and genres.
- **Tag editing writes into the file**, so changes show up in every player and survive rescans.
- **Folder watching**: new, changed and deleted files appear without a manual rescan, and rescans skip
  files that have not changed.
- **Gapless playback** and **volume normalization** from ReplayGain tags.
- **Synced lyrics** fill in as each line is sung; click a line to jump to it. Instrumental breaks show
  as a pause instead of keeping the last line lit.
- **Multi-select** in song lists (Ctrl and Shift), double-click or Enter to play, sortable columns,
  and fast scrolling through very large libraries.
- **Back and forward navigation**, including the mouse side buttons, and search in the title bar.
- **Settings in categories**: Appearance, Playback, Lyrics, Library, System and About.
- **System theme** that follows Windows light and dark mode, a custom accent colour, and an optional
  blurred artwork backdrop.
- **Interface size** with an Auto option that fits the interface to the window.
- **The window resizes freely**; the side panels fold away on narrow windows and come back when there is
  room.
- **Mini player** with a seek bar, a like button and a cleaner layout.
- **Toasts with Undo**, for example after deleting a playlist.
- Branded installer that installs to `C:\Program Files\MeowPlayer`.

### Changed

- Now Playing shows big synced lyrics next to the artwork, and the side panel switches to the queue.
- The queue is split into Now playing, Up next and Played earlier.
- Shuffle reorders the queue, so every song plays once and Previous goes back to what you heard.
- "Play" from a right-click menu keeps the list you were in, instead of replacing the queue with one song.
- Dropped files play without being added to your library; choose **Add to library** to keep them.
- The close question is now an in-app dialog that matches the theme.
- Album colours, when turned on, are softened so the interface stays calm.
- The Android build was removed; MeowPlayer is a Windows app.

### Fixed

- Removing a song from the queue started playing it.
- Crossfade never actually crossfaded.
- Adding to a playlist from the player bar did nothing.
- Double-clicking a song played it three times and counted three plays.
- "Remember my choice" in the close question was forgotten after the next settings change.
- A crash while saving could reset the whole library; saves are now atomic with a backup copy.
- Lyrics search could save another song's lyrics; matches now check the artist and length, and searches
  time out instead of hanging.
- Untagged tracks could all show the same cover.
- Reordering a playlist or queue could move the wrong song when some tracks were missing.
- The artist page's Popular list was sorted by length instead of plays, and album artist links could show
  "Artist not found".
- The restored queue position could be wrong after a restart.
- Importing settings from another PC could break the equalizer.
- The sidebar could stay collapsed after the window had been narrow.
- Seeking while dragging stuttered and wrote to disk constantly.
- The media overlay's pause button could start playback.
- Changing the volume during the sleep timer's fade cancelled the fade.
- Turning off volume boost left the volume above 100%.
- A folder like `D:\Music2` was treated as part of `D:\Music`.

### Security

- The updater only installs the release it found itself, and checks the download against GitHub's
  published SHA-256 checksum.
- The media protocol only serves files inside your library folders and files you opened.
- Windows run sandboxed with only the permissions the app needs, and IPC inputs are validated.
- Default-app registration runs once per version instead of on every launch.

## [1.8.5] - 2026-11-17

- Media keys, lyrics for the whole library and the greeting on the Home screen.

[2.1.0]: https://github.com/AminMGM/MeowPlayer/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/AminMGM/MeowPlayer/compare/v1.8.5...v2.0.0
[1.8.5]: https://github.com/AminMGM/MeowPlayer/releases/tag/v1.8.5
