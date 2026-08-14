import fs from 'node:fs'
import path from 'node:path'
import { SanctuaryPropReview, type SanctuaryPropSpec } from './SanctuaryPropReview'

export const metadata = {
  title: 'Sanctuary Prop Review — Wyvern3D',
  description: 'Inspection review surface for all 57 sanctuary atlas props at true scale.',
}

export default function SanctuaryPropsPage() {
  const manifestPath = path.join(process.cwd(), 'scripts/sanctuary-library.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const props: SanctuaryPropSpec[] = manifest.props

  return <SanctuaryPropReview props={props} />
}
