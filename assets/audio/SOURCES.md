# Presentation audio sources

The engine sound is now generated entirely by source/engine-synth.js. No V6 recording or electric/turbo oscillator is played. The user's original V6 input and rejected sound-bank assets remain available for provenance, but are not embedded or decoded as engine audio.

Six-cylinder combustion impulses feed damped bidirectional exhaust waveguides, a collector and outlet. Flow noise follows combustion and load. The acoustic model is illustrative sound design; it does not reproduce real telemetry or manufacturer-specific engines.

2026-10-14: pipe and outlet filtering now reduces sharp high-frequency resonance; slight per-combustion timing and pressure variation with colored flow noise reduces the regular electronic character. No electric oscillator or engine recording has been added. File-origin AudioWorklet loading uses an embedded data module and a shared inline DSP compatibility path when module loading fails. The same synthesis is used in both renderers.

Gear cadence was informed by [OpenF1 historical Monza data](https://openf1.org/docs/) (2025 qualifying, session 9908, driver 1, lap 17). Observed loaded speed/RPM relationships were rounded for the animation; first gear is illustrative and exact manufacturer ratios/shift transients are not known. Upshifts depend on road speed and per-gear thresholds, downshifts on actual braking. Reference data is not embedded or requested at runtime.

Later 2026-10-14 feedback: downshift rev-matching now has a short, stronger combustion-load/gain accent with a fast transient response. Once the initial braking shift is ready, successive shifts use a 75–87 ms minimum dwell while respecting the next-gear RPM limit and the illustrative corner-gear floor. Generated-signal comparison and replay of unchanged scene speed records confirm a denser braking burst; this is animation sound design, not measured private telemetry. Slow-motion slide handoffs hold the previous engine RPM, load and Doppler pitch and fade volume by time. The visual clock slowing or reaching zero no longer lowers the audible pitch or abruptly deletes a fading voice.

The waveguide structure is adapted from [Antonio-R1/engine-sound-generator](https://github.com/Antonio-R1/engine-sound-generator), MIT, Copyright (c) 2021-2022 Antonio-R1. The license is preserved in docs/Engine-Synthesis-License.txt. The project is based on the physically informed synthesis approach of Baldan et al. (2015). [DasEtwas/enginesound](https://github.com/DasEtwas/enginesound) and [ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim) were also reviewed as design references; their code is not bundled.

[F1 Starting light sound](https://www.youtube.com/watch?v=UodRjBu36FI) by Daniel2134. Existing user-specified first isolated cue, normalized and synchronized to each red lamp. Its source and unchanged hash remain in manifest.json.
