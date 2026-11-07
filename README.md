# PolyTrack Lab

A local physics playground built on the supplied PolyTrack 0.6.3 game by Kodub.

The original Kodub logo, menus, buttons, fonts, colors, loading screen and button animations are preserved, with a small LAB label under the logo. Physics Lab stays the fifth home button, including after Settings rebuilds the menu. The Static link keeps its original placement and appearance with colored lettering only.

## Play on your computer

Install Node.js if it is not already installed, then double-click **START-GAME.cmd**. Keep its server window open while playing. Alternatively, run `npm start` in this folder and open http://localhost:8080.

The game starts at the normal home screen. **Physics Lab** is the fifth home button, after Garage, Editor, Settings, and Play. It is also available from the in-track toolbar on normal tracks. Choose an illustrated preset, or open **Advanced tuning** for individual sliders with icons and plain-language explanations. Click outside the wider panel, press Escape, or use Back to close it. **Apply physics** saves the setup and rebuilds the simulation engines. From a track, **Apply & restart run** restarts that same course with the new setup; the selected ghosts keep their own recorded physics. Menus, models, textures, audio, and the renderer stay loaded. Apply waits for the new engines before returning home or restarting the current track. Rule-controlled Lab demos and editor test drives retain their own behavior; in-track editing and TAS controls are available on normal tracks. Unsupported restart states retain the complete-reload fallback. **Reset all**, followed by Apply, restores the original handling and clears every lock.

**Original (0)** changes nothing. The other styles have compact stat chips: Arcade (1), Drift (2), Rocket (3), Gentle (4), Stunt park (5), and Low gravity (6). The eighth tile is Random mix, which changes unlocked controls within moderate bounds on every click. Each control has its own reset and lock. Normal ranges keep familiar sliders; Extended retains the earlier expanded ranges. **Sandbox ranges** goes much further: up to 1,000x acceleration, reverse, braking and boost, 1,000 m/s jumps, 99 counted air jumps, and 20x gravity. Zero speed limit means no added speed cap. Infinity is not a valid physics value; the expanded controls use finite, engine-tested ceilings. Save up to 30 named setups under **My saved setups**.

**Vehicle studio** changes the actual car dimensions. Whole car size ranges from 0.25x to 4x, with independent body width, height, and length. Wheel radius changes real wheel contact radius; wheel spacing, wheelbase, and suspension length change real contact layout and ride height. The editor's track stays the same size, so the car becomes smaller or larger relative to it. Quick size choices and a draft preview make experimentation easier. **Wheel width (appearance)** changes the tire model only: the native engine uses raycast wheels and has no solid tire-width collider. Grip remains a separate physics control. Mass, suspension stiffness, and damping retain their original values.

Every application gets a small numbered save. **Recent experiments** keeps the latest 20 applied setups; selecting one loads its values as a draft. Your run records keep their own full physics settings even after an applied setup falls out of that list. Applying safely restarts the engine; unchanged game files are revalidated with ETags so they can be reused from the browser cache.

Optional mechanics default to **B** boost, **N** slide, and **J** jump. Change these at the top of Physics Lab or native Settings > Controls; keys save immediately. **Enable all extras** enables boost, slide, jumping, and one extra air jump in the draft. Apply to play. Jump strength enables road and air jumps. Stable landing refills counted air jumps; **Unlimited air jumps** removes the count while keeping separate presses and recharge timing. **Road jump recharge** can reach zero, and **Air jump recharge** can drop to 0.05 seconds. **Automatic boost** applies your Boost power whenever you accelerate, without holding the boost key. Defaults keep the original 0.75/0.15-second jump timing and manual boost. Original and all existing presets stay unchanged. Extra jump/boost/slide inputs cannot be saved in native recordings, so those runs keep times and full settings. You can still watch and race other compatible recordings with those extras active.

Open **Play > Custom tracks > Extra Tracks** for the familiar community library. All 263 bundled tracks are available with search, tags, difficulty and progress filters, pagination, local favorites and local ratings. **Surprise me** chooses a random track. **Play track** imports the track and opens its normal pre-race screen. Save-only actions let you import tracks for later.

**Lab Runway: Desert Skyway** is available in Custom tracks: a gray 3,020-meter circuit 60 meters above the desert, with a 600-meter straight, four broad turns, five checkpoints, and optional ramps. Normal Play keeps your setup. **Try boosts & rings** opens a separate mechanics demo with visible green boost pads, gold rings, blue gravity fields, double jumps, and checkpoint physics changes. Leaving the demo restores your previous setup. Its preview comes from the native track renderer. Earlier Runway tracks and records remain separate.

Open **Lab track tools** from Custom tracks, a track's pre-race panel, or **Lab tools** in the original editor. Use the open track or paste an export code, choose starting physics, and add checkpoint sections for power, grip, gravity, and speed cap. Add boost pads, gravity fields, or ring gates with exact positions, sizes, and rotation. **Use editor view center** places the coordinates at the native editor's camera target; added objects preview there. Road geometry and scenery still use the original editor. **Try the physics circuit** loads a complete desert example with a pad, rings, and checkpoint changes.

**Create code** exports a `PolyTrackLab1` package containing the native track and its rules. Save it locally or share that code. Native Import accepts these packages too. Lab objects only travel with the Lab code, so ordinary native exports preserve roads but omit the additional rules. Pads multiply acceleration inside their area; gravity fields affect their volume. Rings count bonus crossings. They have no solid collision and do not replace normal respawn/finish checkpoints. Downforce stays fixed throughout a run. A Lab course safely reloads on entry and restores your previous setup on exit; its records and saved rule snapshots stay separate from normal physics. Dynamic course runs have no compatible native replay.

The Extra Tracks header offers **Submit a track**. It prepares a copy/download containing only the chosen track, optional recommended physics, and the text you enter. Email draft, Discord, and the existing feedback form use the contact links published on Static's website. Nothing is automatically uploaded or sent. Publication of submissions remains a manual review process.

Every track has **Local Lab times** and **Kodub top 100** tabs. The local experiment board ranks your personal best from each physics setup together, showing the mode and numbered save without verification colors or waiting states. The race HUD place belongs to the current setup; the experiment board compares the setups. Switch to **Recent runs** for up to 200 completed runs, including slower runs and superseded PBs. Compatible recent replays retain their exact car style within a 1 MiB replay budget. Older replay data can age out while its run summary remains. Each setup's PB stays separately saved. Click or right-click a run to inspect its settings, restore them and play the same track, or watch a compatible replay. Each recording runs its own saved physics in an isolated engine. Watch and Race keep your active setup; only **Use setup & play** replaces it. Old saves are preserved and decoded when their physics fingerprint is recognizable.

The public tab shows a colored saved-result count, capture date and reported total. Click a result to watch its bundled Kodub replay with the recorded car style, or race its Original ghost using your custom car. A missing recording is labeled unavailable. Public replays always use Original physics in their own engine; your car can use another setup. Original personal bests can be compared with the saved top 100, but a slower time cannot establish an overall Kodub rank. No local time is uploaded. Refresh public data with `npm run refresh-replays`; it respects API rate limits and keeps each replay file below 20 MB. Use `npm run resume-replays` to finish an interrupted download without re-fetching completed track files.

Extra Tracks also offers **Most played (snapshot)** sorting using Kodub's saved public-result totals. Custom boards can include unverified entries, as the public tab labels. This is a saved popularity reference, not a live play counter. Unknown counts stay last.

The bundled replay capture currently contains **19,644 playable recordings** across 263 populated track captures, plus five empty captures. Another 82 tracks have no bundled replay capture after API errors and an interrupted recovery pass. Their saved score references remain visible. See `snapshots/replays/manifest.json` for coverage and use the resume command to retry later.

## Saves and online content

Scores, replays, profiles, and physics settings stay in this browser's local storage. Each physics setup has separate records and the lab board compares their PBs. Returning to an earlier setup restores its records. Clearing browser data removes saves. Saves belong to the website address you use, so localhost and a published site have separate saves. Enter or Space starts the selected track from its pre-race screen; typing fields, focused buttons, and leaderboard rows keep their usual keyboard behavior. Space on a ghost row selects that ghost without starting a race.

There is no Firebase connection, ranked service, account login, score upload, or online multiplayer. The network allow-list permits local assets, public Kodub weekly-track downloads, and the exact Google Analytics measurement destination. The original online submission methods are replaced with device-only adapters. No paid backend or billing credentials are included.

Published HTTPS pages use `G-QXB7CHLEDT` with the consistent page title **PolyTrack Lab**. The integration does not read game saves or send game events. Advertising and analytics storage are denied; Google may receive cookieless usage measurement. Analytics is skipped on local previews and browsers signaling Do Not Track or Global Privacy Control. The home menu links to the [Lab privacy notice](privacy.html).

Select up to **10 public ghosts** at once and choose **Watch selected** or **Race selected**. Public recordings use their own untouched Original engine, so their cars follow the recorded paths while your custom physics and dimensions remain active. Right-click a public row for individual replay actions. Local rows include **(you)** and offer Watch replay and Race this ghost for compatible recordings. Interactive boost, slide, and jump inputs remain outside the native replay format.

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


## TAS practice

Open **TAS practice** in a normal track and choose **Enable TAS & restart**. This starts a fresh assisted run. Choose 0.25x, 0.5x, 1x, 2x or 4x pacing, pause/resume, or advance exactly 1, 10 or 100 ticks. Each tick remains 1 ms of native simulation. Held Throttle, Brake, Left and Right switches let you drive while stepping; Release held inputs returns to keyboard controls.

TAS practice times have a separate record namespace and visible label. They cannot replace normal PBs or claim a public comparison. Local run metadata retains the last 128 control edits, with an explicit truncation flag. Return to normal & restart starts a fresh unassisted run. The current TAS tools provide forward stepping and pacing, without rewind, movie editing, or native replay export. Using a saved TAS run's physics restores the car settings; it does not replay the assisted control edits.

## Racing wheel

Wheel buttons bind automatically, including menu controls before pedal calibration. For the Logitech PRO PC layout: A selects/plays, B goes back, X resets to the last checkpoint, Y restarts the track, and Menu pauses/resumes. The D-pad moves menu focus; left/right adjusts selected sliders or options. If a numbered wheel has no exposed D-pad, its first two paddles move focus up/down. Other numbered PC wheels use a generic preset with numbered labels, rather than claiming verified physical labels.

Open **Racing wheel > Wheel buttons & menu controls** to press-to-rebind any action or restore automatic buttons. Rebinding clears duplicate assignments and saves locally per device. Existing steering/pedal calibration is preserved. Held reset buttons fire once; navigation repeats after 400 ms, then at 150 ms intervals. Focus loss or reconnection requires releasing buttons before they activate again.

Defaults use [Logitech's PRO PC button table](https://www.logitech.com/assets/70065/3/pro_racing_wheel_for_pc_samr.pdf) and the browser's [standard Gamepad mapping](https://w3c.github.io/gamepad/). Browser/driver layouts can differ, so every action remains rebindable. Clutch, gears and force feedback remain unused.

Open **Racing wheel** from home, native Controls, or the in-track toolbar. Connect your Logitech PRO in PC mode, calibrate steering/gas/brake, then enable and restart. Chrome/Edge can request read-only Logitech USB access if controller input is unavailable. Clutch, gears and force feedback are not implemented.

Choose steering separately from pedals: **On/off** gives keyboard-style steering past the dead zone, **Assisted** strengthens small turns, and **Proportional** follows the wheel. **Steering strength** (25–100%) reduces maximum steering; 100% on/off matches full keyboard steering. Steering feel sets travel for Assisted/Proportional. Tune or recalibrate inside a normal track, then **Apply & restart this track**. Closing keeps the active run unchanged.

**Original** restores stock car physics and digital pedals, including native brake/reverse. **Modified** keeps Lab tuning and supports proportional throttle and brake-only pedals. After enabling, release both pedals once to arm. Menus, tab focus loss, missing controls and stale input stop wheel commands. Calibration is local; Save/Load wheel setup transfers it between local and published origins, which need separate USB permission. No device commands are sent for force feedback.

Wheel PBs retain their steering mode, strength, response and pedal mode, and use separate setup keys. Wheel replay export is unavailable because the native replay format cannot encode proportional controls. Original public ghosts remain available.
