# Project structure

src/       Narrative, camera, scene, materials, typography and audio
assets/    GLB models and credited project inputs
seed/      Preserved engine shell
tools/     Build, verification, editing and local development
docs/      Preview gallery, licences and speaker script
build.py   Build entry point

The 2D content and 3D scenes share a deterministic presentation clock. Loading/preparation precedes an explicit Start gesture. Source edits are rebuilt into a portable offline HTML; the browser never needs the development logs.

Preview provenance and its limits are recorded in [media/SOURCES.md](media/SOURCES.md).

The complete original classroom delivery is retained separately in the owner's private archive. This public tree keeps the reusable implementation, permitted inputs, attribution and a small verification entry point.
