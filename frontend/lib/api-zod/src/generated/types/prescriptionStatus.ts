
export type PrescriptionStatus = typeof PrescriptionStatus[keyof typeof PrescriptionStatus];


export const PrescriptionStatus = {
  processing: 'processing',
  parsed: 'parsed',
  failed: 'failed',
} as const;
