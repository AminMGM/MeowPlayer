# Changelog

All notable changes to MeowPlayer are listed here. Versions follow [Semantic Versioning](https://semver.org).

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

[2.0.0]: https://github.com/AminMGM/MeowPlayer/compare/v1.8.5...v2.0.0
[1.8.5]: https://github.com/AminMGM/MeowPlayer/releases/tag/v1.8.5
