# Style Target (chosen)

Reference: `style_target.jpg` (made by the project owner with an AI image tool). This replaces the
earlier code-generated pixel style. Everything below describes this image so new assets match it.

## What defines the look
- **Painted "HD pixel" illustration**: high resolution (≈1366×768), painterly shading with a crisp,
  slightly pixelated edge quality. Not low-res pixel art.
- **Outlines**: bold dark-brown outlines on characters and enemies; thinner, softer outlines on props.
- **Proportions**: party members are small but not chibi (about 1:4.5 heads), readable silhouettes.
  Enemies are large (golem ≈ 2.5× a hero).
- **Detail**: ornate gold filigree and swirl patterns (golem armour, moth wings), carved stone, moss,
  wood grain; fine grass blades, pebbles, cracked dirt.
- **Palette**: warm natural greens and ochre dirt, saturated but not neon; violet/gold accents on magic
  creatures; cream sky with soft clouds.
- **Lighting**: sunlight from upper-left/centre, strong god rays and bloom, soft haze in the distance,
  darker framing trees in the foreground corners (vignette by composition).
- **Depth**: background trees blurred and hazier, mid-ground crisp, foreground grass slightly blurred.
- **UI**: clean light serif/sans labels ("ROUND 4", "NEXT"), square portrait icons with coloured
  frames (teal for party, red for enemies), dark translucent plates with shield badges and weakness icons.

## Asset list to generate in this style
Keep the same tool, same style prompt, same lighting. Ask for **flat magenta (#FF00FF) or transparent
backgrounds** for anything that moves, so it can be cut out cleanly.

| Asset | Size | Notes |
|---|---|---|
| Battle background (Thornwood clearing), **no characters** | 1920×1080 | Same scene as the reference, empty |
| Foreground grass/tree overlay | 1920×1080, transparent | Optional, for depth-of-field layering |
| Aruna (mage), Ayo (duelist), Serafina (warden) | each ≈ 256 px tall | Facing left, poses: idle, attack wind-up, attack, cast, hurt, KO, victory |
| Kael (substitute) | ≈ 256 px tall | Same poses |
| Bramble Golem, Thornwolf, Lumen Moth | 512–768 px tall | Facing right, poses: idle, attack, hurt (idle alone is enough to start) |
| Portrait icons | 128×128 | One per character/enemy, square |
| Weakness icons | 64×64 | Blade, Spear, Staff, Fire, Wind, Earth, "?" |
| Effects (optional) | 512×512 | Slash arc, fire burst, tornado, rock spikes, heal pillar, parry flash |

### Prompt template
> "{subject}, full body, {pose}, facing {left/right}, 2D HD pixel-art style game sprite, painterly
> shading, bold dark outline, warm fantasy forest palette, ornate gold details, same style as
> reference image, isolated on flat magenta background, no shadow, no text"

## How the assets will be used
- Background plate + foreground overlay replace the code-drawn diorama; depth of field, bloom,
  god rays and spell lighting stay as real-time effects on top.
- Character poses are swapped per animation frame and blended with squash/stretch, lunges, hit flash
  and knockback; enemies animate by deformation (breathing, sway, lunge) like HD-2D enemies.
- All battle logic, Break/Boost, parry/dodge timing and spell effects stay as they are.
