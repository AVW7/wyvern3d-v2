#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'src/scenes/BiomeWorld/data/studio-biomes.v1.json')
const hashTarget = resolve(root, 'src/scenes/BiomeWorld/data/studio-biomes.v1.sha256')

function validate(bytes) {
  let artifact
  try { artifact = JSON.parse(bytes.toString('utf8')) } catch (error) { throw new Error(`Malformed biome contract: ${error.message}`) }
  if (artifact.schemaVersion !== 1) throw new Error(`Unsupported schemaVersion ${artifact.schemaVersion}`)
  if (!(artifact.source?.worldSizeMeters > 0) || artifact.source?.heightUnitMeters !== 1) throw new Error('Contract world size and height units must be explicit metres')
  if (artifact.rng?.algorithm !== 'mulberry32-v1' || artifact.rng?.hash !== 'fnv1a32-v1') throw new Error('Unsupported RNG or hash algorithm')
  if (!artifact.rng.vectors?.length) throw new Error('Conformance vectors are required')
  if (!Array.isArray(artifact.studioBiomes) || artifact.studioBiomes.length !== 24) throw new Error('Expected 24 authored studio biomes')
  if (artifact.studioBiomes.some((biome) => biome.id === 'custom-canvas')) throw new Error('custom-canvas is not an authored biome')
  const classified = new Set([
    ...(artifact.links ?? []).flatMap((link) => [link.primaryStudioId, ...(link.alternateStudioIds ?? [])]),
    ...(artifact.unlinkedStudioBiomes ?? [])
  ])
  for (const biome of artifact.studioBiomes) if (!classified.has(biome.id)) throw new Error(`Unclassified studio biome ${biome.id}`)
  if (/"(yields|combat|unlocks|bosses|economy)"\s*:/.test(bytes.toString('utf8'))) throw new Error('Gameplay fields are forbidden')
  return artifact
}

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const [command, artifactArg] = process.argv.slice(2)
if (command === 'sync') {
  if (!artifactArg) throw new Error('Usage: pnpm biome:contract:sync -- <artifact>')
  const bytes = await readFile(resolve(process.cwd(), artifactArg))
  validate(bytes)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, bytes)
  await writeFile(hashTarget, `${digest(bytes)}\n`)
  console.log(`Synced biome contract ${digest(bytes)}`)
} else if (command === 'check') {
  const bytes = await readFile(target)
  validate(bytes)
  const expected = (await readFile(hashTarget, 'utf8')).trim()
  const actual = digest(bytes)
  if (expected !== actual) throw new Error(`Stale biome contract hash: expected ${expected}, got ${actual}`)
  if (!bytes.equals(Buffer.from(`${JSON.stringify(JSON.parse(bytes), null, 2)}\n`))) throw new Error('Biome contract is not canonical two-space JSON')
  console.log(`Biome contract OK ${actual}`)
} else {
  throw new Error('Usage: biome-contract.mjs <sync|check> [artifact]')
}
