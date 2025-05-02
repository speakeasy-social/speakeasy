import {ThemeName} from '#/alf/types'

export function select<T>(name: ThemeName, options: Record<ThemeName, T>) {
  switch (name) {
    case 'light':
      return options.light
    case 'dark':
      return options.dark
    case 'dim':
      return options.dark
    default:
      throw new Error(`select(theme, options) received unknown theme ${name}`)
  }
}
