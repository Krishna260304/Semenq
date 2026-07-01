
export type OrderPaymentStatus = typeof OrderPaymentStatus[keyof typeof OrderPaymentStatus];


export const OrderPaymentStatus = {
  pending: 'pending',
  paid: 'paid',
  failed: 'failed',
  refunded: 'refunded',
} as const;
