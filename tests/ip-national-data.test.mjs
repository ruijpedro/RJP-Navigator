import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const file=async name=>JSON.parse(await readFile(new URL('../public/data/ip/'+name+'.json',import.meta.url),'utf8'));
test('IP railway, road and stations are bundled as offline assets',async()=>{
 const [rail,road,stations]=await Promise.all([file('rail'),file('road'),file('stations')]);
 assert.equal(rail.length,56);
 assert.ok(rail.every(r=>r.name&&r.points?.length>1));
 assert.ok(road.length>25000);
 assert.ok(road.every(r=>r.name&&r.points?.length>1&&r.bbox?.length===4));
 assert.equal(stations.length,571);
 assert.ok(stations.every(s=>s.name&&s.point?.length===2&&s.point.every(Number.isFinite)));
});
test('IP road shapefile converted to WGS84 coordinates',async()=>{
 const road=await file('road');
 for(const r of road.slice(0,150)){
  assert.ok(r.points.every(([lat,lng])=>lat>35&&lat<44&&lng>-11&&lng<-5));
 }
});
test('experimental service worker requests IP data for offline use',async()=>{
 const s=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
 for(const name of ['rail','road','stations'])assert.ok(s.includes('data/ip/'+name+'.json'));
});
