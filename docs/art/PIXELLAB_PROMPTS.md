# PixelLab Prompts: Party and Enemies

Copy-paste prompts for making the battle sprites in PixelLab. Designs follow
`CHARACTERS_AND_WORLDS.md`, the HD-2D sprite rules in `ART_STYLE.md`, and the colour ramps
already used in `demo2/js/actors.js`, so new sprites match the demo.

## 1. Workflow (do this in order)

1. **Make one base sprite per character first** (the idle pose below). Generate 4–8 versions and
   keep the best one. This is the character's "model sheet".
2. **Use that base sprite as the reference / init / style image** for every other pose and for the
   animations. This is what keeps the face, colours and outfit the same across poses.
3. **Keep the settings identical** for the whole party (same canvas size, view, outline, shading,
   detail). Make enemies with the same settings, only on a bigger canvas.
4. **Animate from the pose**, not from scratch: idle → walk → attack, and so on.
5. Export PNG with a transparent background. Keep the original PixelLab output and don't resize
   it in other tools (resizing blurs pixel art). The game scales it up with nearest-neighbour.

## 2. Settings for every sprite

PixelLab's option names change between versions and modes. Use whichever of these your screen has.

| Setting | Party | Enemies |
|---|---|---|
| Canvas | 64×64 (character ≈ 48–56 px tall) | Thornwolf / Lumen Moth 128×128, Bramble Golem 128×128 or larger |
| View | Side view (low angle, slight 3/4) | Same |
| Direction | Facing **west / left** (party stands on the right) | Facing **east / right** |
| Outline | Single colour, dark (or "selective outline" if offered) | Same |
| Shading | Medium | Medium to detailed |
| Detail | Medium to high | High |
| Background | Transparent | Transparent |

> Want the bigger, painterly look of `style_target.jpg` instead of Octopath-size sprites? Use
> 128×128 for the party and 256×256 (or the largest size) for enemies, and set shading to detailed.

### Style line (append to every prompt)

```
HD-2D JRPG battle sprite, Octopath Traveler inspired pixel art, chibi-leaning proportions about 1:3.5 heads, hue-shifted shading with purple shadows and warm highlights, dark coloured outline not pure black, light from top-left, clean readable silhouette, transparent background, no text, no effects
```

### Things to avoid (add to a negative prompt if your mode has one)

```
blurry, anti-aliased edges, gradient background, ground shadow, text, watermark, magic effects, multiple characters, cropped feet, realistic proportions
```

Spell effects, glows and rune circles are added by the game (`tools/spellfx`), so keep them out
of the sprites. The only exception is a small glowing staff orb.

---

## 3. Party

### Aruna Valemar: Mage (protagonist)

Palette: skin `#a26e52`, hair `#2e221c`, indigo robe `#434a72`, slate cloak `#34404c`,
saffron shawl `#b8843e`, gold `#a88440`, orb `#ff80d0`.

**Base / idle**
```
young woman mage, warm brown skin, long dark brown hair in a loose braid, thin gold circlet with a small crescent, long indigo robe, saffron shawl embroidered with tiny gold stars and suns, dark slate travelling cloak, leather belt with a small notebook and pouches, brown boots, holding a tall wooden staff topped with a crescent moon cradling a glowing pink orb, calm curious expression, standing idle
```

**Poses** (base sprite as reference; replace the last phrase of the base prompt)
| Pose | Ending to use |
|---|---|
| Cast | `both hands raising the staff high, orb glowing brighter, robe and shawl lifting, focused expression` |
| Attack wind-up | `staff pulled back over shoulder, leaning back, weight on back foot` |
| Attack | `swinging the staff forward in a wide arc, leaning forward, cloak trailing` |
| Hurt | `recoiling backward, eyes shut, arm raised to shield face, staff held low` |
| KO | `kneeling on one knee, leaning on the staff, head bowed` |
| Victory | `spinning the staff and holding it upright, smiling, one hand on hip` |
| Defend | `holding the staff horizontally in front of her body, braced` |

**Animations** (animate from the idle sprite)
- Idle (4–6 frames): `gentle breathing, shawl and cloak sway, orb softly pulses`
- Walk (6–8 frames): `walking forward, robe swishing, staff in right hand`
- Cast (6–8 frames): `raises staff overhead, orb flares, robe lifts as if in wind, lowers staff`

**Portrait (128×128)**
```
bust portrait of a young woman mage, warm brown skin, dark braided hair, gold crescent circlet, indigo robe collar with saffron shawl, curious bright eyes, slight smile, three-quarter view facing left, pixel art, hue-shifted shading, plain dark teal background
```

### Ayo Quispe: Duelist (warrior/rogue)

Palette: skin `#5e3c26`, hair `#221812`, green tunic `#2e5c44`, rust bands `#a8602e`,
red sash `#8a3a30`, trousers `#523c26`, wraps `#948868`, brass `#a88440`.

**Base / idle**
```
young man duelist, deep brown skin, short dark twisted hair tied back, short woven poncho in forest green with stepped geometric bands in rust orange and cream, red cloth sash, brown loose trousers, cream cloth wraps on forearms and shins, bead and brass necklace, small brass earrings, two short curved blades held low in reverse grip, light rhythmic stance on the balls of his feet, wry half smile, idle
```

**Poses**
| Pose | Ending to use |
|---|---|
| Attack wind-up | `crouched low, blades crossed behind him, coiled like a spring` |
| Attack | `lunging forward in a fast cross slash, both blades extended, poncho flaring` |
| Skill / dance strike | `mid-spin on one foot, blades sweeping out in a circle, poncho twirling` |
| Hurt | `knocked back, sliding on his heels, one blade raised defensively` |
| KO | `down on one knee, one blade planted in the ground, breathing hard` |
| Victory | `twirling both blades and sheathing them, confident grin` |
| Dodge | `leaning far back in a sidestep, body low, blades out to the sides` |

**Animations**
- Idle (4–6 frames): `bouncing lightly in rhythm, blades turning in his hands`
- Walk (6–8 frames): `light quick steps, poncho swinging`
- Attack (6–8 frames): `dash forward, double cross slash, spin, hop back to stance`

**Portrait**
```
bust portrait of a young man with deep brown skin, short dark twisted hair tied back, woven green poncho with rust stepped geometric bands, bead and brass necklace, wry half smile, guarded eyes, three-quarter view facing left, pixel art, hue-shifted shading, plain dark teal background
```

### Serafina Vidal: Warden (healer/tank)

Palette: skin `#e2ae94`, silver hair `#b8b4c0`, crimson cape `#62282c`, wine skirt `#4a2630`,
steel `#737884`, greaves `#464a52`, gold `#a88440`.

**Base / idle**
```
elf woman knight, fair skin, long silver-lilac hair, long pointed elf ears, ornate silver breastplate and pauldrons with gold filigree, white lace collar, crimson cape with gold trim, layered flounced wine-red skirt over steel greaves, round steel shield with a gold sun emblem on her left arm, slender lance held upright in her right hand, upright proud posture, warm determined expression, idle
```

**Poses**
| Pose | Ending to use |
|---|---|
| Defend / guard | `crouched behind the raised sun shield, lance braced, cape swept forward` |
| Parry | `snapping the shield outward to deflect, body twisted, cape flaring` |
| Attack wind-up | `lance drawn back at shoulder height, shield forward, weight back` |
| Attack | `lunging lance thrust forward, cape streaming behind her` |
| Heal / cast | `lance planted upright, free hand raised open-palm, eyes closed in prayer, cape settling` |
| Hurt | `staggered back behind her shield, one knee bending` |
| KO | `kneeling, shield on the ground, head lowered, hair falling forward` |
| Victory | `lance raised high, cape swirling like a bullfighter's cape, proud smile` |

**Animations**
- Idle (4–6 frames): `slow breathing, cape and skirt sway, hair moves slightly`
- Walk (6–8 frames): `measured armoured steps, cape swinging`
- Cape flourish (6–8 frames): `sweeps the crimson cape in a wide arc like a matador, then settles into guard`

**Portrait**
```
bust portrait of an elf woman knight, fair skin, long silver-lilac hair, long pointed ears, silver armour with gold filigree, white lace collar, crimson cape, warm determined eyes, three-quarter view facing left, pixel art, hue-shifted shading, plain dark teal background
```

### Kael Dravin: Disgraced knight-healer (substitute)

The docs don't describe his look yet, so this is a suggested design that fits his story
(Serafina's former order, disgraced, heals by hitting). Change anything that doesn't fit.

**Base / idle**
```
rugged man in his forties, tan weathered skin, short greying dark hair, stubble, scar across one eyebrow, battered dark steel armour, faded ash-grey tabard with a sun emblem scratched out, torn crimson half-cape, bandaged hands, heavy flanged mace with a faint green-gold glow resting on his shoulder, tired but steady expression, idle
```

**Poses**
| Pose | Ending to use |
|---|---|
| Attack wind-up | `mace raised high over his head with both hands, leaning back` |
| Attack | `smashing the mace down in an overhead strike, body following through` |
| Lifesteal hit | `mace pressed into the ground, green-gold light flowing up his arms` (the one pose where a small glow is fine) |
| Hurt | `grunting, stepping back, arm across his chest` |
| KO | `collapsed to one knee, mace on the ground, hand on his chest` |
| Victory | `mace back on his shoulder, small rueful smile` |

**Portrait**
```
bust portrait of a rugged man in his forties, weathered tan skin, short greying dark hair, stubble, scar across one eyebrow, battered dark steel armour, grey tabard with a scratched-out sun emblem, tired steady eyes, three-quarter view facing left, pixel art, hue-shifted shading, plain dark teal background
```

---

## 4. Enemies (World 1: Verdance)

Enemies face **right**. HD-2D enemies are bigger and more detailed than the party and move
mostly by breathing and swaying, so the idle sprite matters most.

### Thornwolf

Palette: fur `#335f3e`, mane `#244632`, belly `#86986a`, bone `#d6c896`, mouth `#b02a34`.
```
large forest wolf made of mossy green fur with a dark green bramble mane full of thorns, pale olive belly, bone-white horn-like thorns along its spine, glowing amber eyes, snarling, low hunting stance, facing right, HD-2D JRPG enemy sprite, Octopath Traveler inspired pixel art, detailed hue-shifted shading, dark coloured outline, transparent background, no text
```
Poses: `lunging bite with jaws wide open`, `howling with head raised`, `recoiling hurt with ears flat`.

### Bramble Golem

Palette: bark `#63432a`, stone `#767a90`, moss `#4a8434`, gold `#a88440`.
```
towering golem made of twisted bark and grey carved stone plates, thick moss and ferns growing on its shoulders, ornate gold filigree swirls inlaid in the stone, a single round gold-rimmed eye socket glowing in its chest, huge root-like arms reaching the ground, heavy and ancient, facing right, HD-2D JRPG boss sprite, Octopath Traveler inspired pixel art, detailed hue-shifted shading, dark coloured outline, transparent background, no text
```
Poses: `raising both arms overhead for a ground slam`, `slamming fists into the ground`, `staggering back with cracks glowing`.

### Lumen Moth

Palette: wings `#5446aa`, fur `#dac08a`, eyes `#6af0f0`, gold `#a88440`.
```
giant moth with broad violet wings patterned with gold filigree swirls and pale eye spots, fluffy cream fur body and collar, feathery antennae, large glowing cyan compound eyes, hovering, wings spread, facing right, HD-2D JRPG enemy sprite, Octopath Traveler inspired pixel art, detailed hue-shifted shading, dark coloured outline, transparent background, no text
```
Poses: `wings swept forward releasing a gust`, `wings folded, diving`, `fluttering backward hurt`.
Animation: `slow hovering wing beats, body bobbing gently` (4–6 frames).

---

## 5. Getting consistent results

- **Same face every time:** always generate poses from the chosen base sprite, never from text
  alone. If a pose drifts, paste the palette hex codes into the prompt or use the base sprite's
  palette if your mode lets you lock it.
- **Too much detail / mushy at 64 px:** cut the prompt down to silhouette features (hair shape,
  cape, weapon, main colours) and drop small items like the notebook or earrings.
- **Wrong facing:** say the direction twice ("facing left, looking left") and pick the west/left
  direction setting.
- **Weapons too small:** HD-2D weapons are slightly oversized on purpose. Add `oversized weapon`.
- **Party looks mismatched:** make all four base sprites in one session with identical settings,
  then put them side by side before making any poses.
- **Cultural details:** keep motifs as invented fantasy patterns (stars, suns, stepped geometric
  weaves, tile patterns), not real religious symbols. See "Cultural approach" in
  `CHARACTERS_AND_WORLDS.md`.

## 6. Checklist

| Character | Base | Poses | Idle anim | Walk | Attack/cast anim | Portrait |
|---|---|---|---|---|---|---|
| Aruna | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Ayo | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Serafina | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Kael | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Thornwolf | ☐ | ☐ | ☐ | – | ☐ | ☐ |
| Bramble Golem | ☐ | ☐ | ☐ | – | ☐ | ☐ |
| Lumen Moth | ☐ | ☐ | ☐ | – | ☐ | ☐ |
