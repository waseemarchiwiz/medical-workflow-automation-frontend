export const appRouteSegments = {
  workflow: "workflow",
  ambientRecording: "ambient-recording",
} as const;

export const appRoutes = {
  home: "/",
  workflow: `/${appRouteSegments.workflow}`,
  ambientRecording: `/${appRouteSegments.ambientRecording}`,
} as const;
