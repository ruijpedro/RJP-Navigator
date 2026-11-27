import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSegment,projectCorridor,calibratedPk} from '../src/lib/ipSpatial.mjs';
test('metric projection',()=>{
 const q=projectSegment([40,12],[0,0],[100,0]);
 assert.deepEqual(q.point,[40,0]);assert.equal(q.distance,12);
});
test('projection clamps to segment',()=>assert.equal(projectSegment([120,0],[0,0],[100,0]).offset,100));
test('corridor cumulative distance',()=>assert.equal(projectCorridor([100,30],[[0,0],[100,0],[100,100]]).chainage,130));
test('calibration in metres',()=>assert.equal(calibratedPk(50,[{chainage:0,pk:21000},{chainage:100,pk:21120}]),21060));
test('reverse calibration',()=>assert.equal(calibratedPk(50,[{chainage:0,pk:21120},{chainage:100,pk:21000}]),21060));
test('no uncalibrated PK',()=>{assert.equal(calibratedPk(101,[{chainage:0,pk:0},{chainage:100,pk:100}]),null);assert.equal(calibratedPk(0,[]),null);});
