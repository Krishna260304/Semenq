import type { Medicine } from './medicine';

export interface MedicineList {
  items: Medicine[];
  total: number;
  page: number;
  limit: number;
}
