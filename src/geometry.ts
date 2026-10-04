import { distance } from '@turf/distance';
import { bearing } from '@turf/bearing';

export type Mode = 'down' | 'up';
export interface Landmark {
  id: string;
  name: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  targetElevation: number;
  source: string;
}
export const ORIGIN = { latitude: 25.033976, longitude: 121.56453, height: 382 };
export const normalizeBearing = (value: number) => ((value % 360) + 360) % 360;
export function compassDirection(value: number) {
  const index = Math.round(normalizeBearing(value) / 45) % 8;
  return { en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][index], zh: ['北', '東北', '東', '東南', '南', '西南', '西', '西北'][index] };
}
export function viewingAngle(heightDifference: number, horizontalMeters: number) {
  if (!Number.isFinite(heightDifference) || !Number.isFinite(horizontalMeters) || horizontalMeters <= 0) throw new RangeError('A positive finite horizontal distance is required.');
  return Math.atan2(heightDifference, horizontalMeters) * 180 / Math.PI;
}
export function calculate(landmark: Landmark, mode: Mode) {
  if (![landmark.latitude, landmark.longitude, landmark.targetElevation].every(Number.isFinite) || Math.abs(landmark.latitude) > 90 || Math.abs(landmark.longitude) > 180) throw new RangeError('Invalid landmark coordinates.');
  const origin: [number, number] = [ORIGIN.longitude, ORIGIN.latitude];
  const target: [number, number] = [landmark.longitude, landmark.latitude];
  const horizontalMeters = distance(origin, target, { units: 'meters' });
  const heading = normalizeBearing(mode === 'down' ? bearing(origin, target) : bearing(target, origin));
  const heightDifference = ORIGIN.height - landmark.targetElevation;
  return { horizontalMeters, bearing: heading, direction: compassDirection(heading), angle: viewingAngle(heightDifference, horizontalMeters), heightDifference };
}
