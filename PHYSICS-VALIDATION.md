# PolyTrack Lab physics validation

The supplied PolyTrack 0.6.3 engine is compiled WebAssembly. Its public interface does not expose physics settings. Lab uses a version-checked adapter in the simulation worker to change real Bullet physics values at each 1 ms simulation step. It does not move the rendered car, alter elapsed time, or skip simulation steps.

Supported settings are acceleration, reverse power, braking, tire grip, steering strength, aerodynamic downforce, additional grounded coasting slowdown, maximum velocity, held-B engine boost, held-N rear handbrake, a grounded J jump, and gravity. Zero maximum velocity means original uncapped behavior. Zero coasting slowdown, boost, handbrake and jump disable those additions. Other settings use 1× for original behavior; zero gravity removes gravitational acceleration while leaving aerodynamic downforce separate.

Applying a profile saves it locally and reloads the game. New workers receive the saved profile. This avoids changing a physics profile partway through a run. Boost adds engine power while B is held and the player accelerates. It does not accelerate a stationary car without throttle. Boost releases on window blur.

Boost, handbrake and jump apply only to player-controlled cars. The worker distinguishes those cars from recordings using their native creation messages. Native recordings do not encode the extra inputs, so runs with any of these three mechanics enabled save local finish times without a native recording. Compatible recordings from other setups remain watchable and raceable in isolated engines. Setting all three back to zero restores recording support for new runs. N was chosen for handbrake because the original game's H key already toggles its interface.

Handbrake adds braking force only to the rear wheels and scales rear traction to 35% of its configured value while held. Jump adds the configured world-up velocity only on a fresh J press, with at least two wheel contacts and a 750-step cooldown. A car's first jump may wait up to its first 20 simulation ticks for initial wheel contacts. Later airborne presses are consumed without queuing a jump on landing. Cooldown counts simulation steps, so pausing does not spend it. Reset clears cooldown and pending jump input. Boost and handbrake release on window blur.

Built-in presets are Original, Arcade, Drift, Rocket, Gentle, Stunt park, Low gravity, and Random mix. They populate the same real settings; they do not add hidden physics changes. Low gravity uses a 0.25× gravity multiplier, 0.2× downforce and 1.1× acceleration. It remains replayable because it does not enable extra action keys. Named setups persist separately in local storage, with up to 30 names of at most 40 characters. Saving an existing name updates it. New mechanic defaults preserve previous profile score keys when the mechanics are off; gravity at 1× also preserves existing keys.

The default profile uses the original binary and skips the adapter entirely. Tests also compare the original engine with a hooked engine at default values, checking every byte of sampled 227-byte car states across 2,500 actual Bullet simulation steps. The results match exactly.

## Reproducible checks

Run `node tests/physics.cjs` and `node tests/setups.cjs` from this folder. The physics test uses a flat collision surface and a simple collision hull with the actual supplied WebAssembly engine. The setup test verifies presets, saved setup persistence, update/delete, value normalization, replay restrictions, and old score-key migration. Physics results from the fixture:

| Check | Original | Tuned |
| --- | ---: | ---: |
| Forward acceleration after 2 seconds of throttle | 111.17 km/h | 316.55 km/h at 3× force |
| Braking for 200 ms after acceleration | 62.61 km/h | 55.10 km/h at 3× brakes |
| Reverse after 2 seconds | -45.15 km/h | -80.60 km/h at 3× reverse |
| Coasting for 500 ms | 76.16 km/h | 16.99 km/h at 3/s extra slowing |
| Maximum speed at 3× acceleration | uncapped | 20.00 km/h with 20 km/h cap |
| Rear handbrake for 500 ms after acceleration | 76.16 km/h | 32.73 km/h at strength 3 |
| Highest car position after settling | 0.18 m | 6.92 m with jump strength 12 m/s |
| Airborne vertical velocity after 200 steps | -1.94355 m/s | -0.48589 m/s at quarter gravity; 0 at zero gravity |

Held boost of 2× with normal acceleration produces exactly the same sampled car states as acceleration set to 3×. Steering and grip changes produce different actual car trajectories. Zero downforce changes the simulated trajectory. The downforce adapter changes the three original 0.05 coefficients in the speed-dependent car-local downward force. It is not presented as air resistance.

Repeating the same jump input sequence produces identical sampled car states. A second press during the jump cooldown produces no additional jump. All existing physics checks and the original default-profile state equivalence still pass with the new mechanics disabled.

Gravity tuning changes Bullet's actual mass-scaled gravitational force at rigid-body offset 368 and its gravity acceleration at offset 384 before the native solver step. The supplied engine uses -9.82 m/s²; the native inverse mass at offset 344 converts acceleration to force. It does not directly rewrite position or simulate a jump by changing elapsed time. A 0.25× setting produces one quarter of the original airborne vertical velocity over 200 steps, and zero gravity produces zero fall velocity in the same fixture. Repeated quarter-gravity runs have identical sampled states. Gravity at 1× skips these memory writes.

Maximum velocity is applied before and after the solver step. The cap includes vertical velocity, as stated in the control description. Coasting slowdown only applies with road contact and both throttle and brake released; it uses `exp(-rate × 0.001)` at each native step.

## Scope and limits

The engine adapter is intentionally specific to the supplied 396,005-byte PolyTrack 0.6.3 binary. It verifies the injection location, original downforce instruction bytes, and WebAssembly validity before use. An incompatible engine throws a clear compatibility error. The code documents verified object layouts and checks memory bounds before accessing them.

Car mass, suspension stiffness, and damping stay native. Vehicle sizing now changes the actual collision hull and wheel layout as described below. The fixture tests establish actual physics effects; they do not establish that every extreme combination will be easy to drive on every track. Low gravity increases airtime, and strong engine force or jumps can carry the car outside a track's landing area.

Settings are stored only in this browser's local storage for the site's origin. Clearing browser site data removes them. Hosting the game under a different origin creates a separate local profile.

## Expanded Lab Runway

Runway revision 4 uses 587 native parts 60 meters above Desert, with gray surfaces for contrast. Its connected 3,020-meter route includes a 600-meter straight, four broad braking turns, five ordered checkpoints, four optional side ramps, and landing space. Turn arrows guide the route. The previous straight revision 2 remains a different native track if already saved.

The current canonical ID is `a43aa6d8ca1cb0366f40954ec42b4441fefdb4c01f761051bc11dd5d8591eec1`. `node tests/runway.cjs` verifies the actual native parser, canonical hash, connected route, checkpoint order, ramp landings, and pixel-exact native preview. The separate community catalog is unchanged.

Air-jump fixtures at 12 m/s reached 6.9238 m with one road jump, 22.5580 m with one extra air jump, and 38.1860 m with two extras. Excess presses do not add more impulses. Separate-press timing, grounded recharge, restart state, and deterministic trajectories are tested.

Lab course workers explicitly enable the adapter at startup, including when starting on Original values. Live messages validate known finite fields atomically and reject changes to baked downforce. Gravity explicitly restores the native 1x force after a low-gravity section. Tests cover live field changes, zone entry/exit restoration, ring-plane crossings, course-specific record keys and rule snapshots, corrupt stored data handling, and clean exit reloads. Ring gates are non-colliding bonus detectors; native checkpoints retain responsibility for respawning and finishing.

## Vehicle geometry and expanded controls

Vehicle sizing scales the native Init-message convex-hull vertices and center-of-mass offset before Bullet initializes its actual collision shape. It does not substitute a visual-only chassis. Existing Original initialization remains byte-identical. Verified native wheel connection coordinates, suspension rest length, and radius change independently before the solver step, using native baselines rather than compounding previous values. Tire width is appearance-only because the native wheel model uses raycasts.

The native hull AABB doubles with a 2x scale. An inverted car with every wheel out of contact collides with the ground earlier when body height is doubled: chassis Y at 700 ms is 3.4449 m rather than 2.6488 m. Changing wheel radius from 0.5x to 2x changes the settled car origin from -0.0193 m to 0.4794 m. Combined body, wheel, spacing, wheelbase, and suspension settings repeat deterministically; minimum and maximum geometry combinations remain finite for 5,000 steps.

The expanded finite tuning ceilings were exercised together for 10,000 native steps and repeated byte-identically. That fixture reached roughly 14,624 km/h and 11,196 m height. These are test outcomes, not promised performance on every course. Zero engine/grip/steering settings remain finite. Automatic boost with power 2 matches 3x acceleration, while manual boost off retains stock behavior. Unlimited air jumps still require separate presses and honor the chosen recharge. New default fields preserve earlier preset fingerprints and published version 1.4 Lab course rule identities.


## Independent replay physics

Public ghosts run the unmodified Bullet solver in an isolated native worker initialized with the original chassis hull and downforce. Local recordings carry their saved physics into grouped isolated workers. Each visual car and camera uses that recording's dimensions. Player action keys and checkpoint/zone updates are never forwarded into replay engines. Tests cover message routing, transferable state buffers, bounded group counts, cleanup, nonfatal failures, and 3,000 byte-exact Original native steps alongside a changing custom player. Watching or racing does not write or apply settings.


## Practice scheduling

The solver still advances fixed 1 ms steps. Practice changes realtime scheduling and native control-buffer timestamps, not engine constants or integration precision. Rate changes and pause/resume clear wall-clock debt. Paused step commands advance exactly 1/10/100 native ticks; held inputs affect controllable cars only. Recorded opponents receive matching pacing without player input overrides. Non-realtime replay engines continue following their requested simulation frame.

Tests extract the production scheduler and input handlers, covering all five pacing rates, paused startup, repeated exact steps, no accumulated pause debt, keyboard release, held controls, child-worker forwarding and malformed commands. 3,000 production-scheduled paused steps match direct Original Bullet output byte for byte despite long wall-clock pauses. UI-state tests cover assisted-key isolation, storage rollback, bounded notes and safe course exclusions. Native PB recordings keep immutable settings tags; unsupported self recordings are filtered separately from playable public ghosts.
