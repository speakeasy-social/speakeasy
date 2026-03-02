import React from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {render, RenderOptions} from '@testing-library/react-native'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions & {queryClient?: QueryClient},
) {
  const {queryClient, ...renderOptions} = options ?? {}
  const client = queryClient ?? createTestQueryClient()

  function Wrapper({children}: {children: React.ReactNode}) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

  return {
    ...render(ui, {wrapper: Wrapper, ...renderOptions}),
    queryClient: client,
  }
}
