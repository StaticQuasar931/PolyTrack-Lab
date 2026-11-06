# PolyTrack Lab

A local physics playground built on the supplied PolyTrack 0.6.3 game by Kodub.

The original Kodub logo, menus, buttons, fonts, colors, loading screen and button animations are preserved, with a small LAB label under the logo. Physics Lab stays the fifth home button, including after Settings rebuilds the menu. The Static link keeps its original placement and appearance with colored lettering only.

## Play on your computer

Install Node.js if it is not already installed, then double-click **START-GAME.cmd**. Keep its server window open while playing. Alternatively, run `npm start` in this folder and open http://localhost:8080.

The game starts at the normal home screen. **Physics Lab** is the fifth home button, after Garage, Editor, Settings, and Play. It is unavailable during a race. Choose an illustrated preset, or open **Advanced tuning** for individual sliders with icons and plain-language explanations. Click outside the wider panel, press Escape, or use Back to close it. **Apply & restart game** saves the setup and reloads the game. **Reset all**, followed by Apply, restores the original handling and clears every lock.

**Original (0)** changes nothing. The other styles have compact stat chips: Arcade (1), Drift (2), Rocket (3), Gentle (4), Stunt park (5), and Low gravity (6). The eighth tile is Random mix, which changes unlocked controls within moderate bounds on every click. Each advanced control has its own reset and lock. **Extended ranges** unlocks higher tested limits, including 10× acceleration, 40 m/s jumps, and a 3,000 km/h cap. Save up to 30 named setups under **My saved setups**.

Every application gets a small numbered save. **Recent experiments** keeps the latest 20 applied setups; selecting one loads its values as a draft. Your run records keep their own full physics settings even after an applied setup falls out of that list. Applying safely restarts the engine; unchanged game files are revalidated with ETags so they can be reused from the browser cache.

Optional mechanics default to **B** boost, **N** slide, and **J** jump. Change these at the top of Physics Lab or native Settings > Controls; keys save immediately. **Enable all extras** enables boost, slide, jumping, and one extra air jump in the draft. Apply to play. Advanced tuning offers **Air jumps (0–3)**: with Jump strength enabled, press the jump key again while airborne. Separate air-jump presses need 0.15 seconds; stable landing refills the budget. Normal road jumps keep their 0.75-second cooldown. Original and existing presets stay unchanged. These extra inputs save times and full settings but cannot play back in the native replay format. All thirteen controls affect the actual simulation. Mass and suspension remain fixed.

Open **Play > Custom tracks > Extra Tracks** for the familiar community library. All 263 bundled tracks are available with search, tags, difficulty and progress filters, pagination, local favorites and local ratings. **Surprise me** chooses a random track. **Play track** imports the track and opens its normal pre-race screen. Save-only actions let you import tracks for later.

**Lab Runway: Desert Circuit** is available in Custom tracks: 3,020 meters, 587 native parts, a 600-meter acceleration straight, four broad turns, five ordered checkpoints, and optional ramps. Follow the arrow boards and brake before turns. Its preview comes from the actual native track-thumbnail renderer. Earlier Lab Runway tracks and their records remain separate.

Open **Lab track tools** from Custom tracks, a track's pre-race panel, or **Lab tools** in the original editor. Use the open track or paste an export code, choose starting physics, and add checkpoint sections for power, grip, gravity, and speed cap. Add boost pads, gravity fields, or ring gates with exact positions, sizes, and rotation. **Use editor view center** places the coordinates at the native editor's camera target; added objects preview there. Road geometry and scenery still use the original editor. **Try the physics circuit** loads a complete desert example with a pad, rings, and checkpoint changes.

**Create code** exports a `PolyTrackLab1` package containing the native track and its rules. Save it locally or share that code. Native Import accepts these packages too. Lab objects only travel with the Lab code, so ordinary native exports preserve roads but omit the additional rules. Pads multiply acceleration inside their area; gravity fields affect their volume. Rings count bonus crossings. They have no solid collision and do not replace normal respawn/finish checkpoints. Downforce stays fixed throughout a run. A Lab course safely reloads on entry and exit; its records and saved rule snapshots stay separate from normal physics. Dynamic course runs have no compatible native replay.

The Extra Tracks header offers **Submit a track**. It prepares a copy/download containing only the chosen track, optional recommended physics, and the text you enter. Email draft, Discord, and the existing feedback form use the contact links published on Static's website. Nothing is automatically uploaded or sent. Publication of submissions remains a manual review process.

Every track has **Local Lab times** and **Kodub top 100** tabs. The local experiment board ranks your personal best from each physics setup together, showing the mode and numbered save without verification colors or waiting states. The race HUD place belongs to the current setup; the experiment board compares the setups. Switch to **Recent runs** for up to 200 completed runs, including slower runs and superseded PBs. Compatible recent replays retain their exact car style within a 1 MiB replay budget. Older replay data can age out while its run summary remains. Each setup's PB stays separately saved. Click or right-click a run to inspect its settings, restore them and play the same track, or watch a compatible replay. Replays automatically restore the exact physics first. Old saves are preserved and decoded when their physics fingerprint is recognizable.

The public tab shows a colored saved-result count, capture date and reported total. Click a result to watch its bundled Kodub replay with the recorded car style, or race its ghost on Original physics. A missing recording is labeled unavailable. Public replays always use Original physics. Original personal bests can be compared with the saved top 100, but a slower time cannot establish an overall Kodub rank. No local time is uploaded. Refresh public data with `npm run refresh-replays`; it respects API rate limits and keeps each replay file below 20 MB. Use `npm run resume-replays` to finish an interrupted download without re-fetching completed track files.

Extra Tracks also offers **Most played (snapshot)** sorting using Kodub's saved public-result totals. Custom boards can include unverified entries, as the public tab labels. This is a saved popularity reference, not a live play counter. Unknown counts stay last.

The bundled replay capture currently contains **19,644 playable recordings** across 263 populated track captures, plus five empty captures. Another 82 tracks have no bundled replay capture after API errors and an interrupted recovery pass. Their saved score references remain visible. See `snapshots/replays/manifest.json` for coverage and use the resume command to retry later.

## Saves and online content

Scores, replays, profiles, and physics settings stay in this browser's local storage. Each physics setup has separate records and the lab board compares their PBs. Returning to an earlier setup restores its records. Clearing browser data removes saves. Saves belong to the website address you use, so localhost and a published site have separate saves. Enter or Space starts the selected track from its pre-race screen; typing fields and focused buttons keep their usual keyboard behavior.

There is no Firebase connection, ranked service, account login, score upload, or online multiplayer. The network allow-list permits local assets, public Kodub weekly-track downloads, and the exact Google Analytics measurement destination. The original online submission methods are replaced with device-only adapters. No paid backend or billing credentials are included.

Published HTTPS pages use `G-QXB7CHLEDT` with the consistent page title **PolyTrack Lab**. The integration does not read game saves or send game events. Advertising and analytics storage are denied; Google may receive cookieless usage measurement. Analytics is skipped on local previews and browsers signaling Do Not Track or Global Privacy Control. The home menu links to the [Lab privacy notice](privacy.html).

Select up to **10 public ghosts** at once and choose **Watch selected** or **Race selected**. Public recordings automatically restore Original physics first when needed, so their cars follow the recorded paths. Right-click a public row for individual replay actions. Local rows include **(you)** and offer Watch replay and Race this ghost for compatible recordings. Interactive boost, slide, and jump inputs remain outside the native replay format.

Public and local rows use the original game's car thumbnail renderer and saved car styles. Selected public ghosts also update the native Opponents, Play, and Watch controls. Explicitly choosing ghosts enables native ghost visibility, and nearby ghosts retain a faint outline instead of disappearing completely. Missing recordings remain labeled as reference-only results.

Track of the Week is available under **Play > Community tracks**. It first requests Kodub's official feed; an unexpired bundled capture is available when the browser cannot reach it. Expired captures are never presented as current. The included GitHub Action refreshes only public weekly-track files every six hours after this repository is published. Failed downloads preserve the previous capture. You can run **Refresh weekly track** manually in GitHub's Actions tab, or run `npm run refresh-weekly` locally with Node.js 24 or later. The live capture script was successfully verified during this update.

## GitHub

This is a static website and works from a repository subdirectory on GitHub Pages. No build or dependencies are required to host it. The included Node server is only for local play.

The existing repository connection is preserved. Working changes are left unstaged and uncommitted during testing. Publish the reviewed changes when ready. Branch-based Pages can serve the repository root directly; `.nojekyll` skips unnecessary Jekyll processing.

To use the included deployment workflow instead, choose **Settings > Pages > Source: GitHub Actions**, then run **Actions > Publish PolyTrack Lab > Run workflow**. Deployment settings are not changed automatically.

Weekly refreshes can then update the published site automatically. The publish workflow checks that you have enabled Pages first. No personal access token or Firebase configuration is needed. Repository rules can require you to permit workflow commits. If scheduled jobs are disabled by GitHub, enable them again in the Actions tab.

## Credits and implementation

PolyTrack and its original engine/assets are by Kodub. This is an unofficial customized edition. Community tracks remain credited to their creators in the catalog. The Extra Tracks interface and pure discovery helpers were reused from the supplied PolyTrack Ranked project, with its account and submission services removed and its published reviewer dataset replaced by an empty dataset. Public leaderboard references were downloaded directly from Kodub. Private player data, Firebase configuration, and the ranked runtime are not included.

The supplied game is a compiled distribution, not its editable source project. Lab uses small documented JavaScript adapters and version-specific physics hooks. Replacing the original game or physics binary requires reviewing these hooks.
