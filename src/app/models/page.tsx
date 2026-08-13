import { ModelLibrary } from './ModelLibrary'
import { resolveModelId } from './catalog'

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ model?: string | string[] }> }) {
  const params = await searchParams
  return <ModelLibrary initialId={resolveModelId(params.model)} />
}
