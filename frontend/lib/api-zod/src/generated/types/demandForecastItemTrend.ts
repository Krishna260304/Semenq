
export type DemandForecastItemTrend = typeof DemandForecastItemTrend[keyof typeof DemandForecastItemTrend];


export const DemandForecastItemTrend = {
  rising: 'rising',
  stable: 'stable',
  falling: 'falling',
} as const;
