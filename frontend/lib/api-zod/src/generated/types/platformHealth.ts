import type { PlatformHealthApiStatus } from './platformHealthApiStatus';
import type { PlatformHealthDbStatus } from './platformHealthDbStatus';
import type { PlatformHealthServerStatus } from './platformHealthServerStatus';

export interface PlatformHealth {
  serverStatus: PlatformHealthServerStatus;
  dbStatus: PlatformHealthDbStatus;
  apiStatus: PlatformHealthApiStatus;
  apiResponseTime: number;
  uptime: number;
  errorRate?: number;
}
