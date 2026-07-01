
export type ListReservationsStatus = typeof ListReservationsStatus[keyof typeof ListReservationsStatus];


export const ListReservationsStatus = {
  pending: 'pending',
  confirmed: 'confirmed',
  ready: 'ready',
  cancelled: 'cancelled',
  expired: 'expired',
} as const;
