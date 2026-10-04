import test from 'node:test';
import assert from 'node:assert/strict';
import { offsetPoint, observationLocations, pairCalculation } from '../src/scene-geometry.ts';
import { calculate, ORIGIN } from '../src/geometry.ts';
const landmark={id:'sun-yat-sen',name:'國父紀念館',nameEn:'Sun Yat-sen Memorial Hall',latitude:25.040038,longitude:121.560245,targetElevation:0,source:'https://data.gov.tw/dataset/7777'};
test('the simulated 3D positions retain explicit, metric offsets',()=>{
  const points=observationLocations(landmark);
  const high={...landmark,latitude:points.high.latitude,longitude:points.high.longitude};
  assert.ok(Math.abs(calculate(high,'down').horizontalMeters-70)<0.01);
  const low=offsetPoint(landmark.longitude,landmark.latitude,120,0);
  assert.ok(low.latitude>landmark.latitude);
  assert.equal(points.highOffset,70);assert.equal(points.lowOffset,120);
});
test('3D modes exchange identical endpoints and use the actual height difference',()=>{
  const points=observationLocations(landmark);
  const pair={high:{...points.high,altitude:ORIGIN.height+20},low:{...points.low,altitude:24+1.6},originGround:20,landmarkGround:24,terrainResolution:0,highOffset:70,lowOffset:120};
  const down=pairCalculation(pair,'down'),up=pairCalculation(pair,'up');
  assert.equal(down.angle,up.angle);
  assert.equal(down.horizontalMeters,up.horizontalMeters);
  assert.equal(down.heightDifference,376.4);
  assert.ok(Math.abs(down.angle-Math.atan2(376.4,down.horizontalMeters)*180/Math.PI)<1e-10);
  assert.ok(down.bearing>300&&up.bearing>120&&up.bearing<180);
  assert.ok(90-down.angle<90&&90+up.angle>90);
});
