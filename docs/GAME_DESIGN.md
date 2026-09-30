# HD-2D Turn-Based RPG — Design & Technical Plan (Unreal Engine 5)

Working title: *TBD*. Reference: Octopath Traveler (HD-2D look, Break/Boost combat, per-character paths).

## 1. Pillars

1. **HD-2D look**: pixel-art sprites living in a 3D diorama, with cinematic lighting and shallow depth of field.
2. **Tactical turn-based combat**: exploit weaknesses, break shields, spend boost points for big turns.
3. **Characters with distinct field abilities and stories** (later milestones).

## 1b. Story & Setting

**Premise**: A mage sets out to discover where magic truly comes from. Magic is real and widely used, but nobody knows its source. Clues point to a hidden **Core**, and the trail leads across different worlds.

**Protagonist**: the Mage (name TBD), a scholar-adventurer driven by curiosity rather than revenge or destiny. They are the fixed lead; the other two party members are companions met along the way (see 2.5).

**Structure**: a hub-and-worlds journey.
- Each **world** is a self-contained region with its own biome, culture, and a different *theory of magic* (e.g. magic as a living force, as a debt, as stored memory, as a machine, as a shared dream).
- Each world yields a **fragment of truth** plus a new spell school or element for the Mage, which ties progression to the story and to combat weaknesses (section 2).
- Travel between worlds uses a recurring device (a gate, a tome, a ley-line ship; TBD), which also serves as the hub.
- Worlds can be played in a loose order, like Octopath chapters, then converge on the final world.

**Arc**
1. *Spark*: an anomaly in the Mage's home world shows that magic is weakening or behaving oddly; the local explanation doesn't hold up.
2. *Journey*: in each world the Mage studies local magic, helps with a local crisis, and recovers a fragment. Companions join for their own reasons (e.g. one who distrusts magic, one who lives by it).
3. *Revelation*: the fragments show that the worlds' magics are all linked to one **Core**.
4. *The Core*: the Mage reaches it and must decide what to do with the truth. Ending options are TBD (e.g. protect it, free it, merge with it).

**Themes**: curiosity vs. consequence, knowledge as a responsibility, magic as something shared rather than owned.

**Open story questions**: What is the Core (a being, a place, a process)? Who are the two companions? Is there an antagonist, or is the tension the discovery itself? How many worlds (suggest 4 + final, to fit the 3-character scope)?

## 2. Combat Core (Milestone 1)

### 2.1 Rules
- **Turn order**: all combatants sorted by Speed each round; a preview bar shows the next N turns. Recomputed at start of each round, and when Break/stun changes who acts.
- **Shield Points (SP)**: each enemy has N shields (e.g. 2–6) and a list of **weaknesses** (weapon types and elements).
- **Break**: hitting a weakness removes 1 shield (multi-hit skills remove 1 per hit). At 0 shields the enemy is **Broken**: loses its next turn, takes bonus damage (x1.5), and its shields restore when it recovers.
- **Boost Points (BP)**: each party member gains +1 BP at the start of each round (max 5). On their turn a character may spend up to 3 BP to:
  - Basic attack: hit count +1 per BP spent.
  - Skill: power multiplier scales per BP (skill defines its own scaling).
- **Skills** cost MP; basic attacks are free.
- **Damage formula (initial, tunable)**:
  `damage = (Attack * Power * BoostMult * WeaknessMult * BreakMult) - Defense*k`, with small random variance (±5%). Multipliers live in a data table.
- **Win/lose**: party wiped → defeat; all enemies dead → victory (XP, gold, drops).

### 2.5 Party size (decision)
- **3 playable characters, all active, no reserve bench and no swapping mid-battle.** Octopath's 8-character roster with 4 active slots is deliberately not used.
- Why: fewer, deeper characters; less art and balancing cost; simpler UI and turn-order bar; each character's skills matter every fight.
- Design consequences: each character needs a clear role and weapon/element coverage so the 3 together can hit most enemy weaknesses; BP is tracked per character; enemy encounters are tuned around 3 actors (typically 2-5 enemies).
- `PartySize` is a single constant/data setting, so changing it later (e.g. to 2 or 4) needs no architecture changes.

### 2.2 Data model (data-driven; Data Assets / Data Tables)
| Type | Fields |
|---|---|
| `FCombatantStats` | MaxHP, MaxMP, Attack, Defense, Speed, MagAtk, MagDef |
| `UAbilityData` | Name, MPCost, TargetMode (Single/All/Self/Ally), DamageType, Element/WeaponType, Power, HitCount, BoostScaling, Effects[] |
| `UEnemyData` | Stats, ShieldCount, Weaknesses[], AbilityList, AI profile, drops |
| `UCharacterData` | Stats, equippable weapon types, abilities, growth curve |

### 2.3 Runtime architecture (C++ core, Blueprint/UMG on top)
- `UBattleManager` (Game Instance Subsystem or actor): state machine.
  `Start → RoundStart → NextTurn → AwaitAction → ResolveAction → CheckEnd → (NextTurn | RoundEnd) → End`
- `UCombatantComponent`: HP/MP/SP/BP, status (Broken), weaknesses revealed. Broadcasts delegates (`OnDamaged`, `OnBroken`, `OnDied`, `OnBPChanged`).
- `FBattleAction`: Actor, Ability, Targets[], BoostSpent. Resolved by pure functions (easy to unit test with Automation Tests, no world needed).
- `UTurnOrderQueue`: pure logic class for sorting/preview.
- `IBattleAI`: enemy decides an action from state (start with weighted random + "target weakness" heuristic).
- UI (UMG): turn-order bar, command menu, boost pips, shield icons with revealed weaknesses, damage numbers.
- Keep **logic and presentation separate**: resolver emits events, animation/VFX layer plays them. This allows headless tests.

### 2.4 Test plan
- Automation tests for: turn order with ties, shield decrement on weakness, break/recover timing, BP accrual and cap, damage multipliers, multi-hit.

## 3. HD-2D Look (Milestone 2)
- **Sprites**: paper-flipbook or Niagara-free `UPaperFlipbookComponent`, or a custom unlit/lit billboard material on quads (recommended: material with normal-map support so sprites are lit by dynamic lights). Point sampling, no mip blur.
- **Camera**: fixed-pitch (~30–45°) perspective camera, low FOV, spring-arm rig; billboard sprites face camera (yaw-only facing to avoid tilt artifacts).
- **Post process**: tilt-shift-style Depth of Field (Cinematic DoF with focus on player), bloom, subtle vignette, color grade, light shafts. Consider Lumen on, tuned for stylised look.
- **Environment**: modular low-poly/3D props textured with painterly pixel-like textures; water and foliage with simple shaders; day/night via directional light + sky.
- **Battle scene**: same 3D map as backdrop; party on the right, enemies left, camera cuts/pushes on attacks (Level Sequencer or camera shake + spring-arm offset).

## 4. Exploration (Milestone 3)
- Grid-less free movement (8-direction), sprite direction by facing.
- Random encounters or visible enemies; transitions to battle with a screen wipe.
- Field abilities (talk, steal, inspect, etc.) via interface on NPC actors.
- Town/dungeon streaming with World Partition or sublevels.

## 5. Project Layout (proposed)
```
/Source/<Game>/Combat/      BattleManager, Combatant, Abilities, TurnOrder, AI
/Source/<Game>/Characters/  Sprite actors, movement
/Source/<Game>/UI/          UMG base classes
/Content/Data/              DataAssets, DataTables
/Content/HD2D/              Materials, post process, sprites
/docs/                      Design docs
```
Use Git LFS for `.uasset`/`.umap` and textures. Add `.gitignore` for `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`.

## 6. Roadmap
1. **M1 Combat core** (logic + tests, then placeholder UI). ← first
2. **M2 HD-2D presentation** (sprite material, camera, post process, battle scene).
3. **M3 Exploration** (movement, encounters, NPCs, one town + one dungeon).
4. **M4 Content & systems** (equipment, jobs/classes, shops, save/load, 3 characters).
5. **M5 Polish** (audio, cutscenes, localisation, optimisation, packaging).

## 7. Risks / Notes
- Art is the main cost: decide early on pixel-art source (commission vs. assets) and base sprite resolution (e.g. 32×48 at 2–3x scale).
- Sprite lighting with normal maps needs a custom material; prototype first.
- Keep combat math in data tables so balancing needs no recompiles.
- Octopath Traveler is Square Enix IP: replicate mechanics/style generally, but use original names, art, music and story.

## 8. Open Questions
- Party size is decided: small, fixed party (see 2.5). Revisit only if playtests demand it.
- Single-player only, or co-op/online?
- Target platforms (PC first?) and min spec.
- Art pipeline and source of pixel assets.
