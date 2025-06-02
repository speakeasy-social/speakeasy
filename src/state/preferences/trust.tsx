import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = {
  autoTrustOnFollow: boolean
  autoUntrustOnUnfollow: boolean
}

type ApiContext = {
  setAutoTrustOnFollow: (value: boolean) => void
  setAutoUntrustOnUnfollow: (value: boolean) => void
}

const StateContext = React.createContext<StateContext>({
  autoTrustOnFollow: Boolean(persisted.defaults.autoTrustOnFollow),
  autoUntrustOnUnfollow: Boolean(persisted.defaults.autoUntrustOnUnfollow),
})

const ApiContext = React.createContext<ApiContext>({
  setAutoTrustOnFollow: () => {},
  setAutoUntrustOnUnfollow: () => {},
})

function usePersistedBooleanValue<T extends keyof persisted.Schema>(key: T) {
  const [value, _set] = React.useState(() => {
    const persistedValue = persisted.get(key)
    if (typeof persistedValue === 'boolean') return persistedValue
    // fallback to schema default
    return Boolean(persisted.defaults[key])
  })
  const set = React.useCallback<
    (value: Exclude<persisted.Schema[T], undefined>) => void
  >(
    hidden => {
      _set(Boolean(hidden))
      persisted.write(key, hidden)
    },
    [key, _set],
  )
  React.useEffect(() => {
    return persisted.onUpdate(key, hidden => {
      if (typeof hidden === 'boolean') {
        _set(hidden)
      } else {
        _set(Boolean(persisted.defaults[key]))
      }
    })
  }, [key, _set])

  return [value, set] as const
}

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [autoTrustOnFollow, setAutoTrustOnFollow] =
    usePersistedBooleanValue('autoTrustOnFollow')
  const [autoUntrustOnUnfollow, setAutoUntrustOnUnfollow] =
    usePersistedBooleanValue('autoUntrustOnUnfollow')

  const state = React.useMemo(
    () => ({
      autoTrustOnFollow,
      autoUntrustOnUnfollow,
    }),
    [autoTrustOnFollow, autoUntrustOnUnfollow],
  )

  const api = React.useMemo(
    () => ({
      setAutoTrustOnFollow,
      setAutoUntrustOnUnfollow,
    }),
    [setAutoTrustOnFollow, setAutoUntrustOnUnfollow],
  )

  return (
    <StateContext.Provider value={state}>
      <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
    </StateContext.Provider>
  )
}

export function useTrustPreferences() {
  const state = React.useContext(StateContext)
  const api = React.useContext(ApiContext)
  return {...state, ...api}
}
