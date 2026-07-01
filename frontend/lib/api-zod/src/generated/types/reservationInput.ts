import type { ReservationInputDeliveryType } from './reservationInputDeliveryType';

export interface ReservationInput {
  medicineId: number;
  pharmacyId: number;
  quantity: number;
  deliveryType: ReservationInputDeliveryType;
  prescriptionId?: number | null;
  notes?: string | null;
}
