
export type ReservationStatus = typeof ReservationStatus[keyof typeof ReservationStatus];


export const ReservationStatus = {
  pending: 'pending',
  confirmed: 'confirmed',
  ready: 'ready',
  cancelled: 'cancelled',
  expired: 'expired',
} as const;
