import {calculate,validateRecord,elevation,treeHeight,groundDistance,round1,treeHeightFromDistance,betterPosition} from './core.js';
import {buildWorkbook} from './excel.js';
const $=id=>document.getElementById(id),key='yzu-tree-survey-v1';
let catalog,template,records=[],gps=null,measurements={},stream=null,sensor=null,samples=[],offset=0,calibrated=false,mode='height',captures=[],pending=null,orientationEnabled=false,storageFailed=false,editingId=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5000);}
function error(id,message){$(id).textContent=message;$(id).hidden=!message;}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function showPage(page){if(gpsRun)finishGPS();if(page!=="guide")document.getElementById("tutorial-video")?.pause();document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==`page-${page}`);document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.page===page));if(page==='records')renderRecords();window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>showPage(el.dataset.page)));
$('guide-link').addEventListener('click',e=>{e.preventDefault();showPage('guide');});
function idValue(){return `${$('zone').value}-${$('student-id').value.trim().slice(-4)}-${$('sequence').value}`;}
function getRecord(){return {id:idValue(),zone:$('zone').value,species:$('species').value.trim(),recorder:$('recorder').value.trim(),studentId:$('student-id').value.trim(),sequence:Number($('sequence').value),date:$('date').value,health:$('health').value,circumferences:['c1','c2','c3'].map(id=>$(id).value===''?null:Number($(id).value)),height:measurements.height?.value,crownEW:measurements.ew?.value,crownNS:measurements.ns?.value,gps,photoCount:Number($('photo-count').value),identification:$('identification').value,inat:$('inat').value.trim(),notes:$('notes').value.trim(),measurements:structuredClone(measurements),savedAt:new Date().toISOString()};}
function renderResult(){
  $('tree-id').textContent=$('student-id').value.length>=4?idValue():'尚未填寫學號';
  if(!catalog)return;
  const species=catalog.species.find(s=>s.name===$('species').value.trim());
  $('species-info').textContent=species?`${species.scientific} · ${species.type} · ${species.density==null?'採通用密度 0.60':`木材密度 ${species.density}`}`:'99 種校園樹種，名稱與課程計算表一致。';
  try{const r=calculate(getRecord(),species??{});if(!species)throw Error('請選擇清單中的樹種。');
    $('carbon-value').textContent=r.excluded?'不適用':r.carbon.toLocaleString('zh-TW',{minimumFractionDigits:1});
    $('co2-value').textContent=r.excluded?'不計碳':`${r.co2.toLocaleString('zh-TW',{minimumFractionDigits:1})} kg`;
    $('dbh-value').textContent=`${r.dbh.toFixed(1)} cm`;
    $('agb-value').textContent=r.excluded?'—':`${r.agb.toFixed(1)} kg`;
    $('comparison-value').textContent=r.excluded?'—':`${r.comparison.toFixed(1)} kg`;
    $('difference-value').textContent=r.excluded?'—':`${(r.difference*100).toFixed(1)} %`;
    $('result-status').textContent=r.excluded?'此生長型不適用本碳模型；仍可保存盤查紀錄。':'預估結果 · 尚需按下儲存。手機估測＋通用密度估算，兩法差異為模型不確定性。';
  }catch{for(const id of ['carbon-value','co2-value','dbh-value','agb-value','comparison-value','difference-value'])$(id).textContent='—';$('result-status').textContent='完成樹種、有效周長與樹高後顯示預估結果。';}
}
$('survey-form').addEventListener('input',renderResult);
function persist(next){if(storageFailed)throw Error('原有本機資料無法讀取，已停止覆寫。請先匯出或檢查瀏覽器儲存。');try{localStorage.setItem(key,JSON.stringify({version:1,records:next}));}catch{throw Error('此瀏覽器無法保存資料或空間不足，請先匯出備份。');}records=next;}
$('survey-form').addEventListener('submit',e=>{
  e.preventDefault();error('form-error','');try{
    if(gpsRun)throw Error('請等定位完成，或先按「停止取樣並採用」。');const r=getRecord();r.result=validateRecord(r,catalog,records.filter(x=>x.id!==editingId));
    if(!Number.isInteger(r.photoCount)||r.photoCount<0)throw Error('照片張數須為零或正整數。');
    const prior=records.find(x=>x.id===editingId);
    if(prior){const {revisions,...snapshot}=prior;r.revisions=[...(revisions??[]),snapshot];persist(records.map(x=>x.id===editingId?r:x));}else persist([...records,r]);
    editingId=null;$('save-label').textContent='儲存這棵樹並計算';$('cancel-edit').hidden=true;$('nav-count').textContent=records.length;toast(`已儲存 ${r.id}；${r.photoCount<4?'照片待補。':'手機估測紀錄。'}`);
    $('sequence').value=r.sequence+1;for(const id of ['c1','c2','c3','notes','inat'])$(id).value='';$('photo-count').value='0';$('identification').value='L0';gps=null;measurements={};$('at-tree').checked=false;
    for(const id of ['height-output','ew-output','ns-output'])$(id).innerHTML='— <small>m</small>';$('gps-output').textContent='請站在下一棵樹旁取得 GPS';renderResult();showPage('records');
  }catch(e){error('form-error',e.message);}
});
function renderRecords(){
  $('nav-count').textContent=records.length;$('total-trees').textContent=records.length;
  const total=records.reduce((sum,r)=>sum+(r.result.co2??0),0);$('total-co2').innerHTML=`${round1(total).toLocaleString('zh-TW')} <small>kg</small>`;
  $('total-incomplete').textContent=records.filter(r=>r.photoCount<4).length;$('export-excel').disabled=!records.length;$('export-json').disabled=!records.length;
  $('record-list').innerHTML=records.length?records.slice().reverse().map(r=>`<article class="record"><div><h3>${esc(r.species)} <span class="tag light">${esc(r.id)}</span></h3><p>${esc(r.recorder)} · ${esc(r.date)} · 樹高 ${r.height.toFixed(1)} m</p><p>${r.photoCount<4?'照片待補 · ':''}手機估測 · ${r.result.excluded?'此類型不計碳':'通用密度估算'}</p><p>冠幅 ${r.crownEW.toFixed(1)} × ${r.crownNS.toFixed(1)} m · 周長 ${r.circumferences.filter(x=>x!=null).join(' / ')} cm</p></div><div class="record-number">${r.result.excluded?'不適用':r.result.co2.toLocaleString('zh-TW',{minimumFractionDigits:1})}<small>${r.result.excluded?'保留調查紀錄':'kg CO₂ 當量'}</small></div></article>`).join(''):'<div class="empty"><h2>第一棵樹，從這裡開始</h2><p>完成現場盤查並儲存後，紀錄會出現在這裡。</p><button id="empty-start" style="margin-top:20px">開始盤查</button></div>';
  $('empty-start')?.addEventListener('click',()=>showPage('survey'));
  document.querySelectorAll('.record').forEach((el,index)=>{const button=document.createElement('button');button.type='button';button.textContent='補充／修正';button.className='edit-record';button.addEventListener('click',()=>editRecord(records[records.length-1-index]));el.querySelector('div').append(button);});
}
function editRecord(r){
  editingId=r.id;gps=structuredClone(r.gps);measurements=structuredClone(r.measurements);
  const fields={zone:r.zone,species:r.species,recorder:r.recorder,'student-id':r.studentId,sequence:r.sequence,date:r.date,health:r.health,c1:r.circumferences[0],c2:r.circumferences[1]??'',c3:r.circumferences[2]??'','photo-count':r.photoCount,identification:r.identification,inat:r.inat,notes:r.notes};
  for(const [id,value] of Object.entries(fields))$(id).value=value;
  for(const [key,id] of [['height','height-output'],['ew','ew-output'],['ns','ns-output']])$(id).innerHTML=`${measurements[key].value.toFixed(1)} <small>m</small>`;
  $('gps-output').textContent=`${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}｜精度約 ${Math.round(gps.accuracy)} m`;
  $('save-label').textContent='儲存修正並重新計算';$('cancel-edit').hidden=false;error('form-error','');renderResult();showPage('survey');
}
$('cancel-edit').addEventListener('click',()=>{editingId=null;$('save-label').textContent='儲存這棵樹並計算';$('cancel-edit').hidden=true;$('survey-form').reset();$('date').value=localDate();gps=null;measurements={};for(const id of ['height-output','ew-output','ns-output'])$(id).innerHTML='— <small>m</small>';$('gps-output').textContent='請站在樹旁取得 GPS';renderResult();showPage('records');});
let gpsRun=null;
function finishGPS(message=''){
  if(!gpsRun)return;
  const run=gpsRun;gpsRun=null;clearTimeout(run.timer);navigator.geolocation.clearWatch(run.watch);
  gps=run.best?{...run.best,samples:run.count,selection:'20 秒內手機回報精度最佳的讀值'}:null;
  $('get-gps').disabled=false;$('get-gps').textContent='樹旁重新定位';$('finish-gps').hidden=true;
  $('gps-output').textContent=gps?`${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}｜回報精度約 ${Math.round(gps.accuracy)} m，${run.count} 次有效回報。${gps.accuracy>15?'定位範圍偏大，建議在樹旁重取並補地標。':'已採用；仍請核對樹木編號。'}`:(message||'尚未取得座標，請確認手機定位與瀏覽器權限，再於樹旁重試。');
}
$('finish-gps').addEventListener('click',()=>finishGPS());
$('at-tree').addEventListener('change',()=>{if(!$('at-tree').checked&&gpsRun){gpsRun.best=null;finishGPS('已取消。請到樹幹旁站定後重新定位。');}});
$('get-gps').addEventListener('click',()=>{
  if(!$('at-tree').checked){toast('先走到樹幹旁，勾選站位確認。GPS 不用在量樹高的遠處取得。');return;}
  if(!navigator.geolocation){toast('此瀏覽器不支援定位，請改用手機 Safari 或 Chrome。');return;}
  if(gpsRun)return;
  gps=null;const run={best:null,count:0,startedAt:Date.now(),watch:null,timer:null};gpsRun=run;
  $('get-gps').disabled=true;$('finish-gps').hidden=false;$('get-gps').textContent='定位取樣中…';$('gps-output').textContent='請在樹幹旁停留 20 秒；不要走回量樹高的站位。';
  try{run.watch=navigator.geolocation.watchPosition(position=>{
    if(gpsRun!==run)return;
    const accepted=betterPosition(null,position,run.startedAt);if(!accepted)return;
    run.count++;run.best=betterPosition(run.best,position,run.startedAt);
    $('gps-output').textContent=`已收到 ${run.count} 次有效回報，最佳回報精度約 ${Math.round(run.best.accuracy)} m。請在樹旁繼續站定。`;
  },e=>{if(gpsRun!==run)return;if(e.code===1){run.best=null;finishGPS('定位權限未開啟。請在手機定位服務及此網站權限中允許，再重試。');}else $('gps-output').textContent='定位暫時不穩，仍在等待。請留在樹旁；沒有讀值時稍後重試。';},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  run.timer=setTimeout(()=>finishGPS(),20000);
  }catch{finishGPS('無法啟動定位，請確認手機定位與瀏覽器權限。');}
});
window.addEventListener('pagehide',()=>{if(gpsRun)finishGPS();});
function stopCamera(){stream?.getTracks().forEach(t=>t.stop());stream=null;$('camera').srcObject=null;}
function resetCapture(){captures=[];pending=null;$('measure-result').hidden=true;$('use-measure').disabled=true;$('capture-angle').disabled=false;error('measure-error','');$('capture-progress').textContent='';$('capture-angle').textContent=mode==='height'?'記錄樹基角度':'記錄另一端地面角度';updateMeasurementStep();}
function openMeasure(next){mode=next;calibrated=false;offset=0;sensor=null;samples=[];updateDistanceMode();resetCapture();$('level-ground').checked=false;$('direction-check').checked=false;$('direction-check-wrap').hidden=mode==='height';$('measure-title').textContent=mode==='height'?'量樹高':mode==='ew'?'量東西向冠幅':'量南北向冠幅';$('measure-instructions').textContent=mode==='height'?'站在平坦地面，先瞄樹基中心，再瞄樹頂。兩次保持同一站位、同一鏡頭高度；樹頂應大致在樹基正上方。':`站在樹冠${mode==='ew'?'西端（或東端）':'南端（或北端）'}的地面投影點，讓鏡頭垂直位於此點上方，瞄準另一端地面投影點。保持鏡頭高度，請同伴協助指認。`;$('camera-placeholder').hidden=false;$('measure-dialog').showModal();$('measure-dialog').scrollTop=0;}
function usingTape(){return mode==='height'&&$('height-method').value==='tape';}
function updateMeasurementStep(){
  $('measurement-step').textContent=pending?'完成：檢查結果，再按「帶入紀錄」。':captures.length?'第 3 步／瞄樹頂：原地轉動手機，鏡頭高度不變。':mode==='height'?'第 1 步／準備：量好高度或距離 → 校正。第 2 步／瞄樹基。':'準備：先找兩端地面投影，鏡頭在第一端正上方，瞄第二端。';
}
function updateDistanceMode(){
  const tape=usingTape();$('height-method-wrap').hidden=mode!=='height';$('baseline-wrap').hidden=!tape;$('phone-height-wrap').hidden=tape;
  $('height-method-hint').textContent=tape?'在平地用捲尺量「鏡頭正下方到樹基」的水平距離；不可用 GPS、步數或斜距。換站位就要重量。':'先量鏡頭離地高度。樹基俯角太小，距離誤差會放大；可改用捲尺距離。';
  $('ground-confirm-label').textContent=tape?'我確認地面等高，已量好水平距離，會固定站位與鏡頭高度。':'我確認地面等高，已量好鏡頭高度，會固定站位。';
}
$('height-method').addEventListener('change',()=>{$('level-ground').checked=false;updateDistanceMode();resetCapture();});
$('baseline-distance').addEventListener('input',resetCapture);
document.querySelectorAll('[data-measure]').forEach(el=>el.addEventListener('click',()=>openMeasure(el.dataset.measure)));
$('close-measure').addEventListener('click',()=>$('measure-dialog').close());$('measure-dialog').addEventListener('close',()=>{stopCamera();sensor=null;samples=[];});
$('restart-measure').addEventListener('click',resetCapture);
function onOrientation(e){
  if(!$('measure-dialog').open||e.beta==null||e.gamma==null)return;
  const now=performance.now(),raw=elevation(e.beta,e.gamma);let heading=null;
  if(Number.isFinite(e.webkitCompassHeading)&&(!Number.isFinite(e.webkitCompassAccuracy)||e.webkitCompassAccuracy>=0&&e.webkitCompassAccuracy<=20))heading=e.webkitCompassHeading;
  else if(e.absolute&&e.alpha!=null)heading=(360-e.alpha)%360;
  sensor={raw,angle:raw-offset,gamma:e.gamma,heading,time:now};samples.push({angle:sensor.angle,raw:sensor.raw,time:now});samples=samples.filter(x=>now-x.time<900);
}
setInterval(()=>{
  if(!$('measure-dialog').open)return;
  if($('angle-mode').value==='manual'){$('sensor-status').textContent='手動角度模式';$('angle-display').textContent=$('manual-angle').value?`${Number($('manual-angle').value).toFixed(1)}°`:'—°';$('stability-display').textContent='使用工具實際讀值';return;}
  if(!sensor||performance.now()-sensor.time>1500){$('sensor-status').textContent='尚未收到角度資料';$('angle-display').textContent='—°';$('stability-display').textContent='啟用權限並直向握持';$('heading-display').textContent='方向 —';return;}
  $('angle-display').textContent=`${sensor.angle.toFixed(1)}°`;$('sensor-status').textContent=calibrated?'已水平校正':'請先水平校正';
  const spread=samples.length>1?Math.max(...samples.map(s=>s.angle))-Math.min(...samples.map(s=>s.angle)):99;
  $('stability-display').textContent=Math.abs(sensor.gamma)>15?'請將手機左右扶正':spread>1?'稍等，保持穩定':'角度穩定';
  $('heading-display').textContent=sensor.heading==null?'方位不可用，請依地圖確認':`${['北','東北','東','東南','南','西南','西','西北'][Math.round(sensor.heading/45)%8]} ${Math.round(sensor.heading)}°（參考）`;
},200);
$('enable-sensors').addEventListener('click',async()=>{
  error('measure-error','');if(!window.isSecureContext){error('measure-error','相機與定位需 HTTPS 安全網址；手機請開啟部署後的 GitHub Pages。');return;}
  try{
    if(typeof DeviceOrientationEvent==='undefined')throw Error('此裝置沒有角度感測器，可改用「手動輸入角度」測試。');
    if(typeof DeviceOrientationEvent.requestPermission==='function'){const status=await DeviceOrientationEvent.requestPermission();if(status!=='granted')throw Error('未取得動作感測權限，請在瀏覽器設定開啟。');}
    if(!orientationEnabled){window.addEventListener('deviceorientation',onOrientation);window.addEventListener('deviceorientationabsolute',onOrientation);orientationEnabled=true;}
  }catch(e){error('measure-error',e.message);}
  try{stopCamera();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{exact:'environment'}},audio:false});if(!$('measure-dialog').open){stopCamera();return;}$('camera').srcObject=stream;await $('camera').play();$('camera-placeholder').hidden=true;}
  catch{error('measure-error',`${$('measure-error').textContent} 後置相機未能開啟；請檢查相機權限並使用有後置相機的手機。`.trim());}
});
$('calibrate').addEventListener('click',()=>{try{if(!sensor||performance.now()-sensor.time>1500)throw Error('請先啟用感測器。');if(Math.abs(sensor.raw)>12||Math.abs(sensor.gamma)>10)throw Error('請直立握持，鏡頭瞄準同高標記；目前姿勢偏離水平太多。');if(samples.length<4||samples.at(-1).time-samples[0].time<500||Math.max(...samples.map(s=>s.raw))-Math.min(...samples.map(s=>s.raw))>1)throw Error('對準同高標記後保持穩定至少一秒，再按校正。');offset=samples.reduce((n,s)=>n+s.raw,0)/samples.length;calibrated=true;samples=[];resetCapture();toast('已完成水平校正，請重新瞄準量測點。');}catch(e){error('measure-error',e.message);}});
$('angle-mode').addEventListener('change',()=>{$('manual-angle-field').hidden=$('angle-mode').value!=='manual';resetCapture();});
$('phone-height').addEventListener('input',resetCapture);
function readAngle(){
  if($('angle-mode').value==='manual'){if($('manual-angle').value==='')throw Error('請輸入角度。');const value=Number($('manual-angle').value);if(!Number.isFinite(value))throw Error('角度無效。');return value;}
  if(!sensor||performance.now()-sensor.time>1500)throw Error('尚無有效的感測器讀值，請啟用感測器。');
  if(!calibrated)throw Error('請先對準同高標記完成水平校正。');
  if(!stream?.active)throw Error('請啟用後置相機，透過畫面中央準星瞄準。');
  if(Math.abs(window.screen.orientation?.angle??window.orientation??0)%180!==0||window.innerWidth>window.innerHeight)throw Error('量測時請直向握持手機。');
  if(Math.abs(sensor.gamma)>15)throw Error('手機左右傾斜過大，請扶正。');
  if(samples.length<4||samples.at(-1).time-samples[0].time<500||Math.max(...samples.map(s=>s.angle))-Math.min(...samples.map(s=>s.angle))>1)throw Error('請保持穩定至少一秒，再記錄角度。');
  return samples.reduce((n,s)=>n+s.angle,0)/samples.length;
}
$('capture-angle').addEventListener('click',()=>{error('measure-error','');try{
  if(!$('level-ground').checked)throw Error('請先確認地面等高與鏡頭高度。');
  if(mode!=='height'&&!$('direction-check').checked)throw Error('請確認兩端的方位與樹冠地面投影。');
  const angle=readAngle(),phoneHeight=Number($('phone-height').value),method=($('angle-mode').value==='manual'?'手填工具角度':'手機感測器')+(usingTape()?'／捲尺水平基線':'／鏡頭高度推距離');
  if(mode==='height'&&!captures.length){if(usingTape())treeHeightFromDistance(Number($('baseline-distance').value),angle,1);else groundDistance(phoneHeight,angle);captures=[angle];$('capture-progress').textContent=`樹基 ${angle.toFixed(1)}° 已記錄。保持高度與站位，現在瞄準樹頂。`;$('capture-angle').textContent='記錄樹頂角度';updateMeasurementStep();return;}
  const baseAngle=mode==='height'?captures[0]:angle,calc=mode==='height'?(usingTape()?treeHeightFromDistance(Number($('baseline-distance').value),baseAngle,angle):treeHeight(phoneHeight,baseAngle,angle)):{distance:groundDistance(phoneHeight,baseAngle)};
  const value=round1(mode==='height'?calc.height:calc.distance);
  pending={value,method,phoneHeight:usingTape()?null:phoneHeight,distanceSource:usingTape()?'tape':'phone-height',baseAngle,topAngle:mode==='height'?angle:null,distance:calc.distance,heading:$('angle-mode').value==='sensor'?sensor?.heading:null,calibrationOffset:$('angle-mode').value==='sensor'?offset:null,levelGround:true,recordedAt:new Date().toISOString()};
  $('measure-result').innerHTML=`<span>${mode==='height'?'樹高':'冠幅'}估測結果</span><strong>${value.toFixed(1)} m</strong><p>${mode==='height'?`${usingTape()?'實量':'推估'}水平距離 ${calc.distance.toFixed(2)} m · `:''}尚未經實地高度比對</p><p>${!usingTape()&&Math.abs(baseAngle)<10?'樹基俯角小於 10°，誤差容易放大。建議改用捲尺水平距離。':'請換方向複測；差異超過 10% 或 1 m 應重量。'}</p>`;$('measure-result').hidden=false;$('use-measure').disabled=false;$('capture-angle').disabled=true;updateMeasurementStep();
}catch(e){error('measure-error',e.message);}});
$('use-measure').addEventListener('click',()=>{if(!pending)return;measurements[mode]=pending;$(mode==='height'?'height-output':mode==='ew'?'ew-output':'ns-output').innerHTML=`${pending.value.toFixed(1)} <small>m</small>`;$('measure-dialog').close();renderResult();});
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('export-excel').addEventListener('click',()=>{try{download(buildWorkbook(records,template,catalog),`元智樹木盤查_${localDate()}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('已匯出 Excel；開啟後公式會重新計算。');}catch(e){toast(`匯出失敗：${e.message}`);}});
$('export-json').addEventListener('click',()=>download(JSON.stringify({version:1,records},null,2),`樹木盤查備份_${localDate()}.json`,'application/json'));
function checkImportedRecord(r,existing){
  if(!r||typeof r!=='object'||!Array.isArray(r.circumferences)||r.circumferences.length!==3||typeof r.recorder!=='string'||typeof r.studentId!=='string'||typeof r.species!=='string'||typeof r.date!=='string'||typeof r.notes!=='string')throw Error('備份中的紀錄格式不正確。');
  if(r.id!==`${r.zone}-${r.studentId.slice(-4)}-${r.sequence}`)throw Error('備份中的樹木編號與調查者不符。');
  if(!Number.isInteger(r.photoCount)||r.photoCount<0||!['L0','L1','L2','L3'].includes(r.identification)||!['良','普','差','枯死'].includes(r.health))throw Error('備份中的照片張數、健康度或鑑定分級無效。');
  for(const [key,value] of [['height',r.height],['ew',r.crownEW],['ns',r.crownNS]]){if(!Number.isFinite(value)||!r.measurements?.[key]||r.measurements[key].value!==value)throw Error('備份缺少量測原始紀錄。');}
  return {...r,result:validateRecord(r,catalog,existing)};
}
$('import-json').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10*1024*1024)throw Error('備份檔過大。');const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.records))throw Error('不支援此備份格式。');const next=[...records];let added=0,skipped=0;for(const raw of data.records){if(next.some(r=>r.id===raw.id)){skipped++;continue;}next.push(checkImportedRecord(raw,next));added++;}persist(next);renderRecords();toast(`還原 ${added} 筆，略過 ${skipped} 筆同編號紀錄。`);}catch(e){toast(`還原失敗：${e.message}`);}finally{$('import-json').value='';}});
async function init(){try{
  const responses=await Promise.all([fetch('./data/catalog.json'),fetch('./data/workbook-template.json')]);if(responses.some(r=>!r.ok))throw Error('資料檔讀取失敗');[catalog,template]=await Promise.all(responses.map(r=>r.json()));
  $('zone').innerHTML=catalog.zones.map(z=>`<option value="${esc(z.code)}">${esc(z.code)} · ${esc(z.name)}</option>`).join('');$('species-list').innerHTML=catalog.species.map(s=>`<option value="${esc(s.name)}">${esc(s.scientific)}</option>`).join('');$('date').value=localDate();
  try{const raw=localStorage.getItem(key);if(raw){const saved=JSON.parse(raw);if(saved.version!==1||!Array.isArray(saved.records))throw Error('版本不符');const checked=[];for(const r of saved.records)checked.push(checkImportedRecord(r,checked));records=checked;}}catch{storageFailed=true;toast('本機資料無法讀取，已停止覆寫。請保留瀏覽器資料並檢查備份。');}
  renderRecords();renderResult();
}catch(e){error('form-error',`初始化失敗：${e.message}。請使用網頁伺服器開啟，勿直接雙擊 HTML。`);$('survey-form').querySelector('button[type=submit]').disabled=true;}}
init();
