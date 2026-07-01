
export type MedicineSearchResultExpansionLevel = typeof MedicineSearchResultExpansionLevel[keyof typeof MedicineSearchResultExpansionLevel];


export const MedicineSearchResultExpansionLevel = {
  nearby: 'nearby',
  city: 'city',
  district: 'district',
  state: 'state',
  national: 'national',
} as const;
