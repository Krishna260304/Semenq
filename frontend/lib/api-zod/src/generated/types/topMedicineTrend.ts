
export type TopMedicineTrend = typeof TopMedicineTrend[keyof typeof TopMedicineTrend];


export const TopMedicineTrend = {
  up: 'up',
  down: 'down',
  stable: 'stable',
} as const;
