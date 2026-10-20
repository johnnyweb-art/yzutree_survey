import {calculate,validateRecord,elevation,treeHeight,groundDistance,round1,treeHeightFromDistance,betterPosition,cameraDirection,turnDelta,crownWidthFromTurns,radians} from './core.js';
import {buildWorkbook} from './excel.js';
const $=id=>document.getElementById(id),key='yzu-tree-survey-v1';
let catalog,template,records=[],gps=null,measurements={},stream=null,sensor=null,samples=[],offset=0,mode='height',captures=[],pending=null,orientationEnabled=false,storageFailed=false,editingId=null;
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
const lensKey='yzu-tree-lens-height',offsetKey='yzu-tree-pitch-offset';
function stored(k){try{return localStorage.getItem(k);}catch{return null;}}
function store(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,String(v));}catch{}}
let step=1,relativeSeen=0,absoluteHeading=null;
const isHeight=()=>mode==='height',manualMode=()=>$('angle-mode').value==='manual';
const stepLabels=()=>isHeight()?['準備','樹基','樹頂','結果']:['準備','樹幹','第一端','第二端','結果'];
const lastStep=()=>stepLabels().length,aiming=()=>step>=2&&step<lastStep();
const kindOf=()=>!isHeight()&&step>=3?'turn':'pitch';
function usingTape(){return $('height-method').value==='tape';}
function axisText(){return mode==='ew'?{edges:'東、西',stand:'正南或正北'}:{edges:'南、北',stand:'正東或正西'};}
function resetCapture(){step=1;captures=[];pending=null;$('measure-result').hidden=true;$('use-measure').disabled=true;$('capture-angle').disabled=false;error('measure-error','');$('capture-progress').textContent='';updateMeasurementStep();}
function openMeasure(next){
  mode=next;$('angle-mode').value='sensor';$('height-method').value='auto';$('angle-settings').open=false;$('baseline-distance').value='';$('manual-angle').value='';
  $('phone-height').value=stored(lensKey)??'';const saved=Number(stored(offsetKey));offset=Number.isFinite(saved)&&Math.abs(saved)<=10?saved:0;
  sensor=null;samples=[];updateDistanceMode();resetCapture();
  $('measure-title').textContent=isHeight()?'量樹高':mode==='ew'?'量東西向冠幅':'量南北向冠幅';$('camera-placeholder').hidden=false;
  $('measure-dialog').showModal();$('measure-dialog').scrollTop=0;
}
function updateMeasurementStep(){
  const height=isHeight(),manual=manualMode(),labels=stepLabels(),last=lastStep(),visible=(id,show)=>$(id).hidden=!show;
  visible('measurement-prep',step===1);visible('crown-setup',!height&&step===1);
  visible('camera-wrap',!manual&&aiming());visible('enable-sensors',!manual&&aiming()&&!stream?.active);
  visible('calibration-controls',!manual&&step===2);visible('manual-angle-field',manual&&aiming());
  visible('wizard-next',step===1);visible('wizard-back',step>1);visible('capture-angle',aiming());
  visible('use-measure',step===last);visible('restart-measure',step===last);
  visible('capture-progress',step>2&&aiming());visible('measure-result',!!pending&&step===last);
  $('capture-angle').disabled=!!pending;
  const targets=height?['','樹基','樹頂']:['','樹幹基部','第一端樹冠邊緣','第二端樹冠邊緣'];
  $('capture-angle').textContent=aiming()?`記錄${targets[step-1]}`:'記錄';
  $('wizard-back').textContent=step===2?'回準備':`重測${labels[step-2]}`;
  $('manual-angle-label').textContent=kindOf()==='turn'?'水平轉角（°，從樹幹算起，左轉填負值）':'仰俯角（°，往下填負值）';
  const {edges,stand}=axisText();
  const text=height?[
    ['準備','輸入鏡頭離地高度，站到看得見樹基和樹頂的地方，建議離樹 8–12 公尺。'],
    ['瞄準樹基','準星對準樹幹碰到地面的地方，畫面會即時顯示距離；穩住後按「記錄」或點一下畫面。'],
    ['瞄準樹頂','腳不動、手機高度不變，往上對準最高的枝梢，畫面即時顯示樹高。'],
    ['樹高結果','確認後帶入盤查表。換站位複測一次更可靠。']]:[
    ['準備',`站在樹的${stand}方，離樹約 8–12 公尺，看得到樹冠${edges}兩端。`],
    ['瞄準樹幹','準星對準樹幹碰地處，取得距離，並以這個方向當作轉角起點。'],
    ['瞄準第一端','腳不動，只水平轉動手機，對準樹冠一側最外緣（看樹冠邊緣即可，不必找地面投影）。'],
    ['瞄準第二端','再轉向樹幹另一側，對準樹冠最外緣。'],
    ['冠幅結果','確認後帶入盤查表。']];
  $('measurement-step').textContent=`第 ${step}／${last} 步：${text[step-1][0]}。${manual&&aiming()?'手動模式：輸入外部工具的讀值後記錄。':text[step-1][1]}`;
  $('crown-setup').innerHTML=height?'':`<strong>站位示意（俯視，非比例）</strong><p>${mode==='ew'?'西 ◀── 樹冠 ──▶ 東':'北 ◀── 樹冠 ──▶ 南'}</p><p style="text-align:center">▲ 樹幹<br>│ 8–12 m<br>📱 你（站在樹的${stand}方）</p><p>先瞄樹幹，再左右轉向樹冠兩端；全程站在原地、不要走動。</p>`;
  $('height-steps').innerHTML=labels.map((l,i)=>`<span${i+1===step?' class="current" aria-current="step"':''}>${i+1} ${l}</span>`).join('');
  $('calibration-status').textContent=offset?`目前校正值 ${offset.toFixed(1)}°，已套用。`:'未校正：直接使用手機重力感測器的角度。';
}
function goStep(next){step=next;error('measure-error','');updateMeasurementStep();$('measure-dialog').scrollTop=0;}
function tapeDistance(){const d=Number($('baseline-distance').value);if(!Number.isFinite(d)||d<=0||d>100)throw Error('請填入捲尺量得的水平距離，大於 0 且不超過 100 公尺。');return d;}
function baseDistance(angle){
  if(!usingTape())return groundDistance(Number($('phone-height').value),angle);
  if(!(angle<0&&angle>=-75))throw Error('請往下瞄準樹幹碰地處，俯角須小於 0° 且不低於 -75°。');
  return tapeDistance();
}
$('wizard-next').addEventListener('click',()=>{try{
  if(step!==1)return;
  if(usingTape())tapeDistance();
  else {const h=Number($('phone-height').value);if(!Number.isFinite(h)||h<0.5||h>2.5)throw Error('請填入鏡頭離地高度 0.5–2.5 公尺（用捲尺量一次即可，App 會記住）。');store(lensKey,h);}
  captures=[];pending=null;goStep(2);if(!manualMode())startSensors();
}catch(e){error('measure-error',e.message);}});
$('wizard-back').addEventListener('click',()=>{
  if(step<=1)return;samples=[];pending=null;$('use-measure').disabled=true;$('manual-angle').value='';$('measure-result').hidden=true;
  $('capture-progress').textContent='';step-=1;captures=captures.slice(0,Math.max(0,step-2));if(step===1)stopCamera();goStep(step);
});
function updateDistanceMode(){const tape=usingTape();$('baseline-wrap').hidden=!tape;$('phone-height-wrap').hidden=tape;$('phone-height-hint').hidden=tape;}
$('height-method').addEventListener('change',()=>{updateDistanceMode();resetCapture();});
$('angle-mode').addEventListener('change',()=>{if(manualMode())stopCamera();resetCapture();});
document.querySelectorAll('[data-measure]').forEach(el=>el.addEventListener('click',()=>openMeasure(el.dataset.measure)));
$('close-measure').addEventListener('click',()=>$('measure-dialog').close());$('measure-dialog').addEventListener('close',()=>{stopCamera();sensor=null;samples=[];});
$('restart-measure').addEventListener('click',()=>{stopCamera();sensor=null;samples=[];$('manual-angle').value='';resetCapture();$('measure-dialog').scrollTop=0;});
function onOrientation(e,frame){
  if(!$('measure-dialog').open||e.beta==null||e.gamma==null)return;
  const now=performance.now(),dir=e.alpha==null?null:cameraDirection(e.alpha,e.beta,e.gamma);
  if(Number.isFinite(e.webkitCompassHeading)&&(!Number.isFinite(e.webkitCompassAccuracy)||e.webkitCompassAccuracy>=0&&e.webkitCompassAccuracy<=20))absoluteHeading=e.webkitCompassHeading;
  if(frame==='absolute'){if(dir)absoluteHeading=dir.yaw;if(now-relativeSeen<1000)return;}else relativeSeen=now;
  const raw=dir?dir.elevation:elevation(e.beta,e.gamma);
  sensor={raw,angle:raw-offset,yaw:dir?.yaw??null,gamma:e.gamma,frame,time:now};
  samples.push({angle:sensor.angle,raw,yaw:sensor.yaw,frame,time:now});samples=samples.filter(x=>now-x.time<700);
}
const spread=xs=>Math.max(...xs)-Math.min(...xs),mean=xs=>xs.reduce((n,x)=>n+x,0)/xs.length;
function liveText(s){
  try{
    if(step===2)return `距離 ≈ ${baseDistance(s.angle).toFixed(1)} m`;
    if(isHeight()&&step===3){const b=captures[0],r=usingTape()?treeHeightFromDistance(b.distance,b.angle,s.angle):treeHeight(Number($('phone-height').value),b.angle,s.angle);return `樹高 ≈ ${r.height.toFixed(1)} m`;}
    if(!isHeight()&&(step===3||step===4)){if(s.yaw==null||captures[0]?.yaw==null)return '無法讀取轉角';const t=turnDelta(captures[0].yaw,s.yaw);return `${t<0?'左':'右'}轉 ${Math.abs(t).toFixed(0)}° · 離樹幹 ${(captures[0].distance*Math.tan(radians(Math.min(Math.abs(t),89)))).toFixed(1)} m`;}
  }catch{return step===2?'往下對準樹幹碰地處':isHeight()&&step===3?'往上對準樹頂':'';}
  return '';
}
setInterval(()=>{
  if(!$('measure-dialog').open)return;
  if(manualMode()){$('sensor-status').textContent='手動角度模式';$('angle-display').textContent='—°';$('live-readout').textContent='';return;}
  if(!sensor||performance.now()-sensor.time>1500){$('sensor-status').textContent='尚未收到角度資料';$('angle-display').textContent='—°';$('stability-display').textContent='允許權限並直向握持';$('heading-display').textContent='方向 —';$('live-readout').textContent='';return;}
  $('angle-display').textContent=`${sensor.angle>0?'+':''}${sensor.angle.toFixed(1)}°`;$('sensor-status').textContent=offset?`已套用校正 ${offset.toFixed(1)}°`:'重力感測・免校正';
  const recent=samples.filter(s=>s.frame===sensor.frame),steady=recent.length>2&&spread(recent.map(s=>s.angle))<=1.5;
  $('stability-display').textContent=Math.abs(sensor.gamma)>20?'請將手機左右扶正':steady?'穩定，可記錄':'稍等，保持穩定';
  $('heading-display').textContent=absoluteHeading==null?'方位 —':`視線朝${['北','東北','東','東南','南','西南','西','西北'][Math.round(absoluteHeading/45)%8]}（參考）`;
  $('live-readout').textContent=aiming()?liveText(sensor):'';
},200);
async function startSensors(){
  error('measure-error','');if(!window.isSecureContext){error('measure-error','相機與感測器需 HTTPS 安全網址；手機請開啟部署後的 GitHub Pages。');return;}
  try{
    if(typeof DeviceOrientationEvent==='undefined')throw Error('此裝置沒有角度感測器，可改用進階的「手動輸入角度」。');
    if(typeof DeviceOrientationEvent.requestPermission==='function'){const status=await DeviceOrientationEvent.requestPermission();if(status!=='granted')throw Error('未取得動作感測權限，請在瀏覽器設定開啟。');}
    if(!orientationEnabled){window.addEventListener('deviceorientation',e=>onOrientation(e,'relative'));window.addEventListener('deviceorientationabsolute',e=>onOrientation(e,'absolute'));orientationEnabled=true;}
  }catch(e){error('measure-error',e.message);}
  try{stopCamera();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{exact:'environment'}},audio:false});if(!$('measure-dialog').open){stopCamera();return;}$('camera').srcObject=stream;await $('camera').play();$('camera-placeholder').hidden=true;updateMeasurementStep();}
  catch{error('measure-error',`${$('measure-error').textContent} 後置相機未能開啟；請檢查相機權限，再按「啟用相機與感測器」。`.trim());updateMeasurementStep();}
}
$('enable-sensors').addEventListener('click',startSensors);
$('calibrate').addEventListener('click',()=>{try{
  if(!sensor||performance.now()-sensor.time>1500)throw Error('尚未收到手機角度。');
  if(Math.abs(sensor.raw)>12||Math.abs(sensor.gamma)>10)throw Error('請直立握持，準星對準與鏡頭同高的標記再校正。');
  const recent=samples.filter(s=>s.frame===sensor.frame);
  if(recent.length<4||recent.at(-1).time-recent[0].time<500||spread(recent.map(s=>s.raw))>1)throw Error('對準同高標記後穩住一秒，再按校正。');
  offset=mean(recent.map(s=>s.raw));store(offsetKey,offset);captures=[];updateMeasurementStep();toast(`已校正 ${offset.toFixed(1)}°，這支手機之後會沿用。`);
}catch(e){error('measure-error',e.message);}});
$('clear-calibration').addEventListener('click',()=>{offset=0;store(offsetKey,null);updateMeasurementStep();toast('已清除校正，改用原始重力感測角度。');});
function readAngle(kind){
  if(manualMode()){if($('manual-angle').value==='')throw Error('請輸入角度。');const value=Number($('manual-angle').value);if(!Number.isFinite(value))throw Error('角度無效。');return kind==='turn'?{angle:null,yaw:value,frame:'manual'}:{angle:value,yaw:0,frame:'manual'};}
  if(!sensor||performance.now()-sensor.time>1500)throw Error('尚未收到手機角度，請按「啟用相機與感測器」並允許權限。');
  if(!stream?.active)throw Error('請啟用後置相機，用畫面中央準星瞄準。');
  if(Math.abs(window.screen.orientation?.angle??window.orientation??0)%180!==0||window.innerWidth>window.innerHeight)throw Error('量測時請直向握持手機。');
  if(Math.abs(sensor.gamma)>20)throw Error('手機左右傾斜太多，請扶正。');
  const recent=samples.filter(s=>s.frame===sensor.frame);
  if(recent.length<3||recent.at(-1).time-recent[0].time<400)throw Error('請穩住手機約半秒再記錄。');
  const angles=recent.map(s=>s.angle),needYaw=!isHeight();
  if(needYaw&&recent.some(s=>s.yaw==null))throw Error('此手機讀不到水平轉角，冠幅請改用進階的手動模式或捲尺。');
  const yaws=needYaw?recent.map(s=>turnDelta(recent[0].yaw,s.yaw)):[0];
  if(spread(angles)>1.5||spread(yaws)>1.5)throw Error('手機還在晃動，穩住再記錄。');
  return {angle:mean(angles),yaw:needYaw?(recent[0].yaw+mean(yaws)+360)%360:null,frame:sensor.frame};
}
function capture(){error('measure-error','');try{
  const last=lastStep();if(!aiming())throw Error('請依畫面順序操作。');if(pending)return;
  const reading=readAngle(kindOf()),height=isHeight(),index=step-2,phoneHeight=Number($('phone-height').value);
  const method=(manualMode()?'手填工具角度':'手機感測器')+(usingTape()?'／捲尺水平距離':'／鏡頭高度推距離');
  if(index===0){
    const distance=baseDistance(reading.angle);captures=[{...reading,distance}];
    $('capture-progress').textContent=`${height?'樹基':'樹幹'}已記錄：距離 ${distance.toFixed(1)} m。腳不動，${height?'往上瞄準樹頂':'水平轉向樹冠一端'}。`;
  } else if(height){
    const base=captures[0],calc=usingTape()?treeHeightFromDistance(base.distance,base.angle,reading.angle):treeHeight(phoneHeight,base.angle,reading.angle),value=round1(calc.height);
    pending={value,method,phoneHeight:usingTape()?null:phoneHeight,distanceSource:usingTape()?'tape':'phone-height',baseAngle:base.angle,topAngle:reading.angle,distance:calc.distance,heading:manualMode()?null:absoluteHeading,calibrationOffset:manualMode()?null:offset,recordedAt:new Date().toISOString()};
    const shallow=!usingTape()&&Math.abs(base.angle)<8;
    $('measure-result').innerHTML=`<span>樹高估測結果</span><strong>${value.toFixed(1)} m</strong><p>${usingTape()?'捲尺':'手機推算'}距離 ${calc.distance.toFixed(1)} m · 樹基 ${base.angle.toFixed(1)}° · 樹頂 ${reading.angle.toFixed(1)}°</p><p>${shallow?'樹基俯角小於 8°（站太遠），距離誤差會放大，建議走近一點重量。':'建議換一個方向複測；差異超過 10% 或 1 m 應重量。'}</p>`;
  } else {
    if(reading.frame!==captures[0].frame)throw Error('感測器來源改變，請從樹幹重新量測。');
    const turn=manualMode()?reading.yaw:turnDelta(captures[0].yaw,reading.yaw);
    if(Math.abs(turn)<1)throw Error('轉角太小：請水平轉向樹冠邊緣，再記錄。');
    if(Math.abs(turn)>70)throw Error('轉角超過 70°，樹冠太寬或站太近，請退後再量。');
    if(index===2&&Math.sign(turn)===Math.sign(captures[1].turn))throw Error('第二端要在樹幹的另一側，請轉向另一邊再記錄。');
    captures[index]={...reading,turn};
    if(index===1)$('capture-progress').textContent=`第一端已記錄：${turn<0?'左':'右'}轉 ${Math.abs(turn).toFixed(0)}°。現在轉向樹幹另一側，對準樹冠另一端。`;
    else {
      const [trunk,first,second]=captures,calc=crownWidthFromTurns(trunk.distance,first.turn,second.turn),value=round1(calc.width);
      pending={value,method:method+'／站外左右轉角',phoneHeight:usingTape()?null:phoneHeight,distanceSource:usingTape()?'tape':'phone-height',baseAngle:trunk.angle,topAngle:null,distance:calc.distance,firstTurn:first.turn,secondTurn:second.turn,firstOffset:calc.firstOffset,secondOffset:calc.secondOffset,axis:mode,geometry:'station-rotation-perpendicular',heading:manualMode()?null:absoluteHeading,calibrationOffset:manualMode()?null:offset,recordedAt:new Date().toISOString()};
      $('measure-result').innerHTML=`<span>${mode==='ew'?'東西向':'南北向'}冠幅估測結果</span><strong>${value.toFixed(1)} m</strong><p>距樹幹 ${calc.distance.toFixed(1)} m · 兩端轉角 ${Math.abs(first.turn).toFixed(0)}° ＋ ${Math.abs(second.turn).toFixed(0)}° → ${calc.firstOffset.toFixed(1)} m ＋ ${calc.secondOffset.toFixed(1)} m</p><p>假設兩端與樹幹大致在同一條橫線上；樹冠明顯偏斜時，請換方向複測。</p>`;
    }
  }
  $('manual-angle').value='';
  if(pending){$('use-measure').disabled=false;goStep(last);}else goStep(step+1);
}catch(e){error('measure-error',e.message);}}
$('capture-angle').addEventListener('click',capture);
$('camera-panel').addEventListener('click',()=>{if(aiming()&&!pending)capture();});
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
