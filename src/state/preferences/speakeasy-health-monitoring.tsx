import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = boolean
type SetContext = (v: boolean) => void

const stateContext = React.createContext<StateContext>(
  Boolean(persisted.defaults.speakeasyHealthMonitoring),
)
const setContext = React.createContext<SetContext>((_: boolean) => {})

export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = React.useState(
    Boolean(persisted.get('speakeasyHealthMonitoring')),
  )

  const setStateWrapped = React.useCallback(
    (enabled: persisted.Schema['speakeasyHealthMonitoring']) => {
      setState(Boolean(enabled))
      persisted.write('speakeasyHealthMonitoring', enabled)
    },
    [setState],
  )

  React.useEffect(() => {
    return persisted.onUpdate('speakeasyHealthMonitoring', nextValue => {
      setState(Boolean(nextValue))
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

export const useSpeakeasyHealthMonitoring = () => React.useContext(stateContext)
export const useSetSpeakeasyHealthMonitoring = () => React.useContext(setContext)
