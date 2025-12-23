import { DateTime } from 'luxon'

export interface IProviderConnectionStatus {
  status: 'connected' | 'disconnected';
  instanceId: string;
  eventMoment: number;
}
