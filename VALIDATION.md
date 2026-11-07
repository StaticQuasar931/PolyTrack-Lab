# Validation

`npm test` passes without installing dependencies. It exercises the original WebAssembly engine including true gravity, local score persistence and profile separation, optional-mechanic replay safeguards, named setups and profile migration, all 263 community-track asset paths, outbound network restrictions, six weekly-refresh scenarios, five public-snapshot scenarios, five snapshot-placement/status scenarios, browser module serving, and the expanded Lab Runway export format.

Browser checks completed on the integrated game:

- Default and custom physics workers start successfully.
- Saving acceleration at 3× reloads the game and retains the value.
- Reset to defaults and Apply restores the default profile.
- Extra Tracks loads 263 entries and launches Turn through the real game parser.
- Weekly Track reports the bundled source and successfully launches Zonda through the real game parser.
- The Physics Lab workshop uses the native game font, surfaces and button styles. Its scales, numeric inputs, presets, and restart controls were visually inspected.
- The original logo was restored from the supplied 0.6.3 files. Native menu styling, loading and button animations are preserved; the Static watermark has text-only color with its original placement and size.
- The wider Physics Lab opens with eight illustrated tiles, including Random mix, compact preset stats, Original explicitly unchanged, and collapsed Advanced tuning. Outside-click dismissal, Advanced scrolling, Low gravity selection/persistence and Reset all/Apply were exercised in the browser. On returning from track screens, the fifth button has no repeated spawn animation.
- The public snapshot badge loads before clicking its tab. Summer 1 displays 100 saved verified results and the reported total. Mouse wheel scrolling moved the native-style result list from its first rows to rows 18 onward; Only verified is absent. Separate tests cover full, partial, empty and missing captures, ties, out-of-range times and custom-physics comparisons.
- Extra Tracks thumbnails load and Most played (snapshot) sorts by saved public-result totals with clear provenance. Custom-track captures can include unverified entries.
- Physics Lab is the fifth home button and is absent from race screens. Startup opens the normal home screen.
- Custom Tracks opens the reused Extra Tracks browser, then imports a selected track into the native pre-race screen.
- Populated and empty Kodub snapshot tabs render separately from local times.
- Lab Runway is accepted by the real game parser and was completed on default physics in 4.529 seconds, producing a new local personal best.
- Expanded Lab Runway XL is accepted by the real game parser and was completed on default physics in 9.095 seconds. Its broad practice pad and four side ramps render in the real game. The original course and record stay separate.
- That finish reopens as first place on the native local leaderboard without a load error. The 4.529-second time survives reloads, a switch to custom physics, and a return to defaults.
- Arcade changes unlocked values while preserving locked acceleration. Named setup saving, lock persistence after Apply, and Reset all were exercised in the browser.
- The first J press on a fresh Stunt park run starts the timer and visibly jumps. The control hint appears above the race HUD, and no Physics Lab button is present during play.
- Extra Tracks search, favorites filtering, pagination, import, and native pre-race navigation were exercised. The weekly selection loads from Community tracks with a saved-source label.

The Kodub download scripts were verified against the real service using the operating system certificate store and official web client request headers. The weekly capture refreshed successfully. The initial leaderboard metadata capture covered all 350 public boards: 344 populated boards, six empty boards, and 26,185 public rows. These score references contain only rank, public nickname, time, and country. Replay capture is separate; its exact current coverage and failures are recorded in snapshots/replays/manifest.json. Browser requests can still use the bundled weekly fallback when cross-origin access is unavailable. The GitHub workflows are included for publication but have not run on GitHub because this remains a local repository.

Physics fixture results and unsupported controls are documented in PHYSICS-VALIDATION.md. Setups with boost, handbrake or jumping enabled retain best times and full settings while disabling ghosts/replays because the native recording format cannot represent the extra mechanic inputs, including remapped keys.

Version 1.3 browser checks also completed:

- The home button remains fifth after both Cancel and Apply in native Settings. The original logo retains its small LAB subtitle.
- Lab key changes appear at the top of the workshop and native Controls. Remapping native acceleration to a Lab key safely reassigns the conflicting Lab action. Native acceleration and Lab keys were restored to W and B/N/J afterward.
- Arcade completed Lab Runway XL in 7.214 seconds. Its setup PB ranks above Original's 9.095 seconds, with physics values and numbered save available on right-click.
- Restoring a different setup and watching its local replay survives the restart and waits for native car-pattern assets before playback. The Arcade replay finishes at 7.214 seconds.
- Summer 1's captured JerrtHu replay plays through the native replay viewer and finishes at 22.010 seconds using the captured native car style.
- A fresh Original run appears in Recent runs with its time and Save #7. Watching that exact archived recording finishes at 9.095 seconds, including when the run ties an existing PB.
- Space followed immediately by held acceleration starts and completes the runway. Held inputs survive the track-start transition without queuing a home-screen jump.
- An extended 10x acceleration draft remains valid after Reset all, disabling Extended ranges, and Undo draft. Applying Original restores stock values.

Automated checks cover 200 bounded run summaries with a 1 MiB recent-replay budget, independently retained setup PBs, exact run/replay lookup, save-number migration, failed-storage rollback, editable key conflicts, safe public-data parsing, native recording and car-style decoding, and ETag/304 caching. Original matches 2,500 native physics steps exactly; all extended maxima remain finite and deterministic for 10,000 steps. Every public project file must remain below 20,000,000 bytes.

Final replay coverage: 19,644 playable native recordings with exact car styles across 263 populated captures, plus five empty/no-board captures. The remaining 82 of 350 requested tracks have no bundled replay capture after API failures and an interrupted bounded recovery pass. Existing score references are preserved. No replay or car style is fabricated for unavailable tracks. The manifest records those gaps, and the resume command can retry them later. The full automated suite also passes from the prepared GitHub folder. All new work remains unstaged and uncommitted.

Version 1.3.1 checks: the full suite passes with the exact Analytics destination exception, blocked Firebase/score uploads, URL sanitization, no save access, denied storage/advertising, and local-preview/privacy-signal exclusions. Google property receipt is not verified from the local HTTP preview, where analytics deliberately stays off. Public Summer 1 rows select multiple ghosts with a visible selected count. Watch selected opens the native replay viewer, displays the recorded car, and Switch car changes JerrtHu to RedBull. Race selected from Arcade restores Original, reloads safely, and starts the same course as a playable race against both ghosts. Local result labels include (you). No staging, commits, pushes, or deployment were performed.

Version 1.4 checks:

- The complete automated suite passes, including native air-jump impulses, live course messages, strict Lab code validation, course record isolation and rule restoration, and the new desert geometry/preview.
- The browser launched a saved Lab package on the 3 km desert course. Its first checkpoint changed gravity to 0.25x, and both ring crossings counted. T restarted with checkpoint 0, rings 0/2, and gravity 1x. Leaving safely reloaded the original home menu. A full timed lap of the new circuit was not completed in the browser; its complete connected route and ordered checkpoints are checked using native track data.
- Original editor export works through Lab tools. A ring placed at the native view center appeared in the actual 3D editor. Exact position, radius, and rotation fields remain editable. Lab objects are not new solid native part types: rings are bonus triggers, pads and fields affect actual physics, and normal checkpoints still control finishing.
- Six visible public results loaded genuine 200px thumbnails from the native car renderer. Selecting JerrtHu and RedBull updated native Opponents/Watch/Play, and native Play displayed both semi-transparent ghost cars beside the player's car. Existing pattern assets are unchanged.
- Extra Tracks exposed Submit a track. The dialog copied a package containing the selected native course and physics recommendation. Contact links match Static's published site. No email or form was submitted and no track was uploaded.
- The existing GitHub Pages run was inspected read-only: build succeeded, deployment failed with "Timeout reached, aborting!". No deployment settings were changed and the run was not rerun. The public .nojekyll file supports direct static hosting when Pages uses a branch.

Version 1.5 checks:

- The complete automated suite passes with 26 controls, three tuning ranges, automatic boost, separate jump recharge settings, and unlimited fresh-press air jumps. Existing Original and preset fingerprints and published 1.4 course rule keys retain their identities.
- Native WebAssembly tests verify scaled chassis hulls and real wheel radius, contact spacing, wheelbase, and suspension. Inverted airborne cars demonstrate actual chassis collisions. Original remains byte-identical, and combined Sandbox maxima remain finite and deterministic for 10,000 steps. Acceleration is finite up to 1,000x; speed limit 0 removes the added velocity cap.
- Rendering tests cover local chassis axes, wheel alignment, native mirrored wheel scales, repeated updates, reset behavior, preview isolation, and size-aware follow/cockpit cameras. Wheel width is explicitly appearance-only.
- An isolated software-rendered Chrome browser opened Vehicle studio, rendered the native car preview, applied Monster wheels, selected Sandbox, and saved acceleration 1,000x, automatic boost, and unlimited air jumps. All three settings survived the real Apply/reload transition. A 2x car with 1.7x wheel radius and 1.8x tire width loaded and drove in Summer 1 with the adjusted camera.
- No new application errors occurred in these flows. Kodub's live weekly request was blocked by its cross-origin response in the local preview; bundled weekly files remain available. Browser screenshots and test browser data stay outside the public repository.

Version 1.6 checks:

- The full suite passes with independent replay-engine routing, byte-exact Original replay simulation beside a custom player, cross-setup local recordings, preserved settings after repeated public Watch/Race requests, keyboard focus handling, and exact custom-setup restoration after course exit.
- In an isolated Chrome browser, Space selected a focused Summer 1 ghost row without starting Play. Racing JerrtHu then displayed a full-size translucent Original car beside a half-size player with 3x acceleration and 1.7x wheel radius. The saved settings remained unchanged and no replay engine error appeared. Watching that public recording finished at exactly 22.010 seconds with all three checkpoints.
- Vehicle studio quick navigation opens and scrolls to the requested controls. The Mini plus Monster wheels preview is square, centered, visibly smaller, and labels effective body and wheel dimensions. Small cars retain the stock chase distance; recordings use their own dimensions and camera settings.
- Space from the background of the normal Skyway pre-race screen started the elevated course with the custom Mini setup. The separate Boosts & Rings demo loaded visible green pads, gold rings, and blue fields 60 m above the desert. Driving straight counted a ring. Exiting restored acceleration 3x, car scale 0.5x, wheel radius 1.7x and cleared course mode. The entire 3 km demo was not driven to completion; native route/checkpoint tests validate its connected geometry and object placement.
- Local preview errors were limited to Kodub's existing cross-origin weekly-feed rejection. No player data was uploaded. Browser screenshots and profile data remain outside the public repository.

Version 1.7 checks:

- Apply physics from home rebuilds the two native simulation workers and the native home state while preserving loaded audio, models, textures, renderer, catalogs and page state. It waits for engine readiness; course transitions, pending run restoration, unsupported runtime states and failed restarts use the complete-reload fallback. Saves and numbered setup history are written before either path.
- Browser measurement for a Mini size Apply was 803 ms from button click to closed dialog with no page navigation. This is one local software-rendered Chrome measurement, not a device-wide speed guarantee. A second Apply changed to Giant and 3x acceleration, then launched Summer 1 against an Original public ghost without a page reload or new simulation error.
- The native realtime worker previously ran its first animation callback before declaring timing state if Init arrived while WebAssembly was still loading. Timing state now initializes before queued messages; the worker posts readiness only after initialization. A real native-worker test reproduces that queued startup path with requestAnimationFrame support.
- Tests cover repeated replacement, original unscaled Init reuse, preserved manager listeners, ignored retired-worker messages, disposal, settings rollback and safe fallback. Browser errors after the successful restart were limited to the existing blocked local weekly feed. The full automated suite passes.
