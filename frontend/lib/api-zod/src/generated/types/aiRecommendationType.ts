
export type AiRecommendationType = typeof AiRecommendationType[keyof typeof AiRecommendationType];


export const AiRecommendationType = {
  refill: 'refill',
  alternative: 'alternative',
  saving: 'saving',
  alert: 'alert',
} as const;
