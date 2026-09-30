# Art Style Study: HD-2D (Octopath Traveler 1 & 2) and How We Adapt It

This is a study of *how* the HD-2D look works, so we can build our own version. We copy the
techniques, not the assets: every sprite, enemy, map and effect in our game is original.

## 1. What makes HD-2D recognisable

| Element | Octopath Traveler 1 | Octopath Traveler 2 | Our take |
|---|---|---|---|
| Characters | ~32–48 px tall pixel sprites, 1 px coloured (not black) outline, 3–4 tone ramps with hue-shifted shadows | Same, more frames, more expressive battle poses | Same scale (≈40 px at 480×270), hue-shifted ramps, selective dark outline |
| Enemies | Much larger than party (1.5–3×), high-detail, few frames; animated by sway/breathing, white hit flash | Same, plus more idle motion and bigger bosses | Rigged enemies (limbs, tails, wings) so they breathe, wind up and lunge |
| World | 3D geometry with pixel textures, point sampled, miniature "diorama" feel | Brighter, more saturated, more light sources | Layered parallax diorama with baked perspective |
| Camera | Fixed tilted perspective; tilt-shift depth of field top and bottom | Battle camera pushes in and pans on skills | Parallax pan + zoom punches on big hits and Breaks |
| Lighting | Bloom, god rays, vignette, warm grading, point lights from torches | Dynamic light from spells lighting the whole scene | Spell lights tint the scene and rim-light sprites |
| Particles | Mix of crisp pixel particles and soft 3D glows | Denser, more colourful | Pixel particles in the low-res layer, additive glows above |

## 2. Character sprite rules
- **Proportions:** about 1:3.5 head to body; big readable silhouettes; weapons slightly oversized.
- **Palette:** each material uses a 4-colour ramp. Shadows shift toward purple/blue, highlights toward yellow/warm.
- **Lighting:** key light from top-left front; warm rim light from the back-right (sun or spell).
- **Outline:** 1 px outline that is a dark version of the neighbouring colour (not pure black).
- **Dithering:** small ordered dithering only at shade boundaries on large surfaces.
- **Facing:** party faces left toward enemies, in 3/4 view.

## 3. Animation language (the most important part)
Octopath battles are readable because every action has the same rhythm:
1. **Anticipation:** step forward, wind up, weapon pulled back, or a magic circle opens under the caster.
2. **Action:** fast smear/slash arc, big pixel slash sprite, or spell released from above/below the target.
3. **Impact:** hitstop (a few frozen frames), white flash on the target, screen shake, sparks, damage number that pops and bounces.
4. **Follow-through:** weapon ends past the target, character slides back to their spot.

Spells get extra layers: a glowing rune circle, rising motes while charging, the element effect with
scene-wide coloured light, then lingering embers/leaves/dust.

**Boost** makes everything bigger: an aura of rising light around the character (gold → orange → white-hot for 1–3 BP), more hits, bigger effects.

**Break** is a moment: the shield icon shatters, the enemy flashes and goes dim, big "BREAK" text slams in, the camera punches in.

**Enemy death:** the sprite dissolves into rising pixels with a flash.

## 4. Our adaptation
- Palette per world (see `CHARACTERS_AND_WORLDS.md`): Verdance is golden-hour greens and amber; Ashmarch terracotta, gold and lantern light; Hollowmere teal mist and silver.
- Magic is the one thing drawn "above" the pixel style: rune circles and glows are sharper and brighter than the world, so the story's theme (magic is special and mysterious) shows in the art.
- Character heritage shows in costume and palette: Aruna (indigo robe, saffron shawl, gold circlet, crescent staff), Ayo (woven poncho with stepped geometric bands, bead necklace, dual blades), Serafina (elf ears, silver armour, crimson cape and flounced skirt, sun-emblem shield, lance).

## 5. Unreal implementation notes
- Sprites: Paper2D flipbooks or a custom lit sprite material (base colour + normal map) on camera-facing quads, point sampling, no mips.
- Camera: perspective with a low FOV (≈20–30°) from far away to get the miniature look; Cine Camera for battle pushes.
- Post process: Cinematic DoF (focus on the battle line), Bloom (Convolution for spell flashes), Lens Flares off or subtle, Vignette, colour grading LUT per world.
- Lights: spell Niagara systems spawn short-lived point lights; sprites use a lit material so they pick up spell colour.
- Hitstop: set global time dilation to ~0 for 50–90 ms on impact; camera shake via Camera Shake assets.
- Dissolve: material dissolve with a noise texture plus Niagara pixel particles sampled from the sprite.
