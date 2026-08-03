#!/usr/bin/env node
/**
 * Parse the sidecar with three.js and bind every clip against the base model's
 * authored node names. This catches runtime PropertyBinding failures without
 * needing to decode the base model's textures in Node.
 */

import fs from 'node:fs'
import { stdout } from 'node:process'
import { URL } from 'node:url'
import { AnimationMixer, Group, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const BASE = new URL('../public/models/drogon.glb', import.meta.url)
const SIDECAR = new URL('../public/models/drogon-sanctuary.glb', import.meta.url)

function glbJson(url) {
  const data = fs.readFileSync(url)
  if (data.toString('ascii', 0, 4) !== 'glTF') throw new Error(`Not a GLB: ${url}`)
  let offset = 12
  while (offset < data.length) {
    const size = data.readUInt32LE(offset)
    const kind = data.toString('ascii', offset + 4, offset + 8)
    if (kind === 'JSON') {
      return JSON.parse(data.toString('utf8', offset + 8, offset + 8 + size))
    }
    offset += 8 + size
  }
  throw new Error(`No JSON chunk: ${url}`)
}

async function loadSidecar() {
  const bytes = fs.readFileSync(SIDECAR)
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject)
  })
}

const base = glbJson(BASE)
const root = new Group()
for (const node of base.nodes ?? []) {
  if (!node.name) continue
  const object = new Object3D()
  object.name = node.name
  root.add(object)
}

const sidecar = await loadSidecar()
const expected = [
  'Sanct_BankL',
  'Sanct_BankR',
  'Sanct_Breathe',
  'Sanct_BreatheAir',
  'Sanct_Calm',
  'Sanct_Cruise',
  'Sanct_Dive',
  'Sanct_Drink',
  'Sanct_Drop',
  'Sanct_Eat',
  'Sanct_Groom',
  'Sanct_Hover',
  'Sanct_HuntCarry',
  'Sanct_HuntFinish',
  'Sanct_HuntGrip',
  'Sanct_Nuzzle',
  'Sanct_PerchGrip',
  'Sanct_PickUp',
  'Sanct_Rest',
  'Sanct_Rise',
  'Sanct_Scout',
  'Sanct_Sit',
  'Sanct_SitLoop',
  'Sanct_Sleep',
  'Sanct_Soar',
  'Sanct_Speed',
]
const looping = new Set([
  'Sanct_BankL',
  'Sanct_BankR',
  'Sanct_Cruise',
  'Sanct_Scout',
  'Sanct_Dive',
  'Sanct_Drink',
  'Sanct_Eat',
  'Sanct_HuntCarry',
  'Sanct_Groom',
  'Sanct_Hover',
  'Sanct_PerchGrip',
  'Sanct_Rest',
  'Sanct_SitLoop',
  'Sanct_Sleep',
  'Sanct_Soar',
  'Sanct_Speed',
])
const names = sidecar.animations.map((clip) => clip.name).sort()
if (JSON.stringify(names) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected sidecar clips: ${names.join(', ')}`)
}

const mixer = new AnimationMixer(root)
for (const clip of sidecar.animations) {
  if (clip.tracks.length !== 876) {
    throw new Error(`${clip.name} has ${clip.tracks.length} tracks, expected 876`)
  }
  const action = mixer.clipAction(clip)
  action.play()
  mixer.update(1 / 24)
  action.stop()

  if (looping.has(clip.name)) {
    for (const track of clip.tracks) {
      const size = track.getValueSize()
      const last = track.values.length - size
      for (let i = 0; i < size; i++) {
        if (Math.abs(track.values[i] - track.values[last + i]) > 1e-5) {
          throw new Error(`${clip.name} does not loop exactly: ${track.name}`)
        }
      }
    }
  }
}

stdout.write(
  `runtime-ok clips:${names.length} loops:${looping.size} tracks-per-clip:876 targets:292\n`,
)
