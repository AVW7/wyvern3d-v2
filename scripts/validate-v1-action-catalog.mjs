#!/usr/bin/env node
/**
 * Keep the v1 re-authoring catalogue tied to the pinned source assets.
 *
 * The source-of-truth document is deliberately human-readable, while the clip
 * signatures are deliberately machine-readable. This check ensures their
 * action inventories, counts, and source file identities cannot drift apart.
 */

import { createHash } from 'node:crypto'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCUMENT = path.join(ROOT, 'docs/WYVERN_V1_REAUTHORING_SOURCE_OF_TRUTH.md')
const SOURCES = path.join(ROOT, 'docs/WYVERN_V1_ANIMATION_SOURCES.json')
const SIGNATURES = path.join(ROOT, 'validation/wyvern-animations/clip-signatures.json')
const VENDOR_PREFIX = 'SKM_DaenerysDragon|DaenerysDragon_'
const VENDOR_STAND = 'SKM_DaenerysDragon|AA_DaenerysDragon_Battle_Stand'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function tableActions(document, startHeading, endHeading) {
  const section = document.split(startHeading)[1]?.split(endHeading)[0]
  if (!section) throw new Error(`cannot find catalogue section ${startHeading}`)
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1])
}

function difference(left, right) {
  return left.filter((value) => !right.includes(value))
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

const sources = readJson(SOURCES)
const signatures = readJson(SIGNATURES)
const document = fs.readFileSync(DOCUMENT, 'utf8')
const clips = Object.keys(signatures.clips)
const vendorSource = clips
  .filter((name) => name.startsWith(VENDOR_PREFIX) || name === VENDOR_STAND)
  .map((name) => (name === VENDOR_STAND ? 'Battle_Stand' : name.slice(VENDOR_PREFIX.length)))
const sanctuarySource = clips.filter((name) => name.startsWith('Sanct_'))
const vendorDocumented = tableActions(
  document,
  '## Catalogue — vendor base (52)',
  '## Catalogue — Sanctuary extension (26)',
)
const sanctuaryDocumented = tableActions(
  document,
  '## Catalogue — Sanctuary extension (26)',
  '## Execution order',
)

ensure(
  clips.length === sources.canonical_v1.combined_clip_count,
  `signature has ${clips.length} clips; expected ${sources.canonical_v1.combined_clip_count}`,
)
ensure(
  vendorSource.length === sources.canonical_v1.base.clip_count,
  `signature has ${vendorSource.length} vendor clips; expected ${sources.canonical_v1.base.clip_count}`,
)
ensure(
  sanctuarySource.length === sources.canonical_v1.sanctuary_extension.clip_count,
  `signature has ${sanctuarySource.length} Sanctuary clips; expected ${sources.canonical_v1.sanctuary_extension.clip_count}`,
)
for (const [label, documented, actual] of [
  ['vendor', vendorDocumented, vendorSource],
  ['Sanctuary', sanctuaryDocumented, sanctuarySource],
]) {
  const missing = difference(actual, documented)
  const extra = difference(documented, actual)
  ensure(
    !missing.length && !extra.length && documented.length === new Set(documented).size,
    `${label} catalogue mismatch: missing [${missing.join(', ')}]; extra [${extra.join(', ')}]`,
  )
}
for (const source of [
  sources.canonical_v1.base,
  sources.canonical_v1.sanctuary_extension,
]) {
  const file = path.join(ROOT, source.path)
  ensure(fs.existsSync(file), `canonical source missing: ${source.path}`)
  ensure(
    sha256(file) === source.sha256,
    `canonical source hash changed: ${source.path}; measure and explicitly promote it before updating the manifest`,
  )
}

console.log(
  `v1 catalogue clean: ${vendorSource.length} vendor + ${sanctuarySource.length} Sanctuary = ${clips.length} clips`,
)
