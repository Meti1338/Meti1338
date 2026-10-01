# Demo 3: animating a single painted sprite

Takes one AI-generated pixel-art frame (`art/mage_reference.webp`) and animates it without
redrawing it, the way HD-2D games animate large sprites. Open `index.html` directly (works from `file://`).

| Animation | What moves |
|---|---|
| Idle (loop) | 2 px breathing, hair and cape sway, orb bobbing with orbiting sparkles, blink, staff embers |
| Cast | lean back, rune circle, particles gather into a growing orb, orb flies to a target and bursts, new orb pops into the hand |
| Staff Slam | crouch, hop, landing squash and shake, ground shockwave, a line of crystal spikes that shatter |
| Hurt | white flash, red tint, knockback with shake, sparks at the impact point |
| Boost (loop) | gold rim light hugging the silhouette, rising light streaks |
| Victory | two hops, orb orbits the body (passes behind), golden motes, sparkle burst |

Previews: `gifs/*.gif`. Transparent sprite sheets (12 fps, 360×240 per frame, 8 per row): `sheets/`.

## How it works
- **Cutout:** `tools/cutout.py` removes the flat background (including enclosed pockets) and embeds the PNG as `js/sprite_data.js`.
- **Rig:** `RIG` in `js/animator.js` holds hand-measured landmarks: feet pivot, belt line, hair, cape zones, staff line, orb box, staff crystal, eye pixels.
- **Deformation:** each output pixel samples the source at an offset (torso rows rise, cape zones sway, hair sways). The staff line is excluded so the cape never drags it.
- **Layers:** the orb is lifted into its own layer, so it can bob, grow, fly and orbit.
- **FX:** glows, rings, rune circles, sparks and spikes are drawn in sprite pixels with ordered dithering, so they match the art.
- Every frame is a pure function of `(animation, time)`, so exports are deterministic.

## New sprite
1. `python3 tools/cutout.py <image> art/<name>.png js/sprite_data.js`
2. Update the `RIG` coordinates for the new art (measure on the cutout).
3. `node tools/export_frames.mjs out/frames 12 forest && python3 tools/build_gifs.py out/frames gifs --only gif`
   and `node tools/export_frames.mjs out/frames_t 12 none && python3 tools/build_gifs.py out/frames_t sheets --only sheet`.

Limits: limbs can't bend into new poses (no new arm or staff swing), because only the one drawn frame exists.
For real swing and stride poses, generate the key poses (wind-up, strike, cast, hurt) in the same style
and run each through the same pipeline.
