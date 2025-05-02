import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = boolean
type SetContext = (useGridLayout: boolean) => void

const stateContext = React.createContext<StateContext>(false) // default to carousel
const setContext = React.createContext<SetContext>(
  (_: persisted.Schema['useGridLayout']) => {},
)

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = React.useState(
    persisted.get('useGridLayout') ?? true,
  )

  const setStateWrapped = React.useCallback(
    (useGridLayout: persisted.Schema['useGridLayout']) => {
      setState(useGridLayout || false)
      persisted.write('useGridLayout', useGridLayout)
    },
    [setState],
  )

  React.useEffect(() => {
    return persisted.onUpdate('useGridLayout', nextUseGridLayout => {
      setState(!!nextUseGridLayout)
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

export function useGridLayoutEnabled() {
  return React.useContext(stateContext)
}

export function useSetGridLayoutEnabled() {
  return React.useContext(setContext)
}
