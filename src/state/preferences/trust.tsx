import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = {
  autoTrustOnFollow: boolean | undefined
  autoUntrustOnUnfollow: boolean
}

type ApiContext = {
  setAutoTrustOnFollow: (value: boolean) => void
  setAutoUntrustOnUnfollow: (value: boolean) => void
}

const StateContext = React.createContext<StateContext>({
  autoTrustOnFollow: undefined,
  autoUntrustOnUnfollow: Boolean(persisted.defaults.autoUntrustOnUnfollow),
})

const ApiContext = React.createContext<ApiContext>({
  setAutoTrustOnFollow: () => {},
  setAutoUntrustOnUnfollow: () => {},
})

function usePersistedBooleanValue<T extends keyof persisted.Schema>(key: T) {
  const [value, _set] = React.useState<persisted.Schema[T]>(() => {
    const persistedValue = persisted.get(key)
    if (typeof persistedValue === 'boolean')
      return persistedValue as persisted.Schema[T]
    // fallback to schema default, but allow undefined for autoTrustOnFollow
    if (key === 'autoTrustOnFollow' && persistedValue === undefined)
      return undefined as persisted.Schema[T]
    return Boolean(persisted.defaults[key]) as persisted.Schema[T]
  })
  const set = React.useCallback<(value: persisted.Schema[T]) => void>(
    hidden => {
      _set(hidden)
      persisted.write(key, hidden)
    },
    [key, _set],
  )
  React.useEffect(() => {
    return persisted.onUpdate(key, hidden => {
      if (typeof hidden === 'boolean') {
        _set(hidden as persisted.Schema[T])
      } else if (key === 'autoTrustOnFollow' && hidden === undefined) {
        _set(undefined as persisted.Schema[T])
      } else {
        _set(Boolean(persisted.defaults[key]) as persisted.Schema[T])
      }
    })
  }, [key, _set])

  return [value, set] as const
}

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [autoTrustOnFollow, setAutoTrustOnFollow] =
    usePersistedBooleanValue('autoTrustOnFollow')
  const [autoUntrustOnUnfollowRaw, setAutoUntrustOnUnfollow] =
    usePersistedBooleanValue('autoUntrustOnUnfollow')
  // Ensure autoUntrustOnUnfollow is always boolean
  const autoUntrustOnUnfollow = autoUntrustOnUnfollowRaw ?? false

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
