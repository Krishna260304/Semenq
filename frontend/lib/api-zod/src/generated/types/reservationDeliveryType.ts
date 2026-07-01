
export type ReservationDeliveryType = typeof ReservationDeliveryType[keyof typeof ReservationDeliveryType];


export const ReservationDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;
