import { distance } from '@turf/distance';
import { bearing } from '@turf/bearing';
import { ORIGIN, normalizeBearing, compassDirection, viewingAngle, type Landmark, type Mode } from './geometry.ts';
export interface Endpoint { longitude:number; latitude:number; altitude:number }
export interface ScenePair { high:Endpoint; low:Endpoint; originGround:number; landmarkGround:number; terrainResolution:number; highOffset:number; lowOffset:number; baseReference?:Endpoint; lowReference?:Endpoint }
// Spherical direct solution: offsets are explicit simulated observation positions.
export function offsetPoint(longitude:number, latitude:number, meters:number, heading:number) {
  const r=6371008.8, d=meters/r, a=latitude*Math.PI/180, l=longitude*Math.PI/180, b=heading*Math.PI/180;
  const lat=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(b));
  const lon=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(lat));
  return {longitude:lon*180/Math.PI,latitude:lat*180/Math.PI};
}
export function observationLocations(item:Landmark) {
  const heading=bearing([ORIGIN.longitude,ORIGIN.latitude],[item.longitude,item.latitude]);
  return {high:offsetPoint(ORIGIN.longitude,ORIGIN.latitude,70,heading),low:offsetPoint(item.longitude,item.latitude,120,heading+180),highOffset:70,lowOffset:120};
}
export function pairCalculation(pair:ScenePair, mode:Mode) {
  const from=mode==='down'?pair.high:pair.low, to=mode==='down'?pair.low:pair.high;
  const horizontalMeters=distance([from.longitude,from.latitude],[to.longitude,to.latitude],{units:'meters'});
  const heading=normalizeBearing(bearing([from.longitude,from.latitude],[to.longitude,to.latitude]));
  const heightDifference=pair.high.altitude-pair.low.altitude;
  return {horizontalMeters,bearing:heading,direction:compassDirection(heading),angle:viewingAngle(heightDifference,horizontalMeters),heightDifference};
}

