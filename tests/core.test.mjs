import vm from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate,treeHeight,groundDistance,elevation,validateRecord,treeHeightFromDistance,betterPosition} from '../core.js';
import {buildWorkbook} from '../excel.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url)));
const template=JSON.parse(fs.readFileSync(new URL('../data/workbook-template.json',import.meta.url)));
const species=catalog.species.find(s=>s.name==='樟樹');
const measurement={value:12,method:'測試資料／手填角度',phoneHeight:1.5,baseAngle:-10,topAngle:45,distance:8.5,recordedAt:'2026-10-02T00:00:00Z'};
const record={id:'ZJ-9999-1',zone:'ZJ',species:'樟樹',recorder:'原型測試',studentId:'TEST9999'.replace('TEST','114'),sequence:1,date:'2026-10-02',health:'良',circumferences:[120,null,null],height:12,crownEW:8.5,crownNS:7.2,gps:{lat:24.9683,lon:121.2635,accuracy:5,timestamp:'2026-10-02T00:00:00Z'},photoCount:4,identification:'L2',inat:'',notes:'合成測試紀錄，非現場調查',savedAt:'2026-10-02T00:00:00Z',measurements:{height:measurement,ew:{...measurement,value:8.5},ns:{...measurement,value:7.2}}};
test('course example has identical rounded values',()=>{const r=calculate(record,species);assert.deepEqual([r.dbh,r.agb,r.biomass,r.carbon,r.co2,r.comparison],[38.2,566.2,702.1,330,1210,534.8]);assert.equal(Math.round(r.difference*1000)/10,-5.5);});
test('multi-stem uses equivalent basal area and remains one tree',()=>{const r=calculate({...record,circumferences:[80,60,40],height:14},catalog.species.find(s=>s.name==='蓮霧'));assert.equal(r.dbh,34.3);});
test('palm excluded; blank/negative circumferences and small DBH rejected',()=>{assert.equal(calculate(record,{...species,type:'棕櫚'}).excluded,true);for(const cs of [[null,null,null],[-120,null,null],[10,null,null]])assert.throws(()=>calculate({...record,circumferences:cs},species));});
test('known geometric setup recovers distance and height',()=>{const base=-Math.atan(1.5/10)*180/Math.PI,top=Math.atan((12-1.5)/10)*180/Math.PI;const r=treeHeight(1.5,base,top);assert.ok(Math.abs(r.height-12)<1e-10);assert.ok(Math.abs(r.distance-10)<1e-10);assert.ok(Math.abs(groundDistance(1.5,-Math.atan(1.5/8)*180/Math.PI)-8)<1e-10);});
test('reject unsuitable geometry and top angles',()=>{for(const a of [-1,0,10,-80])assert.throws(()=>groundDistance(1.5,a));assert.throws(()=>treeHeight(1.5,-10,70));assert.throws(()=>treeHeight(0,-10,30));});
test('rear camera elevation mapping',()=>{assert.ok(Math.abs(elevation(90,0))<1e-10);assert.ok(Math.abs(elevation(80,0)+10)<1e-10);assert.ok(Math.abs(elevation(120,0)-30)<1e-10);});
test('first circumference mandatory and infinite height invalid',()=>{assert.throws(()=>calculate({...record,circumferences:[null,60,null]},species));assert.throws(()=>calculate({...record,height:Infinity},species));});
test('required GPS, duplicate IDs, species and crown rejected',()=>{assert.equal(validateRecord(record,catalog).carbon,330);assert.throws(()=>validateRecord({...record,gps:null},catalog));assert.throws(()=>validateRecord(record,catalog,[record]));assert.throws(()=>validateRecord({...record,species:'不明'},catalog));assert.throws(()=>validateRecord({...record,crownNS:0},catalog));});
test('export original formulas, raw data, cached results and safe strings',()=>{
  const bytes=buildWorkbook([record,{...record,id:'ZJ-9999-2',sequence:2,notes:'=HYPERLINK("evil")'}],template,catalog);assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);
  const text=new TextDecoder().decode(bytes);assert.ok(text.includes('參數設定!$B$4*($U6*$V6^2*$F6)^參數設定!$B$5'));assert.ok(text.includes('量測原始紀錄'));assert.ok(text.includes('<v>1210</v>'));assert.ok(text.includes('<t xml:space="preserve">=HYPERLINK'));
  fs.mkdirSync(new URL('../.test-output/',import.meta.url),{recursive:true});
  fs.writeFileSync(new URL('../.test-output/export-check.xlsx',import.meta.url),bytes);
  const completed={...record,result:calculate(record,species)};
  fs.writeFileSync(new URL('../.test-output/fixture.json',import.meta.url),JSON.stringify({version:1,records:[completed]},null,2));
});

test('measured horizontal baseline gives known height and rejects invalid inputs',()=>{
  const base=-Math.atan(1.5/10)*180/Math.PI,top=Math.atan(10.5/10)*180/Math.PI;
  assert.ok(Math.abs(treeHeightFromDistance(10,base,top).height-12)<1e-10);
  for(const d of [0,-1,Infinity,NaN,101])assert.throws(()=>treeHeightFromDistance(d,base,top));
  for(const b of [0,3,-80,NaN])assert.throws(()=>treeHeightFromDistance(10,b,top));
  assert.throws(()=>treeHeightFromDistance(10,base,65));
  const shifted=base+0.5;
  assert.ok(Math.abs(treeHeightFromDistance(10,shifted,top).height-12)<Math.abs(treeHeight(1.5,shifted,top).height-12));
});
test('GPS selection excludes stale and invalid positions and retains best reported accuracy',()=>{
  const start=1000,pos=(accuracy,timestamp=2000)=>({timestamp,coords:{latitude:24,longitude:121,accuracy}});
  assert.equal(betterPosition(null,pos(5,999),start),null);
  for(const a of [0,-1,Infinity,NaN])assert.equal(betterPosition(null,pos(a),start),null);
  const first=betterPosition(null,pos(30),start),best=betterPosition(first,pos(8,3000),start);
  assert.equal(best.accuracy,8);assert.equal(betterPosition(best,pos(20,4000),start),best);
});
test('tape baseline method and distance persist in Excel raw measurement sheet',()=>{
  const tape={...record,measurements:{...record.measurements,height:{...measurement,method:'手機感測器／捲尺水平基線',phoneHeight:null,distance:10,distanceSource:'tape'}}};
  const xml=new TextDecoder().decode(buildWorkbook([tape],template,catalog));
  assert.ok(xml.includes('捲尺水平基線'));assert.ok(xml.includes('distanceSource'));assert.ok(xml.includes('<v>1210</v>'));
});

test('GPS session stops watcher, keeps best result and ignores callbacks after completion',()=>{
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,hidden:false,disabled:false,textContent:'',events:{},addEventListener(type,fn){this.events[type]=fn;}});return elements.get(id);};
  let success,fail,cleared=null;const timers=new Map();let nextTimer=0;
  const context=vm.createContext({document:{getElementById:element,querySelectorAll:()=>[]},window:{addEventListener(){}},navigator:{geolocation:{watchPosition(ok,bad){success=ok;fail=bad;return 42;},clearWatch(id){cleared=id;}}},setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id);},setInterval(){},betterPosition,Date,console});
  const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/init\(\);\s*$/,'');
  vm.runInContext(source,context);
  element('at-tree').checked=true;element('get-gps').events.click();
  assert.equal(element('get-gps').disabled,true);
  const pos=accuracy=>({timestamp:Date.now()+1,coords:{latitude:24,longitude:121,accuracy}});
  success(pos(20));success(pos(7));success(pos(14));
  element('finish-gps').events.click();assert.equal(cleared,42);assert.equal(element('get-gps').disabled,false);
  assert.equal(vm.runInContext('gps.accuracy',context),7);assert.equal(vm.runInContext('gps.samples',context),3);
  success(pos(2));assert.equal(vm.runInContext('gps.accuracy',context),7);
  element('get-gps').events.click();fail({code:1});assert.equal(vm.runInContext('gps',context),null);assert.match(element('gps-output').textContent,/權限/);
  element('get-gps').events.click();success(pos(5));element('at-tree').checked=false;element('at-tree').events.change();assert.equal(vm.runInContext('gps',context),null);assert.match(element('gps-output').textContent,/取消/);
});
