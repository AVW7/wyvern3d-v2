import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { BIOME_PROP_ATLAS } from '@/render/assets/manifest'
import { BiomeLibrary } from './BiomeLibrary'
import type { AtlasMeasurement, LibraryEntry } from './catalog'

/**
 * The Biome Library page.
 *
 * Both halves of a prop's truth are read here, on the server: what
 * scripts/biome-library.json *asked* for, and what the built atlas actually
 * *measures*. Reading the GLB's JSON chunk is cheap — the builder stamps its
 * measurements into asset.extras, so no geometry is parsed.
 */
function readAtlas(): { measurements: AtlasMeasurement[]; bytes: number } {
  const file = path.join(process.cwd(), 'public', BIOME_PROP_ATLAS.replace(/^\//, ''))
  try {
    const data = readFileSync(file)
    const jsonLength = data.readUInt32LE(12)
    const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'))
    return { measurements: gltf.asset?.extras?.wyvern3dBiomeAtlas ?? [], bytes: statSync(file).size }
  } catch {
    // A missing atlas is a legitimate state: nothing approved, nothing built.
    return { measurements: [], bytes: 0 }
  }
}

export default async function BiomesPage({ searchParams }: { searchParams: Promise<{ prop?: string | string[] }> }) {
  const params = await searchParams
  const requested = Array.isArray(params.prop) ? params.prop[0] : params.prop

  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), 'scripts/biome-library.json'), 'utf8'),
  ) as { props: LibraryEntry[] }
  const { measurements, bytes } = readAtlas()
  const known = manifest.props.some((entry) => entry.id === requested)

  return (
    <BiomeLibrary
      entries={manifest.props}
      measurements={measurements}
      atlasBytes={bytes}
      initialId={known ? requested : undefined}
    />
  )
}
