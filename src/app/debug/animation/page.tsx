import { FlightLabClient } from './FlightLabClient'
import { parseLabSearch } from './labPresets'

export default async function FlightLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (process.env.NODE_ENV === 'production') {
    return (
      <div id="game-root">
        <div className="overlay">
          <div className="panel">
            <h2>Flight Animation Lab</h2>
            <p className="subtitle">Development tool. Not available in production builds.</p>
          </div>
        </div>
      </div>
    )
  }

  const params = await searchParams
  const initial = parseLabSearch(params)

  return <FlightLabClient initial={initial} />
}
