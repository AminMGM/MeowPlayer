# Releasing MeowPlayer

MeowPlayer ships as a Windows NSIS installer attached to a GitHub release, together with two small
files the in-app updater uses:

| File | Purpose |
| --- | --- |
| `MeowPlayer-Setup-<version>.exe` | The installer, for new installs and full updates |
| `MeowPlayer-Setup-<version>.exe.blockmap` | The installer's chunk list, used for delta updates |
| `latest.yml` | The update feed: version, file name, size and SHA-512 |

The updater (electron-updater) reads `latest.yml` from the latest release, downloads the new blockmap and
the blockmap of the installed version, and fetches only the chunks that differ. It rebuilds the full
installer from the copy the previous install left in `%LOCALAPPDATA%\meowplayer-updater`, verifies the
SHA-512 and runs it on restart or quit. **Keep the blockmap on every release**; the next version needs it
to build its delta. Versions before 2.1.0 use the older updater, which downloads the full `.exe`.

## Checklist

1. Make sure `main` is green: `npm run check`.
2. Set the version in `package.json` (for example `2.1.0`) and add a section to `CHANGELOG.md`.
3. Build the installer:

   ```bash
   npm run dist
   ```

   This writes `release/MeowPlayer-Setup-<version>.exe`. Install it once on a clean profile and
   check that it starts, scans a folder and plays.

4. Commit, then tag the release with a `v` prefix:

   ```bash
   git commit -am "chore(release): <version>"
   git tag -a v<version> -m "MeowPlayer <version>"
   git push origin main v<version>
   ```

5. Create the release on GitHub for that tag and paste the changelog section as the description. Do not
   mark it as a pre-release; the updater ignores drafts and pre-releases. Publishing it starts the
   **Release** workflow, which builds `MeowPlayer-Setup-<version>.exe` on GitHub and attaches it. To
   rebuild the installer for an existing release, run the workflow by hand from the Actions tab.

The installer, blockmap and `latest.yml` must come from the same build, which is why the workflow
uploads all three.

## Testing the updater

Against GitHub:

1. Install the previous release.
2. Publish the new release as above.
3. Start the old version. About six seconds after launch it checks for updates; **Settings → System →
   Check now** does the same immediately.
4. **Download update** shows progress; **Restart to update** installs it (Windows asks for permission,
   since MeowPlayer installs into Program Files).

Locally, without publishing:

1. Build the current version with `npm run dist`, and a test version with
   `npx electron-builder --win --publish never -c.directories.output=release-test -c.extraMetadata.version=<next>`.
2. Copy `release\MeowPlayer-Setup-<current>.exe` to `%LOCALAPPDATA%\meowplayer-updater\installer.exe`
   (the installer normally puts it there).
3. Serve `release-test` and `release` from one local web server that supports HTTP range requests.
4. Start `release\win-unpacked\MeowPlayer.exe` with `MEOWPLAYER_UPDATE_FEED=http://localhost:<port>/`
   and check for updates. The server log shows how little of the installer the delta downloaded.
5. Delete `%LOCALAPPDATA%\meowplayer-updater` afterwards.

## Installer artwork

`build/installerSidebar.bmp` (164×314) and `build/installerHeader.bmp` (150×57) are 24-bit BMPs used by
the installer pages. `scripts/make-icons.mjs` regenerates the tray icon.

## Testing with a separate profile

Set `MEOWPLAYER_PROFILE` to a folder to run MeowPlayer with its own library and settings, leaving your
real profile untouched:

```powershell
$env:MEOWPLAYER_PROFILE = "$env:TEMP\meowplayer-test"; npm run dev
```
