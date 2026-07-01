
export type UserProfileRole = typeof UserProfileRole[keyof typeof UserProfileRole];


export const UserProfileRole = {
  patient: 'patient',
  pharmacy: 'pharmacy',
  admin: 'admin',
} as const;
