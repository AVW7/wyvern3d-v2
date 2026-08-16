import { ModelLibrary } from './ModelLibrary'
import { resolveLinkedState, resolveModelId } from './catalog'
import { getAsset } from '@/render/assets/manifest'

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string | string[]; state?: string | string[] }>
}) {
  const params = await searchParams
  const initialId = resolveModelId(params.model)
  const initialState = resolveLinkedState(getAsset(initialId)!, params.state)
  return <ModelLibrary initialId={initialId} initialState={initialState} />
}
