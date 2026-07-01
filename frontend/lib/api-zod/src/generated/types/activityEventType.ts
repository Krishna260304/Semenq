
export type ActivityEventType = typeof ActivityEventType[keyof typeof ActivityEventType];


export const ActivityEventType = {
  userRegistered: 'userRegistered',
  pharmacyVerified: 'pharmacyVerified',
  orderPlaced: 'orderPlaced',
  paymentReceived: 'paymentReceived',
  alert: 'alert',
} as const;
