
export type PharmacyStockStockStatus = typeof PharmacyStockStockStatus[keyof typeof PharmacyStockStockStatus];


export const PharmacyStockStockStatus = {
  available: 'available',
  limited: 'limited',
  outOfStock: 'outOfStock',
} as const;
