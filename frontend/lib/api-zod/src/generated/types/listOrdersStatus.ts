
export type ListOrdersStatus = typeof ListOrdersStatus[keyof typeof ListOrdersStatus];


export const ListOrdersStatus = {
  placed: 'placed',
  processing: 'processing',
  packed: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
} as const;
