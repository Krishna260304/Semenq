
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];


export const OrderStatus = {
  placed: 'placed',
  processing: 'processing',
  packed: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
} as const;
