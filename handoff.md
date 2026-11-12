# Handoff · K look prototype on top of Final J

Date: 12 November 2026. Author: Claude (Claude Code session). Audience: Codex.

This worktree contains a prototype ("K look") prepared for the `look/k-lighting-prototype` branch that changes only
lighting, surface finish and track dressing on top of the accepted Final J deck.
Cameras, car trajectories, timing, geometry of existing assets and the Monza
setting are unchanged. The owner has reviewed it in the browser and accepted the
direction ("the rest feels good"). Every K change can be switched off with
`?look=j` or `F1LookK.setEnabled(false)`.

## 1. Repository state

- Candidate branch: `look/k-lighting-prototype`. Git is now available.
- The root `index.html` is a newly rebuilt K candidate and is ignored by Git.
- `python build.py` rebuilds it from portable repository inputs. Neither the
  original session's temporary backups nor its temporary K HTML is required.
- The production Final J release remains unchanged. K is default-on only in this
  candidate branch, with `?look=j` available for comparison.
- Codex subsequently completed acceptance and fixed the unbounded fullscreen
  wait. See [the acceptance record](docs/K-PROTOTYPE.md) for fresh measurements,
  actual screenshots, test conditions and remaining observations.

## 2. Files changed

| File | Change |
|---|---|
| `src/j/look-k.js` | **New**. The whole K look (see §3). |
| `seed/final-j-shell.html` | One include added right after `background-look.js`: `<script>@@F1_INCLUDE:src/j/look-k.js@@</script>` (+47 bytes, no other change, no BOM change). |
| `src/cinematic-engine.js` | Line 557, in `warmup()` right after `F1MaterialJ.prepare(...)`: `window.F1LookK?.prepare(i);` The warmup renders that follow compile every K shader variant before Start. |
| `src/j/background-look.js` | Line 185, in `frameLighting()`: the sun height uses `window.F1LookK.sunSlope(daylight.slope)` when K is loaded; falls back to the HDR sun slope. |

The table records Claude's original prototype changes. During acceptance, `src/deck.js` also gained a 1.5 s fullscreen-wait fallback. Documentation and native K preview stills were added; model and texture inputs were not replaced.

## 3. What `src/j/look-k.js` does

All world-only adjustments scale with the world alpha, so cars shown over the 2D
slides keep their accepted look.

**Lighting** (applied in a wrapper around `F1LightStudy.beforeRender`, i.e. after all
upstream per-frame writers):
- Sun elevation 32° instead of the HDR-derived ~48° (via `sunSlope`, so the
  shadow texel snapping in `surface-j.js` stays consistent). Slight warm tint
  `[1, .97, .92]`.
- Hemisphere fill ×0.72, scene environment intensity ×0.8.
- Fog density raised to 0.00055 everywhere **except the opening** (owner found the
  opening misty; opening stays at Final J's 0.0002).
- Values are tracked with a "last value I wrote vs fresh upstream value" pattern
  (`adjust`/`adjustColor`) because several J modules write these every frame.
  Note: three J modules write sun intensity per frame (2.18, 2.6, 2.6+.65·daylight);
  K does not change intensity.

**Surfaces** (chained `onBeforeCompile`, appended `customProgramCacheKey`, shared
uniforms so `tune()` works live):
- Architecture roles: `building` (517 materials: `Imported_Monza_*` box/gstand/walls/
  paddk/misc1/unnamed, precast/stand concrete) albedo ×0.62 with base grime, macro
  weathering and vertical streaks; `barrier` (2) ×0.85; `paving` (10) ×0.76.
- `seat` (25): grandstand seats/cushions tinted light blue-grey `[.36,.45,.53]`,
  amount 0.7. (A darker slate was tried first and rejected: cars lost silhouette.)
- `turf` (5 park grass materials): box-filtered mowing stripes, width 11 m,
  amount 0.09, angle 90° (parallel to the start straight), faded at grazing distance.

**Shadow stability** (fixes for the owner's 5→6 and 2→3 reports):
- `F1SurfaceJ.shadowCenter` is wrapped. Where J returns no authored focus, K centres
  the shadow map on the visible car nearest the camera (plus cars within 24 m),
  instead of the car nearest screen centre. The old rule sometimes picked a
  distant background car and the battle pair stopped casting (logged 47 m / 69 m
  focus jumps in J). With K: no jumps, constant caster count in 5→6.
- Outside the opening, all `Imported_Monza_*`, `Grandstand_*`, `Stand_*` meshes
  have `castShadow`/`receiveShadow` off. Otherwise the 60×52 m near shadow window
  slid across facades as a visible moving edge. The opening (fixed window) keeps
  J's flags. Both program variants are compiled during warmup.
  Shot kind is tracked by wrapping `F1SurfaceJ.setOpening` / `setShot`.

**Track** (`buildTrack`, `patchRoad`, `kerbMaterial`):
- Final J's continuous `Bevelled_kerbs` (both edges, whole route) is hidden on both
  route roots. In its 6.3–7.15 m strip, K adds `K_runoff_apron_±1` meshes that reuse
  the run-off material and UV convention (`uv = (lateral, station) * 0.13`).
- Corner kerbs only, built from `F1Cinematic.circuit().sample()` (corner stations
  261.28–355.50 m): `entry_outside`, `apex_inside` (width 1.25 m) and
  `exit_outside` (1.6 m, where the McLaren runs wide). Same 5 cm height as the old
  kerb, tapered ends, shader-painted 1.25 m red/white blocks with tyre-rubber and
  grime wear. Positive lateral = inside of the left-hand bend.
- The mirrored story route (`Monza_right_route_road`, used by 1→2 and 2→3) gets
  z-mirrored copies with flipped winding; apron UV x is negated to match its run-off.
- Asphalt (`Fine_asphalt`) shader: wandering rubbered band (darker, smoother),
  wider rubber through the corner, braking streaks in the ~150 m before turn-in,
  edge dust, occasional repair patches. Run-off gets dust only. Fine detail fades
  when one pixel spans > ~0.6 m.
- 10 new meshes total, `frustumCulled = false`, `matrixAutoUpdate = false`;
  `F1PerformanceJ.invalidateStatic()` is called after adding them.

**Public API**: `F1LookK.prepare(scene)`, `setEnabled(bool)`, `tune({...})`,
`state()`, `sunSlope(s)`, `enabled`. `tune` keys: `elevationDeg`, `hemisphere`,
`environment`, `fog`, `sunTint`, `stripeWidth`, `stripeAmount`, `stripeAngleDeg`,
and per role `{building|barrier|paving|seat: {albedo, weather, tint, tintAmount}}`.
Toggling at runtime is for A/B only (it may recompile programs).

## 4. Build and checks

```sh
python build.py                      # writes index.html (gitignored)
python tools/check.py                # checks index.html
```

Claude's session checked a temporary K build through a wrapper that swapped only
the target path. Codex subsequently rebuilt the root `index.html` and ran the
standard commands above directly: `status: pass`, 8 slides, 7 transitions, models
and audio match, offline resources only.

## 5. Claude session verification (historical)

These are Claude's reported results. Codex's later independent checks are recorded in [K-PROTOTYPE.md](docs/K-PROTOTYPE.md).

Machine: RTX 5070 Laptop GPU, Chrome 152 in the Claude app's browser pane,
60 Hz display, WebGL drawing buffer 2028×1141, served from `http://127.0.0.1`.
`file://` is refused by that browser, and `requestFullscreen()` never settles there
(Start hangs), so tests stub it to reject before clicking Start; the deck's own
"fullscreen unavailable" fallback then runs.

**Measurement method that matters:** the pane must be *visible* and no screenshots
may be taken during measured windows. The first review's numbers (30 fps stretches,
a 652 ms stall) were artifacts of a hidden pane plus screenshots and were retracted.
Recorder: a rAF loop logging `F1PlaybackJ.state().submitted` (intervals between
rendered frames) plus a `long-animation-frame` PerformanceObserver.

Final K build, full deck at normal speed:

| Sequence | Frames > 25 ms | Notes |
|---|---|---|
| Opening (35.8 s) | 0 | max 17 ms |
| 1→2, 2→3, 3→4, 4→5 | 0 | |
| 5→6 battle | 2 (34 ms) | Final J baseline: 1 |
| 6→7 inspection | 0 | |
| 7→8 | 0 | existing ~125–445 ms block in the key handler (not K) |

Preparation: ~52–61 s on this machine with a warm cache (cold Final J: 107 s).

Visual checks were stills via `F1Briefing.seekOpening` / `seekTransition` with K on
and off. Not verified: full-resolution motion review of every scene, and in
particular the new kerbs during camera moves in 1→2 and 5→6. The owner should watch
those at normal speed.

## 6. Constraints to keep

- Do not change camera paths, car trajectories, timing, or the Monza setting.
- The opening look was accepted; K deliberately leaves its fog and building
  shadows as in Final J. The 32° sun does change opening shadow length.
- Keep shader variants compiled before Start: any new material or program
  variant must be in place before the warmup renders in `cinematic-engine.js`.
- Check pacing only with the visible pane and no screenshots.
- `AGENTS.md`: a DeepSeek worker is available for bounded source investigation;
  its conclusions are not visual verification.

## 7. Current follow-up boundaries

1. K has passed candidate-branch acceptance. Replacing the production J release
   remains a separate decision; this upload does not change that release.
2. The index has been rebuilt and all seven adjacent transitions have completed
   in visible, normal-speed playback. See the separate acceptance evidence for
   sampled-state checks, representative stills and the few long frame intervals.
3. The original Start fullscreen wait now has a timeout. Existing pre-first-frame
   navigation cost and hidden-tab loading yields are still separate work.
4. In 1-to-2 a distant car can cross LightStudy's 37 m shadow-casting radius. If
   this becomes visibly objectionable, investigate with deterministic time-based
   focus/caster rules; do not introduce history-dependent seek behaviour.
5. A static far-shadow layer or baked AO for background architecture is not done.
6. The source-review content suggestions (weighing cost-cap trade-offs, naming
   economic terms and improving footnotes) have not been applied in this look patch.
