
export type PharmacyStockDeliveryType = typeof PharmacyStockDeliveryType[keyof typeof PharmacyStockDeliveryType];


export const PharmacyStockDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;
