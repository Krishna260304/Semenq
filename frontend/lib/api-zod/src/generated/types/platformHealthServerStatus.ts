
export type PlatformHealthServerStatus = typeof PlatformHealthServerStatus[keyof typeof PlatformHealthServerStatus];


export const PlatformHealthServerStatus = {
  healthy: 'healthy',
  degraded: 'degraded',
  down: 'down',
} as const;
