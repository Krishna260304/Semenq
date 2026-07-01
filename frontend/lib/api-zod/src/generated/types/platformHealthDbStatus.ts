
export type PlatformHealthDbStatus = typeof PlatformHealthDbStatus[keyof typeof PlatformHealthDbStatus];


export const PlatformHealthDbStatus = {
  healthy: 'healthy',
  degraded: 'degraded',
  down: 'down',
} as const;
