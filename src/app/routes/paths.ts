export const appRouteSegments = {
  workflow: 'workflow',
} as const

export const appRoutes = {
  home: '/',
  workflow: `/${appRouteSegments.workflow}`,
} as const
