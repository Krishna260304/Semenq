
export type InventoryItemStockStatus = typeof InventoryItemStockStatus[keyof typeof InventoryItemStockStatus];


export const InventoryItemStockStatus = {
  inStock: 'inStock',
  lowStock: 'lowStock',
  outOfStock: 'outOfStock',
} as const;
