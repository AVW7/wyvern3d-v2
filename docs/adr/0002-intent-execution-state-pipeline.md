# Intent-Execution state pipeline

UI components and player inputs never mutate `GameState` directly; they emit serialized `Intent` payloads that are validated and converted into `Execution` operations during the simulation tick.

## Status

Accepted

## Context & Decision

Direct state mutations from UI event handlers bypass validation rules and break replay fidelity. We decided that all player interactions must flow through an Intent union (`src/core/intents/`), where an `execute()` phase (`src/core/executions/`) validates requirements (such as resource costs, cooldowns, and range) before modifying state.

## Consequences

- Intents arriving from saved replays are treated as untrusted input and validated identically to live player actions.
- Client UI cannot introduce illegal state transitions or out-of-turn economy modifications.
- Adding a new player action requires explicit typing across the Intent union and Execution handler.
