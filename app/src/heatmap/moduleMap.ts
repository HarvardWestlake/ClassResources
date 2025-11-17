import type { ModuleType } from './types'

/** Map a pathname to a high-level ModuleType for segmentation. */
export function getModuleTypeForPath(pathname: string): ModuleType {
  // Normalize
  const path = pathname || '/'

  if (path.startsWith('/history')) return 'history'
  if (path.startsWith('/static/math')) return 'math'
  if (path.startsWith('/static/code')) return 'code'
  if (path.startsWith('/static/econ')) return 'econ'
  if (path.startsWith('/static/stats')) return 'stats'
  if (path.startsWith('/static/chem')) return 'chem'

  // Default to the app shell / misc pages
  return 'app'
}


