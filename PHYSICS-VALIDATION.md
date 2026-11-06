# PolyTrack Lab physics validation

The supplied PolyTrack 0.6.3 engine is compiled WebAssembly. Its public interface does not expose physics settings. Lab uses a version-checked adapter in the simulation worker to change real Bullet physics values at each 1 ms simulation step. It does not move the rendered car, alter elapsed time, or skip simulation steps.

Supported settings are acceleration, reverse power, braking, tire grip, steering strength, aerodynamic downforce, additional grounded coasting slowdown, maximum velocity, held-B engine boost, held-N rear handbrake, a grounded J jump, and gravity. Zero maximum velocity means original uncapped behavior. Zero coasting slowdown, boost, handbrake and jump disable those additions. Other settings use 1× for original behavior; zero gravity removes gravitational acceleration while leaving aerodynamic downforce separate.

Applying a profile saves it locally and reloads the game. New workers receive the saved profile. This avoids changing a physics profile partway through a run. Boost adds engine power while B is held and the player accelerates. It does not accelerate a stationary car without throttle. Boost releases on window blur.

Boost, handbrake and jump apply only to player-controlled cars. The worker distinguishes those cars from recordings using their native creation messages. Native recordings do not encode the extra inputs, so profiles with any of these three mechanics enabled save local finish times but disable ghosts and replay playback. Setting all three back to zero restores replay support. N was chosen for handbrake because the original game's H key already toggles its interface.

Handbrake adds braking force only to the rear wheels and scales rear traction to 35% of its configured value while held. Jump adds the configured world-up velocity only on a fresh J press, with at least two wheel contacts and a 750-step cooldown. A car's first jump may wait up to its first 20 simulation ticks for initial wheel contacts. Later airborne presses are consumed without queuing a jump on landing. Cooldown counts simulation steps, so pausing does not spend it. Reset clears cooldown and pending jump input. Boost and handbrake release on window blur.

Built-in presets are Standard, Arcade, Drift, Rocket, Gentle, Stunt park, Low gravity, and Random mix. They populate the same real settings; they do not add hidden physics changes. Low gravity uses a 0.25× gravity multiplier, 0.2× downforce and 1.1× acceleration. It remains replayable because it does not enable extra action keys. Named setups persist separately in local storage, with up to 30 names of at most 40 characters. Saving an existing name updates it. New mechanic defaults preserve previous profile score keys when the mechanics are off; gravity at 1× also preserves existing keys.

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

Car mass, suspension, and collision geometry are not offered as tunable settings. They require additional engine interface work and have not been validated. The fixture tests establish actual physics effects; they do not establish that every extreme combination will be easy to drive on every track. Low gravity increases airtime, and strong engine force or jumps can carry the car outside a track's landing area.

Settings are stored only in this browser's local storage for the site's origin. Clearing browser site data removes them. Hosting the game under a different origin creates a separate local profile.

## Expanded Lab Runway

Runway revision 2 uses 218 native track parts: a broad flat practice pad, an uninterrupted central route from plane start to plane finish, and four optional side launch ramps. The pad spans about 140 meters across and 620 meters along the driving direction. Ramps use native PlaneSlopeUp parts at x = -8 and 8, z = -40 and -76 in track grid units. Flat pad sections extend beyond the ramps for landings. The central route stays flat, so driving straight still reaches the finish without taking a ramp.

The current canonical track ID is `cd9bcb8f107d4de733ecf5c59daaed2d9b83ecb80f790c8e897fc830af28e6dd`. It intentionally differs from the short revision 1 course. `node tests/runway.cjs` verifies native export compression round trip, metadata, canonical hash, all 218 placements, no duplicate origins, the continuous flat finish route, and the four ramp landing areas. The separate community catalog is unchanged.
