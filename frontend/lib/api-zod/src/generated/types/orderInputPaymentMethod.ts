
export type OrderInputPaymentMethod = typeof OrderInputPaymentMethod[keyof typeof OrderInputPaymentMethod];


export const OrderInputPaymentMethod = {
  upi: 'upi',
  card: 'card',
  netBanking: 'netBanking',
  wallet: 'wallet',
} as const;
