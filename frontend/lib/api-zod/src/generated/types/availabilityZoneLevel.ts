
export type AvailabilityZoneLevel = typeof AvailabilityZoneLevel[keyof typeof AvailabilityZoneLevel];


export const AvailabilityZoneLevel = {
  nearby: 'nearby',
  city: 'city',
  district: 'district',
  state: 'state',
  national: 'national',
} as const;
