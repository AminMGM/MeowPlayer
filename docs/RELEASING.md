# Releasing MeowPlayer

MeowPlayer ships as a Windows NSIS installer attached to a GitHub release. The in-app updater reads
`https://api.github.com/repos/AminMGM/MeowPlayer/releases/latest`, compares its tag with the running
version and offers the `.exe` asset.

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

5. Create the release on GitHub for that tag, paste the changelog section as the description and attach
   `MeowPlayer-Setup-<version>.exe`. Do not mark it as a pre-release; the updater ignores drafts and
   pre-releases.

GitHub publishes a SHA-256 digest for every release asset. The updater verifies the downloaded installer
against it before running it, so always upload the exact file you tested.

## Testing the updater

1. Install the previous release.
2. Publish the new release as above.
3. Start the old version. About six seconds after launch it checks for updates; **Settings → System →
   Check now** does the same immediately.
4. **Install update** downloads the installer, verifies it and starts it (Windows asks for permission,
   since MeowPlayer installs into Program Files).

## Installer artwork

`build/installerSidebar.bmp` (164×314) and `build/installerHeader.bmp` (150×57) are 24-bit BMPs used by
the installer pages. `scripts/make-icons.mjs` regenerates the tray icon.

## Testing with a separate profile

Set `MEOWPLAYER_PROFILE` to a folder to run MeowPlayer with its own library and settings, leaving your
real profile untouched:

```powershell
$env:MEOWPLAYER_PROFILE = "$env:TEMP\meowplayer-test"; npm run dev
```
