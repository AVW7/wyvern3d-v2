import { getConsoleFunction, setConsoleFunction } from 'three'

const R3F_CLOCK_DEPRECATION =
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.'

const previousConsoleFunction = getConsoleFunction()

/**
 * R3F 9.6.1 still creates a THREE.Clock for its public RootState contract.
 * Timer is not API-compatible with that contract, and R3F's migration is
 * scheduled for v10. Keep the stable renderer while filtering only the
 * dependency-owned warning; all other Three diagnostics still pass through.
 */
setConsoleFunction((type, message, ...params) => {
  if (type === 'warn' && message === R3F_CLOCK_DEPRECATION) return

  if (previousConsoleFunction) {
    previousConsoleFunction(type, message, ...params)
    return
  }

  console[type](message, ...params)
})
