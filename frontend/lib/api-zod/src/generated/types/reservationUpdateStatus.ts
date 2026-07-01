
export type ReservationUpdateStatus = typeof ReservationUpdateStatus[keyof typeof ReservationUpdateStatus];


export const ReservationUpdateStatus = {
  confirmed: 'confirmed',
  ready: 'ready',
  cancelled: 'cancelled',
} as const;
