import type { ReservationUpdateStatus } from './reservationUpdateStatus';

export interface ReservationUpdate {
  status?: ReservationUpdateStatus;
  notes?: string;
}
