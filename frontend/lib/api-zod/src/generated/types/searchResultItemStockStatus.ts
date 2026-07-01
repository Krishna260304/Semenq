
export type SearchResultItemStockStatus = typeof SearchResultItemStockStatus[keyof typeof SearchResultItemStockStatus];


export const SearchResultItemStockStatus = {
  available: 'available',
  limited: 'limited',
  outOfStock: 'outOfStock',
} as const;
