
export type PlatformHealthApiStatus = typeof PlatformHealthApiStatus[keyof typeof PlatformHealthApiStatus];


export const PlatformHealthApiStatus = {
  healthy: 'healthy',
  degraded: 'degraded',
  down: 'down',
} as const;
