
export type DemandForecastItemHealthStatus = typeof DemandForecastItemHealthStatus[keyof typeof DemandForecastItemHealthStatus];


export const DemandForecastItemHealthStatus = {
  healthy: 'healthy',
  warning: 'warning',
  critical: 'critical',
} as const;
