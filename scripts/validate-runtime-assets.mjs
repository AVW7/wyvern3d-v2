import { readFile, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const manifest = JSON.parse(await readFile(resolve(root, 'scripts/runtime-assets.json'), 'utf8'))
const configured = new Map(manifest.assets.map((asset) => [asset.path, asset]))
const discovered = execFileSync('git', ['ls-files', '*.glb'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
const lfsFiles = new Set(execFileSync('git', ['lfs', 'ls-files', '--name-only'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean))
for (const path of discovered) if (!lfsFiles.has(path)) throw new Error(`${path} is tracked outside Git LFS`)
for (const path of discovered) if (!configured.has(path)) throw new Error(`${path} is missing from scripts/runtime-assets.json`)
for (const path of configured.keys()) if (!discovered.includes(path)) throw new Error(`${path} is listed but missing`)
let runtimeTotal = 0
for (const asset of manifest.assets) {
  if (!asset.redistributionApproved) throw new Error(`${asset.path} lacks redistribution approval`)
  const bytes = (await stat(resolve(root, asset.path))).size
  if (bytes > manifest.maximumIndividualBytes) throw new Error(`${asset.path} exceeds the individual asset budget`)
  if (asset.runtime) runtimeTotal += bytes
}
if (runtimeTotal > manifest.maximumTotalBytes) throw new Error(`Runtime GLBs total ${runtimeTotal}, budget ${manifest.maximumTotalBytes}`)
console.log(`Runtime asset manifest OK: ${discovered.length} GLBs, ${runtimeTotal} runtime bytes`)
