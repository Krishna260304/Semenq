
export type SearchResultItemDeliveryType = typeof SearchResultItemDeliveryType[keyof typeof SearchResultItemDeliveryType];


export const SearchResultItemDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;
