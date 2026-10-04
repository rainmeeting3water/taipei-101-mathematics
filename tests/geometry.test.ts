import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, compassDirection, viewingAngle, ORIGIN } from '../src/geometry.ts';

test('the viewing angle is 45 degrees when rise equals run', () => {
  assert.equal(viewingAngle(382, 382), 45);
  assert.equal(viewingAngle(0, 382), 0);
  assert.throws(() => viewingAngle(382, 0), RangeError);
});
test('distance and angle are invariant when the observer is reversed', () => {
  const landmark = { id: 'test', name: 'test', nameEn: 'test', latitude: ORIGIN.latitude + 0.01, longitude: ORIGIN.longitude, targetElevation: 0, source: 'synthetic test fixture' };
  const down = calculate(landmark, 'down');
  const up = calculate(landmark, 'up');
  assert.ok(down.horizontalMeters > 1100 && down.horizontalMeters < 1120);
  assert.equal(down.horizontalMeters, up.horizontalMeters);
  assert.equal(down.angle, up.angle);
  assert.equal(down.bearing, 0);
  assert.equal(up.bearing, 180);
});
test('compass wraps north and height differences affect the angle', () => {
  assert.equal(compassDirection(359).en, 'N');
  assert.equal(compassDirection(-90).en, 'W');
  assert.ok(viewingAngle(182, 1000) < viewingAngle(382, 1000));
});
