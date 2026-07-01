
export type ReservationInputDeliveryType = typeof ReservationInputDeliveryType[keyof typeof ReservationInputDeliveryType];


export const ReservationInputDeliveryType = {
  pickup: 'pickup',
  courier: 'courier',
} as const;
