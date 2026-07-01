
export type OrderDeliveryType = typeof OrderDeliveryType[keyof typeof OrderDeliveryType];


export const OrderDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;
