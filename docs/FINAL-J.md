# Final J · 12 November 2026

This is the owner's accepted production revision. It preserves the eight-slide
story, Monza location, cameras, car trajectories, fonts and procedural audio.

## What changed

- H's connected grandstands, layered forest, textured bark, sky and denser
  modelled grass extend across the race scenes, including the narrow verge.
- Daylight, sharper HDR reflections, glass, concrete and paint clearcoat improve
  material definition. The default `broadcast` look lifts selected midtones and
  softens highlights in the existing compositor. This is raster PBR, not ray tracing.
- Distant leaf coverage is filtered for the multisampled world pass. It retains
  near cutouts and disables that coverage path during environment captures.
- The opening shadow map covers the actual car formation with fixed extents and
  light-space texel alignment. Stationary cars reuse it; moving cars update it.
  The survey uses its continuous authored light focus. Shadow LOD stays fixed
  through the opening lens move.
- Static matrices and culling results are cached; rigid grid-car shadow meshes
  are batched. Up to six Workers prepare LOD, shadow geometry and visibility
  masks, then terminate before Ready. Playback still uses main-thread WebGL.
- Playback targets **60 fps**, using wall-clock scene time. Resized render targets
  and representative variants are warmed before the Start clock begins.

## Run and rebuild

Download `F1-Economics-Final.html` from the latest Release. Open it in desktop Edge
or Chrome, wait for preparation, then press **Start**. Start requests fullscreen;
arrows change pages, Sound controls the procedural audio. There is no editor,
Replay toolbar, diagnostic overlay or localhost requirement in the release UI.

From a source checkout, using Python 3.9+ and the standard library:

```sh
python build.py
python tools/check.py
```

`seed/final-j-shell.html` includes named modules from `src/` and `src/j/`.
`assets/background-j/resources.json` maps every additional texture or geometry
buffer to a repository-relative input. `assets/manifest.json` retains the original
13-model mapping. The exporter streams those models into a single offline HTML.
It needs neither older development folders nor an owner's absolute file paths.

`src/build.py` and `seed/engine-shell.html` preserve the earlier P42 assembly for
reference; the root `build.py` and `tools/build.py` are the current J build path.
The snapshot CSS and slide markup remain in the final shell; live title, narrative,
camera, environment, dissolve and sound logic remain in named source modules.

## Checks and measured scope

- Source extraction reconstructed the approved J assembler byte-for-byte before
  changing the displayed title/version. Model payloads, eight pages, seven scene
  mappings and the active audio passed the existing offline-output checks.
- A new standalone-file browser check was rejected by the current tool's
  `file://` policy. No alternate browser or protocol was used to bypass it. The
  runtime observations below belong to the accepted J preview, not a new
  standalone-file playback test.
- The original J geometry checks covered rolling, steering, mirror transforms,
  three LODs and shadow-only drawing; maximum world-vertex discrepancy was about
  5.7e-8 metres. These are numerical checks, not claims about visual taste.
- In the controlled opening shadow comparison, 167 parked samples had zero
  shadow-centre movement, one map redraw and 166 reuses. The former selection
  could move the centre roughly 35 m in a 0.1-second sample while cars stood still.
- The last J preview run at **2400×1350** recorded 1,858 frames, 59.99 fps average,
  17.7 ms P95 frame interval and 40.4 ms longest interval. This is one controlled
  browser run, not a zero-stutter or Edge-fullscreen performance guarantee.

Resolution depends on viewport and DPR. Read the actual WebGL drawing buffer;
a 4K monitor does not imply this scene is rendered at 3840×2160. The release
retains the accepted quality policy; it does not enable DLSS or change display Hz.

Earlier README images and the 40-second film show the October final, before J's
background/material revision. They still demonstrate the narrative and are
labelled historical. No new marketing recording was made for this release.

Reusable techniques are documented in the companion
[rendering and frame-pacing guide](https://github.com/Rayman0106/build-cinematic-3d-decks/blob/main/references/rendering-and-frame-pacing.md).
