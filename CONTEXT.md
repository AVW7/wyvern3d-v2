# Wyvern3D

The ubiquitous language and domain model for Wyvern3D, a browser-based strategy game where players raise wyverns at a sanctuary and command armies to conquer regions across the realm.

## Simulation & State

**GameState**:
The complete serializable snapshot of the simulation that is saved, loaded, and stepped during ticks.
_Avoid_: App state, store state, world state, session

**Tick**:
The discrete, deterministic simulation step executed by the core engine at a fixed 1 Hz frequency.
_Avoid_: Frame, step, cycle, turn, update loop

**Intent**:
An untrusted, serializable request emitted by the user interface representing a desired player action.
_Avoid_: Action, command, event, message, payload

**Execution**:
The validated internal operation that applies an Intent to GameState during a simulation tick.
_Avoid_: Reducer, mutation, state handler, dispatch

## Wyverns & Biology

**Wyvern**:
A winged draconic creature raised at the sanctuary, possessing individual stats, traits, age stages, assignments, and bonds.
_Avoid_: Dragon, pet, beast, monster, unit

**Species**:
The immutable archetype definition defining a wyvern's base attributes, growth curves, visual traits, and elemental affinities.
_Avoid_: Breed, class, type, race

**Age Stage**:
The biological maturity phase of a wyvern (`hatchling`, `juvenile`, `adult`), where only adults are eligible for combat deployment.
_Avoid_: Level, tier, rank, growth phase

**Bond**:
The relational metric between a player and an individual wyvern that influences combat responsiveness and training effectiveness.
_Avoid_: Loyalty, affection, friendship, morale

**Assignment**:
The current sanctuary role or active duty allocated to a wyvern, such as resting, patrolling, foraging, or station training.
_Avoid_: Task, job, work, order, behavior

## Sanctuary & Layout

**Sanctuary**:
The player-managed haven used for hatching, raising, and training wyverns, cultivating resources, and constructing realm buildings.
_Avoid_: Base, camp, village, town, home

**Placed Object**:
A physical structure, station, or decorative prop positioned within the sanctuary grid and persisted in `sanctuaryLayout`.
_Avoid_: Entity, building instance, prop instance, world item

**Prop**:
A static cosmetic scenery asset placed in the sanctuary or biome world from the instanced prop catalog.
_Avoid_: Decoration, model, asset, doodad

**Station**:
An interactable sanctuary prop associated with a specific wyvern activity, player interaction radius, or UI panel.
_Avoid_: Workbench, facility, interactable object, building

**Director**:
The per-frame client-side coordination system driving visual actor positions, spatial awareness, and flight animations in the sanctuary.
_Avoid_: Manager, controller, actor system, scene manager

**Sanctuary Command**:
A transient client-side directive queued in the sanctuary director to trigger immediate visual wyvern movement or flight maneuvers.
_Avoid_: Intent, order, action, player command

## World & Exploration

**Region**:
A discrete territory on the realm atlas characterized by a biome, threat level, garrison strength, and conquerable landmarks.
_Avoid_: Zone, province, map node, level, area

**Biome**:
An environmental classification (such as Highlands or Volcanic Crags) that dictates regional terrain, scenery props, climate, and lighting.
_Avoid_: Environment, terrain type, map theme, climate zone

**Phenomenon**:
A dynamic world event, weather anomaly, or celestial occurrence that temporarily alters regional conditions or sanctuary yields.
_Avoid_: Event, modifier, crisis, encounter

## Combat & Armies

**Encounter**:
A deterministic combat engagement between opposing forces stepped headlessly at fixed intervals for both auto-resolve and manual play.
_Avoid_: Battle instance, match, fight, skirmish

**Squad**:
A tactical military formation of homogeneous troop units led by a commander or supporting a wyvern in combat.
_Avoid_: Troop, regiment, platoon, army group, division

**Unit**:
A specific military troop archetype defining per-soldier combat statistics, range, speed, and tactical advantages.
_Avoid_: Soldier, minion, warrior, fighter

## Render & Animation

**Locomotion Channel**:
The primary animation layer controlling continuous baseline movement states like idling, cruising, gliding, or hovering.
_Avoid_: Base animation, movement track, walk cycle

**Action Channel**:
The overlay animation layer that plays one-shot combat or expressive clips (such as breath attacks or wing buffets) on top of locomotion.
_Avoid_: Action track, emote channel, secondary animation, tell
