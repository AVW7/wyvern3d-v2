import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUi } from './uiStore'

describe('interaction notices', () => {
  beforeEach(() => {
    useUi.setState({ toast: null, toasts: [] })
  })

  afterEach(() => vi.restoreAllMocks())

  it('creates structured notices with a five-second default lifetime', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)

    useUi.getState().notify({ tone: 'success', message: 'Torch placed.', undoToken: 4 })

    expect(useUi.getState().toast).toMatchObject({
      id: 1,
      tone: 'success',
      message: 'Torch placed.',
      expiresAt: 6_000,
      undoToken: 4,
    })
  })

  it('replaces old notices and only clears the matching active id', () => {
    useUi.getState().notify('First')
    const first = useUi.getState().toast!
    useUi.getState().notify({ tone: 'warning', message: 'Second' })
    const second = useUi.getState().toast!

    useUi.getState().clearNotice(first.id)
    expect(useUi.getState().toast?.id).toBe(second.id)

    useUi.getState().clearNotice(second.id)
    expect(useUi.getState().toast).toBeNull()
  })
})
