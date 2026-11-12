# Licensing scope

The root MIT license covers the locally authored application code and build tools.
Third-party libraries, models, photos, fonts, logos and recordings retain their own rights and notices; MIT does not relicense them.

- Community models and adaptations: [asset attribution](assets/2026_ATTRIBUTION.md), [source records](assets/asset-sources.json) and [concept model](assets/CADILLAC_ATTRIBUTION.md).
- Alpine / Racing Bulls: the owner confirmed that their authors allow redistribution of the supplied converted **GLB** files. No Blender source is distributed. Do not infer permission for further formats or authoring-source redistribution.
- Three.js, included in the engine shell: MIT, Three.js authors. Preserve the bundled notice.
- Fonts: SIL Open Font License; full notices in [Font-Licenses.txt](docs/Font-Licenses.txt).
- Engine-synthesis reference: MIT; [notice](docs/Engine-Synthesis-License.txt) and [references](docs/Engine-Synthesis-References.md).
- News photographs and brand marks: retain their credited owners; see the source records in `src/`. No affiliation or endorsement by Formula One, the FIA, teams or model authors is implied.
- The starting-light recording is a user-provided project sound, credited in [audio sources](assets/audio/SOURCES.md); the root MIT license does not grant an independent stock-audio license.

Unused historic V6 recording inputs and private development logs are excluded. The active engine sound is procedural code.

## Final J background inputs

- Asphalt, base grass, concrete, bark and the HDR daylight sky use the credited
  CC0 inputs in [background source records](assets/background-j/credits/).
  The sky image atlas is derived from the credited Poly Haven HDR source.
- Meadow textures use ambientCG Grass004 (CC0); modelled grass uses Poly Haven
  `grass_bermuda_01` by Rico Cilliers (CC0). Source URLs and modifications are
  retained beside the resources and in the embedded background credits.
- Tree geometry was generated using Daniel Greenheck's EZ-Tree, MIT, with its
  separately credited MIT/CC0 texture inputs. Both notices are retained in the
  [background credits](assets/background-j/credits/).
- The bundled HDR loader and LightProbeGenerator derive from Three.js r186, MIT.
  J does not add a path-tracing library or relicense the existing cars.
