import type { ReservationDeliveryType } from './reservationDeliveryType';
import type { ReservationStatus } from './reservationStatus';

export interface Reservation {
  id: number;
  medicineId: number;
  medicineName: string;
  pharmacyId: number;
  pharmacyName: string;
  quantity: number;
  price?: number;
  totalAmount?: number;
  status: ReservationStatus;
  deliveryType?: ReservationDeliveryType;
  expiresAt: string;
  createdAt: string;
  prescriptionId?: number | null;
  qrCode?: string | null;
  notes?: string | null;
}
