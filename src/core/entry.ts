import type { PlayMode } from './application'

// HTML entries take precedence over legacy query links.
export function entryMode(pathname: string, search = ''): PlayMode {
  if (pathname.endsWith('/factory.html')) return 'factory'
  if (pathname.endsWith('/pete.html')) return 'petesWorld'
  return new URLSearchParams(search).get('mode') === 'factory' ? 'factory' : 'petesWorld'
}
