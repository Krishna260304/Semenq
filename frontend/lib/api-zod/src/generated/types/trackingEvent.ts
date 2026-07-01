
export interface TrackingEvent {
  stage: string;
  label: string;
  description?: string;
  timestamp: string | null;
  completed: boolean;
}
