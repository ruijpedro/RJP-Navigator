import test from 'node:test';
import assert from 'node:assert/strict';
import {pkStatus,nearest} from '../src/lib/ipSpatial.mjs';
const anchors=[{chainage:0,pk:21000},{chainage:100,pk:21120}];
test('calibrated PK takes precedence',()=>assert.deepEqual(pkStatus(50,anchors,999),{status:'calibrated',pk:21060}));
test('no silent extrapolation',()=>assert.deepEqual(pkStatus(101,anchors),{status:'unavailable',pk:null}));
test('explicit estimate is labelled',()=>assert.deepEqual(pkStatus(101,anchors,21121),{status:'estimated',pk:21121}));
test('invalid GPS rejected',()=>{for(const p of [{lat:null,lng:0},{lat:'',lng:0},{lat:91,lng:0},{lat:39,lng:181}])assert.equal(nearest(p,[{point:[39,-9]}]),null);});
