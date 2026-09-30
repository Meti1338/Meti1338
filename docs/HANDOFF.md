# Game Handoff: Story & Mechanics

Paste this into a new conversation to continue. Full details: `docs/GAME_DESIGN.md`, `docs/CHARACTERS_AND_WORLDS.md`, `docs/art/STYLE_TARGET.md` (branch `claude/octopath-style-unreal-game-1w514w`).

## Concept
HD-2D turn-based RPG for Unreal Engine 5 (C++ core, Blueprint/UMG on top), inspired by Octopath Traveler, with original story, names and art. Art target: painted "HD pixel" illustration (`docs/art/style_target.jpg`).

## Story
- **Premise:** Aruna, a mage, travels between worlds to find where magic truly comes from. Clues point to a hidden **Core**.
- **Structure:** 3 main worlds in a fixed order, then 1 final world where the truth plays out. Each main world tells one party member's backstory, holds a different belief about magic (each partly true), and gives a fragment of truth plus a new element for Aruna.
  1. **Verdance** (Aruna's story): "magic is alive". Forests, ancient groves, an academy town, shrines to forgotten gods. Magic is dimming; she traces it to a buried vein. Truth: magic flows along veins that converge.
  2. **Ashmarch** (Serafina's story): "magic is a debt". Trading empire of cliffs, mines and tiled palaces, elven nobility. A guild, the Ledger, lends power for years of life. Serafina is **captured**; Kael joins to rescue her. Truth: magic is finite, drawn from a shared pool.
  3. **Hollowmere** (Ayo's story): "magic is memory". Drowned ruins, mist lakes, archivists and ghosts. Truth: the pool is made of the lives and memories of the past; using magic consumes them.
  4. **The Heartwell** (final): all worlds overlap around the Core, the shared heart of every world, which is wearing out. Proposed endings: Protect (ration magic), Release (end magic), Merge (Aruna renews the Core).
- **Themes:** curiosity vs. consequence, knowledge as responsibility, magic as something shared.
- **Companions join early**, during World 1's opening, which is also the tutorial.

## Characters (names are placeholders)
| Character | Role | Inspiration | Notes |
|---|---|---|---|
| **Aruna Valemar** (lead) | Mage: ranged elemental damage, weakness hunter; gains an element per world | European + South Asian, invented "old gods" motifs | Curious, methodical; from "knowledge is always good" to understanding its cost |
| **Ayo Quispe** | Duelist (warrior/rogue): fast multi-hit physical, steal/counter | South American (Andean, Afro-Latin) + West African; martial-dance fighting style | Wry, distrusts magic, hides why he joined |
| **Serafina Vidal** | Warden (healer/tank): shields, heals, draws attacks | Elf with Spanish (Castilian/Andalusian) influence: cape, ornate armour, sun shield, lance | Warm, stubborn, bound by an oath |
| **Kael Dravin** | Substitute (bruiser/healer): heals by hitting, lifesteal, burst heal on Break | From Serafina's past (rival/mentor, disgraced knight-healer) | Joins in World 2 while she is captured; stays as the bench member |

Cultural approach: fantasy inspired by real cultures, invented gods and names, no caricature; consider sensitivity readers.

## Party rules
- 3 active slots, roster of 4 (bench of 1). No Octopath-style 8-character roster.
- Swap at camp/hub, not in battle. Benched characters earn reduced XP.
- Story events can swap slots (Serafina captured → Kael fills her slot).

## Combat mechanics
- **Turn order:** by Speed each round, preview bar of upcoming turns.
- **Shields & Break:** enemies have shields and hidden weaknesses (Blade, Spear, Staff, Fire, Wind, Earth). Hitting a weakness removes 1 shield per hit. At 0 → **Broken**: loses its next turn, takes ×1.5 damage, shields restore on recovery.
- **Boost:** +1 BP per round (max 5). Spend up to 3 per turn: basic attacks gain +1 hit per BP; skills gain power (about +35% per BP).
- **Skills** cost SP/MP; basic attacks are free (and restore a little SP).
- **Damage:** `Attack × Power × Weak(1.3) × Broken(1.5) × variance(±6%) − Defense × 0.5`, tunable in data.
- **Active defense** (Expedition 33-style), on each enemy hit:
  - Telegraphed attacks with a closing timing ring.
  - Physical hits: **Parry** (narrow window: 0 damage, +1 BP, counter-hit) or **Block** (wider: about 50% damage).
  - Magic hits: **Dodge** (avoid all damage).
  - Parrying every hit of a physical attack (**Riposte**) removes a shield.
  - Per character: Aruna has a wider dodge window; Ayo gains SP on dodge; Serafina blocks best (35% damage) and counters hardest; Kael heals slightly on parry.
  - Accessibility: difficulty modes with wider/slower windows, auto-block option, visual/audio-only cues.

## Skill kit (prototype)
- **Aruna:** Staff attack · **Flame** (fireball → flame pillar, Fire) · **Gale** (tornadoes on all enemies, Wind)
- **Ayo:** Blade attack · **Flurry** (3 slashes + cross cut, Blade) · **Rhythm Kick** (2 kicks, stone spikes, Earth)
- **Serafina:** Spear thrust · **Shield Bash** (shockwave, Earth) · **Mend** (heal one ally)

## Example enemies (World 1)
- **Bramble Golem:** 5 shields; weak to Fire, Wind, Spear. Root Slam (parry), Spore Burst (3 hits, dodge).
- **Thornwolf:** 3 shields; weak to Fire, Blade. Savage Bite, Rending Claws (2 hits, parry).
- **Lumen Moth:** 3 shields; weak to Wind, Spear, Staff. Glimmer Beam (dodge), Dusk Dive (parry).

## Presentation (HD-2D)
Every action reads as anticipation → action → impact (hitstop, flash, shake, bouncing numbers) → follow-through. Spells add rune circles, charge particles and scene-wide coloured light. Break = shield shatter + "BREAK" slam + camera punch. Defeated enemies dissolve into pixels.

## Unreal plan
C++ battle state machine (`UBattleManager`), `UCombatantComponent`, pure-function action resolver that takes a per-hit defense result (keeps logic unit-testable), data assets for characters/abilities/enemies/defense windows, lit sprite material on billboards, Cinematic DoF + bloom, Niagara effects with short-lived lights.
Roadmap: M1 combat core + tests → M2 HD-2D presentation → M3 exploration → M4 content/systems (equipment, save, party swap) → M5 polish.

## Open questions
What exactly is the Core? Is there an antagonist? Final names and tone? Hybrid or pure archetypes? Which endings to ship? Kael's relationship to Serafina? Platforms, single-player only? Art source (AI-generated assets in the target style, commission, or packs)?
