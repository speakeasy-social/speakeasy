import React from 'react'

import * as persisted from '#/state/persisted'

export type LeaveOption = {
  title: string
  link: string
}

type StateContext = persisted.Schema['leaveOptions']
type SetContext = (v: persisted.Schema['leaveOptions']) => void

const stateContext = React.createContext<StateContext>(
  persisted.defaults.leaveOptions,
)
const setContext = React.createContext<SetContext>(
  (_: persisted.Schema['leaveOptions']) => {},
)

export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = React.useState(persisted.get('leaveOptions'))

  const setStateWrapped = React.useCallback(
    (leaveOptions: persisted.Schema['leaveOptions']) => {
      setState(leaveOptions)
      persisted.write('leaveOptions', leaveOptions)
    },
    [setState],
  )

  React.useEffect(() => {
    return persisted.onUpdate('leaveOptions', nextLeaveOptions => {
      setState(nextLeaveOptions)
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

export function useLeaveOptions() {
  return React.useContext(stateContext)
}

export function useSetLeaveOptions() {
  return React.useContext(setContext)
}
