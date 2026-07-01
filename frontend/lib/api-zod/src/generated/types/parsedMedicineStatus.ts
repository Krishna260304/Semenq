
export type ParsedMedicineStatus = typeof ParsedMedicineStatus[keyof typeof ParsedMedicineStatus];


export const ParsedMedicineStatus = {
  confirmed: 'confirmed',
  lowConfidence: 'lowConfidence',
  unmatched: 'unmatched',
} as const;
