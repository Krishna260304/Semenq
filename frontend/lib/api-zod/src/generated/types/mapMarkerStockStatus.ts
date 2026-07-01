
export type MapMarkerStockStatus = typeof MapMarkerStockStatus[keyof typeof MapMarkerStockStatus];


export const MapMarkerStockStatus = {
  available: 'available',
  limited: 'limited',
  outOfStock: 'outOfStock',
  courier: 'courier',
} as const;
