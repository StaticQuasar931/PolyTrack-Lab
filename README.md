# PolyTrack Lab

A local physics playground built on the supplied PolyTrack 0.6.3 game by Kodub.

The original Kodub logo, menus, buttons, fonts, colors, loading screen and button animations are preserved, with a small LAB label under the logo. Physics Lab stays the fifth home button, including after Settings rebuilds the menu. The Static link keeps its original placement and appearance with colored lettering only.

## Play on your computer

Install Node.js if it is not already installed, then double-click **START-GAME.cmd**. Keep its server window open while playing. Alternatively, run `npm start` in this folder and open http://localhost:8080.

The game starts at the normal home screen. **Physics Lab** is the fifth home button, after Garage, Editor, Settings, and Play. It is unavailable during a race. Choose an illustrated preset, or open **Advanced tuning** for individual sliders with icons and plain-language explanations. Click outside the wider panel, press Escape, or use Back to close it. **Apply & restart game** saves the setup and reloads the game. **Reset all**, followed by Apply, restores the original handling and clears every lock.

**Original (0)** changes nothing. The other styles have compact stat chips: Arcade (1), Drift (2), Rocket (3), Gentle (4), Stunt park (5), and Low gravity (6). The eighth tile is Random mix, which changes unlocked controls within moderate bounds on every click. Each advanced control has its own reset and lock. **Extended ranges** unlocks higher tested limits, including 10× acceleration, 40 m/s jumps, and a 3,000 km/h cap. Save up to 30 named setups under **My saved setups**.

Every application gets a small numbered save. **Recent experiments** keeps the latest 20 applied setups; selecting one loads its values as a draft. Your run records keep their own full physics settings even after an applied setup falls out of that list. Applying safely restarts the engine; unchanged game files are revalidated with ETags so they can be reused from the browser cache.

Optional mechanics default to **B** boost, **N** slide, and **J** jump. Change these at the top of Physics Lab or native Settings > Controls; keys save immediately without restarting. **Enable all extras** turns on all three in the draft with one click. Apply to use the strengths. Jumping requires two grounded wheels and has a 0.75 second cooldown. Controls are shown during a race when enabled. These setups save times and physics values with replays disabled because the original recording format cannot record the extra keys. All twelve controls change actual simulation values, including gravity. Mass and suspension remain fixed.

Open **Play > Custom tracks > Extra Tracks** for the familiar community library. All 263 bundled tracks are available with search, tags, difficulty and progress filters, pagination, local favorites and local ratings. **Surprise me** chooses a random track. **Play track** imports the track and opens its normal pre-race screen. Save-only actions let you import tracks for later.

**Lab Runway XL** is also available in Custom tracks. Its 218 parts form a longer straight course, a wide practice pad, and four optional side ramps for testing grip, boosts and airtime. Hold W or Up for the flat finish route. The new name keeps any older Lab Runway course and its records separate.

Every track has **Local Lab times** and **Kodub top 100** tabs. The local experiment board ranks your personal best from each physics setup together, showing the mode and numbered save without verification colors or waiting states. The race HUD place belongs to the current setup; the experiment board compares the setups. Switch to **Recent runs** for up to 200 completed runs, including slower runs and superseded PBs. Compatible recent replays retain their exact car style within a 1 MiB replay budget. Older replay data can age out while its run summary remains. Each setup's PB stays separately saved. Click or right-click a run to inspect its settings, restore them and play the same track, or watch a compatible replay. Replays automatically restore the exact physics first. Old saves are preserved and decoded when their physics fingerprint is recognizable.

The public tab shows a colored saved-result count, capture date and reported total. Click a result to watch its bundled Kodub replay with the recorded car style, or race its ghost on Original physics. A missing recording is labeled unavailable. Public replays always use Original physics. Original personal bests can be compared with the saved top 100, but a slower time cannot establish an overall Kodub rank. No local time is uploaded. Refresh public data with `npm run refresh-replays`; it respects API rate limits and keeps each replay file below 20 MB. Use `npm run resume-replays` to finish an interrupted download without re-fetching completed track files.

Extra Tracks also offers **Most played (snapshot)** sorting using Kodub's saved public-result totals. Custom boards can include unverified entries, as the public tab labels. This is a saved popularity reference, not a live play counter. Unknown counts stay last.

The bundled replay capture currently contains **19,644 playable recordings** across 263 populated track captures, plus five empty captures. Another 82 tracks have no bundled replay capture after API errors and an interrupted recovery pass. Their saved score references remain visible. See `snapshots/replays/manifest.json` for coverage and use the resume command to retry later.

## Saves and online content

Scores, replays, profiles, and physics settings stay in this browser's local storage. Each physics setup has separate records and the lab board compares their PBs. Returning to an earlier setup restores its records. Clearing browser data removes saves. Saves belong to the website address you use, so localhost and a published site have separate saves. Enter or Space starts the selected track from its pre-race screen; typing fields and focused buttons keep their usual keyboard behavior.

There is no Firebase connection, ranked service, account login, score upload, or online multiplayer. The network allow-list permits local assets, public Kodub weekly-track downloads, and the exact Google Analytics measurement destination. The original online submission methods are replaced with device-only adapters. No paid backend or billing credentials are included.

Published HTTPS pages use `G-QXB7CHLEDT` with the consistent page title **PolyTrack Lab**. The integration does not read game saves or send game events. Advertising and analytics storage are denied; Google may receive cookieless usage measurement. Analytics is skipped on local previews and browsers signaling Do Not Track or Global Privacy Control. The home menu links to the [Lab privacy notice](privacy.html).

Select up to **10 public ghosts** at once and choose **Watch selected** or **Race selected**. Public recordings automatically restore Original physics first when needed, so their cars follow the recorded paths. Right-click a public row for individual replay actions. Local rows include **(you)** and offer Watch replay and Race this ghost for compatible recordings. Interactive boost, slide, and jump inputs remain outside the native replay format.

Track of the Week is available under **Play > Community tracks**. It first requests Kodub's official feed; an unexpired bundled capture is available when the browser cannot reach it. Expired captures are never presented as current. The included GitHub Action refreshes only public weekly-track files every six hours after this repository is published. Failed downloads preserve the previous capture. You can run **Refresh weekly track** manually in GitHub's Actions tab, or run `npm run refresh-weekly` locally with Node.js 24 or later. The live capture script was successfully verified during this update.

## GitHub

This is a static website and works from a repository subdirectory on GitHub Pages. No build or dependencies are required to host it. The included Node server is only for local play.

The local repository folder contains the public game files. New changes are intentionally unstaged and uncommitted while testing. No push has been performed. To publish later:

1. In GitHub Desktop, choose **File > Add local repository** and select this folder.
2. Choose **Publish repository** and name it **PolyTrack-Lab**.
3. On GitHub, open **Settings > Pages** and choose **GitHub Actions** as the source.
4. Open **Actions > Publish PolyTrack Lab > Run workflow** to publish the site yourself.

Weekly refreshes can then update the published site automatically. The publish workflow checks that you have enabled Pages first. No personal access token or Firebase configuration is needed. Repository rules can require you to permit workflow commits. If scheduled jobs are disabled by GitHub, enable them again in the Actions tab.

## Credits and implementation

PolyTrack and its original engine/assets are by Kodub. This is an unofficial customized edition. Community tracks remain credited to their creators in the catalog. The Extra Tracks interface and pure discovery helpers were reused from the supplied PolyTrack Ranked project, with its account and submission services removed and its published reviewer dataset replaced by an empty dataset. Public leaderboard references were downloaded directly from Kodub. Private player data, Firebase configuration, and the ranked runtime are not included.

The supplied game is a compiled distribution, not its editable source project. Lab uses small documented JavaScript adapters and version-specific physics hooks. Replacing the original game or physics binary requires reviewing these hooks.
