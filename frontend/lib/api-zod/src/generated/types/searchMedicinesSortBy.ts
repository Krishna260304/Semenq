
export type SearchMedicinesSortBy = typeof SearchMedicinesSortBy[keyof typeof SearchMedicinesSortBy];


export const SearchMedicinesSortBy = {
  nearest: 'nearest',
  fastest: 'fastest',
  cheapest: 'cheapest',
  bestMatch: 'bestMatch',
} as const;
