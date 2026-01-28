import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = boolean
type SetContext = (v: boolean) => void

const stateContext = React.createContext<StateContext>(false)
const setContext = React.createContext<SetContext>((_: boolean) => {})

export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = React.useState(
    persisted.get('hasSeenPauseFeedOnboarding') ?? false,
  )

  const setStateWrapped = React.useCallback(
    (hasSeenOnboarding: boolean) => {
      setState(hasSeenOnboarding)
      persisted.write('hasSeenPauseFeedOnboarding', hasSeenOnboarding)
    },
    [setState],
  )

  React.useEffect(() => {
    return persisted.onUpdate('hasSeenPauseFeedOnboarding', nextValue => {
      setState(nextValue ?? false)
    })
  }, [setStateWrapped])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useHasSeenPauseFeedOnboarding() {
  return React.useContext(stateContext)
}

export function useSetHasSeenPauseFeedOnboarding() {
  return React.useContext(setContext)
}
