
export interface Medicine {
  id: number;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  composition?: string;
  dosage?: string;
  price: number;
  mrp?: number;
  imageUrl: string;
  requiresPrescription?: boolean;
  description?: string | null;
  sideEffects?: string | null;
  storageConditions?: string | null;
}
