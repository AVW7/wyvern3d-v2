#!/usr/bin/env node
/**
 * Index the external GLB source libraries so biome props can be curated.
 *
 * Why this exists
 * ---------------
 * The biome atlas is built from a source library that lives outside the repo
 * and is several gigabytes. Curating it by hand means opening files one at a
 * time to find out whether a model is static, how heavy it is, and what its
 * nodes are called. This walks the roots once and writes that down.
 *
 * It reads only. Nothing is copied, converted, or moved — the output is
 * metadata plus absolute source paths, which is what scripts/biome-library.json
 * is then written against by hand.
 *
 * Usage:
 *     pnpm assets:index-biome-library                  # default roots
 *     pnpm assets:index-biome-library ~/some/other/dir # override roots
 */
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const HOME = process.env.HOME ?? ''
const DEFAULT_ROOTS = [path.join(HOME, 'Desktop/world build'), path.join(HOME, 'Desktop/3d models animals')]
const roots = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROOTS).map((entry) =>
  path.resolve(entry.replace(/^~(?=$|\/)/, HOME)),
)

/**
 * Filename keywords that hint a model suits one of our biomes.
 *
 * These are our own biome ids (see BIOME_PALETTES), not the source library's
 * vocabulary, and a hit is a starting point for inspection — never approval.
 */
const BIOME_KEYWORDS = {
  valley: ['oak', 'apple', 'grass', 'tree', 'well', 'rock'],
  forest: ['tree', 'forest', 'oak', 'conifer', 'arborvitae', 'grass', 'autumn'],
  coast: ['rock', 'amphora', 'ruin', 'well'],
  marsh: ['gnarly', 'grass', 'rock', 'reed'],
  moor: ['rock', 'gnarly', 'obelisk', 'monolith'],
  swamp: ['gnarly', 'tree', 'grass', 'rock'],
  mountain: ['rock', 'cave', 'crystal', 'monolith'],
  highland: ['rock', 'conifer', 'grass', 'obelisk'],
  cavern: ['cave', 'rock', 'crystal', 'gemstone', 'candle', 'barrel'],
  jungle: ['tree', 'forest', 'gnarly', 'grass'],
  grove: ['ancient_tree', 'oak', 'tree', 'altar', 'shrine', 'grass'],
  ashland: ['rock', 'gnarly', 'dead', 'petrified', 'egg'],
  tundra: ['rock', 'conifer', 'crystal', 'arborvitae'],
  barrens: ['rock', 'obelisk', 'petrified', 'egg', 'amphora', 'mudbrick'],
  spire: ['monolith', 'obelisk', 'crystal', 'gemstone', 'portal', 'altar'],
}

const ANIMAL_WORDS = ['rabbit', 'horse', 'doe', 'deer', 'swallowtail', 'butterfly', 'chicken', 'dove', 'bird', 'dragon', 'wolf', 'guineafowl', 'camel']
const VEGETATION_WORDS = ['tree', 'forest', 'grass', 'plant', 'mushroom', 'conifer', 'arborvitae']
const CHARACTER_WORDS = ['knight', 'warrior', 'paladin', 'samurai', 'executioner', 'skeleton']
const STRUCTURE_WORDS = ['shrine', 'house', 'tomb', 'ruin', 'portal', 'obelisk', 'monolith', 'altar', 'well', 'temple']
const PROP_WORDS = ['basket', 'barrel', 'amphora', 'weapon', 'sword', 'table', 'potion', 'candle', 'egg', 'chariot', 'armor']
const GEOLOGY_WORDS = ['rock', 'crystal', 'gemstone', 'cave', 'stone']

function classify(name, extension) {
  const lower = name.toLowerCase()
  const has = (words) => words.some((word) => lower.includes(word))
  if (['.zip', '.rar'].includes(extension)) return 'archive'
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) return 'texture/reference'
  if (has(ANIMAL_WORDS)) return 'animal/creature'
  if (has(VEGETATION_WORDS)) return 'vegetation'
  if (has(CHARACTER_WORDS)) return 'character'
  if (has(STRUCTURE_WORDS)) return 'structure/landmark'
  if (has(PROP_WORDS)) return 'prop/equipment'
  if (has(GEOLOGY_WORDS)) return 'geology/terrain'
  return extension === '.glb' ? 'uncategorized model' : 'other'
}

function biomeMatches(name) {
  const normalized = name.toLowerCase().replace(/[\s-]+/g, '_')
  return Object.entries(BIOME_KEYWORDS)
    .map(([id, words]) => ({ id, score: words.filter((word) => normalized.includes(word)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map(({ id }) => id)
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

/**
 * GLB header metadata: the JSON chunk only, never the binary payload.
 *
 * A 30 MB model costs one JSON.parse of its first chunk here, which is what
 * makes indexing a multi-gigabyte library take seconds.
 */
function readGlbMetadata(file) {
  const handle = fs.openSync(file, 'r')
  try {
    const header = Buffer.alloc(20)
    if (fs.readSync(handle, header, 0, 20, 0) < 20 || header.toString('ascii', 0, 4) !== 'glTF') {
      return { error: 'not a GLB' }
    }
    const jsonLength = header.readUInt32LE(12)
    if (header.toString('ascii', 16, 20) !== 'JSON') return { error: 'missing JSON chunk' }
    const chunk = Buffer.alloc(jsonLength)
    fs.readSync(handle, chunk, 0, jsonLength, 20)
    const doc = JSON.parse(chunk.toString('utf8'))
    const primitives = (doc.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
    const triangles = primitives.reduce((total, primitive) => {
      const accessor = primitive.indices !== undefined ? doc.accessors?.[primitive.indices] : doc.accessors?.[primitive.attributes?.POSITION]
      return total + Math.floor((accessor?.count ?? 0) / 3)
    }, 0)
    const vertices = primitives.reduce(
      (total, primitive) => total + (doc.accessors?.[primitive.attributes?.POSITION]?.count ?? 0),
      0,
    )
    return {
      version: header.readUInt32LE(4),
      generator: doc.asset?.generator ?? null,
      nodes: doc.nodes?.length ?? 0,
      meshes: doc.meshes?.length ?? 0,
      primitives: primitives.length,
      triangles,
      vertices,
      materials: doc.materials?.length ?? 0,
      textures: doc.textures?.length ?? 0,
      skins: doc.skins?.length ?? 0,
      animations: (doc.animations ?? []).map((clip, index) => clip.name ?? `clip_${index}`),
      extensionsUsed: doc.extensionsUsed ?? [],
      extensionsRequired: doc.extensionsRequired ?? [],
      // The names the atlas builder's `nodes` selector matches against.
      meshNodeNames: (doc.nodes ?? []).filter((node) => node.mesh !== undefined && node.name).map((node) => node.name),
    }
  } catch (error) {
    return { error: String(error.message ?? error) }
  } finally {
    fs.closeSync(handle)
  }
}

const missing = roots.filter((root) => !fs.existsSync(root))
if (missing.length === roots.length) {
  console.error(`No source root exists. Looked for:\n${roots.map((root) => `  ${root}`).join('\n')}`)
  process.exit(1)
}
for (const root of missing) console.warn(`skipping missing root ${root}`)

const files = []
for (const root of roots.filter((root) => fs.existsSync(root))) {
  for (const file of walk(root)) {
    const extension = path.extname(file).toLowerCase()
    if (path.basename(file).startsWith('.')) continue
    const stats = fs.statSync(file)
    const name = path
      .basename(file, path.extname(file))
      .replace(/\s+(copy|\(\d+\))(?=\s|$)/gi, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const entry = {
      name,
      filename: path.basename(file),
      sourceRoot: path.basename(root),
      absolutePath: file,
      extension,
      sizeBytes: stats.size,
      category: classify(name, extension),
      suggestedBiomes: extension === '.glb' ? biomeMatches(path.basename(file)) : [],
      glb: extension === '.glb' ? readGlbMetadata(file) : null,
      duplicateOf: null,
    }
    if (extension === '.glb') {
      entry.sha256 = createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    }
    files.push(entry)
  }
}

const seen = new Map()
for (const entry of files) {
  if (!entry.sha256) continue
  const first = seen.get(entry.sha256)
  if (first) entry.duplicateOf = first.absolutePath
  else seen.set(entry.sha256, entry)
}

files.sort((a, b) => a.filename.localeCompare(b.filename))

const models = files.filter((entry) => entry.extension === '.glb')
const index = {
  schemaVersion: 1,
  roots,
  summary: {
    totalFiles: files.length,
    modelFiles: models.length,
    uniqueModelFiles: models.filter((entry) => !entry.duplicateOf).length,
    staticModelFiles: models.filter((entry) => !entry.duplicateOf && !entry.glb?.skins && !entry.glb?.animations?.length).length,
    totalBytes: files.reduce((total, entry) => total + entry.sizeBytes, 0),
  },
  files,
}

fs.writeFileSync(path.join(REPO, 'docs/BIOME_LIBRARY_INDEX.json'), `${JSON.stringify(index, null, 1)}\n`)

const byBiome = Object.keys(BIOME_KEYWORDS).map((biome) => {
  const candidates = models
    .filter((entry) => !entry.duplicateOf && entry.suggestedBiomes.includes(biome))
    .filter((entry) => !entry.glb?.skins && !entry.glb?.animations?.length)
    .sort((a, b) => (a.glb?.triangles ?? 0) - (b.glb?.triangles ?? 0))
    .slice(0, 8)
  return `| \`${biome}\` | ${candidates.map((entry) => `\`${entry.filename}\``).join(', ') || '—'} |`
})

const categories = [...new Set(files.map((entry) => entry.category))]
  .map((category) => [category, files.filter((entry) => entry.category === category).length])
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `| ${category} | ${count} |`)

fs.writeFileSync(
  path.join(REPO, 'docs/BIOME_LIBRARY_INDEX.md'),
  `# Biome source library index

Generated by \`pnpm assets:index-biome-library\`. \`docs/BIOME_LIBRARY_INDEX.json\` is the
machine-readable form and the authoritative one. Source models stay outside the repository; this
records metadata and absolute source paths only.

This is a curation aid, not a licence grant and not artistic approval. Inspect scale, topology,
textures and licensing before adding an entry to \`scripts/biome-library.json\`.

## Roots

${roots.map((root) => `- \`${root}\``).join('\n')}

## Summary

- ${index.summary.totalFiles} files, ${index.summary.modelFiles} GLBs (${index.summary.uniqueModelFiles} unique)
- ${index.summary.staticModelFiles} unique GLBs are static (no skin, no clips) and therefore atlas candidates
- ${(index.summary.totalBytes / 1e9).toFixed(2)} GB total

## Categories

| Category | Files |
|---|---:|
${categories.join('\n')}

## Static candidates per biome

Keyword-driven starting points, cheapest geometry first.

| Biome | Candidate models |
|---|---|
${byBiome.join('\n')}
`,
)

console.log(
  `indexed ${index.summary.modelFiles} GLBs (${index.summary.staticModelFiles} static candidates) into docs/BIOME_LIBRARY_INDEX.{json,md}`,
)
