export const PARAMETERS = Object.freeze({a:0.0673,b:0.976,rootRatio:0.24,carbonFraction:0.47,density:0.6,comparison:0.0509});
export const round1 = n => Math.round((n + Number.EPSILON) * 10) / 10;
export const radians = n => n * Math.PI / 180;
export function elevation(beta,gamma) {
  return Math.asin(Math.max(-1,Math.min(1,-Math.cos(radians(beta))*Math.cos(radians(gamma))))) * 180 / Math.PI;
}
export function groundDistance(phoneHeight,angle) {
  if (!(phoneHeight>=0.5 && phoneHeight<=2.5)) throw Error('手機離地高度須介於 0.5–2.5 公尺。');
  if (!(angle<=-5 && angle>=-75)) throw Error('請調整站位：瞄準地面的俯角須介於 5°–75°。');
  return phoneHeight/Math.tan(radians(-angle));
}
export function treeHeight(phoneHeight,baseAngle,topAngle) {
  const distance=groundDistance(phoneHeight,baseAngle);
  if (!(topAngle>0 && topAngle<=60)) throw Error('樹頂仰角須大於 0° 且不超過 60°，請退後再量。');
  return {distance,height:distance*(Math.tan(radians(topAngle))-Math.tan(radians(baseAngle)))};
}
export function calculate(record,species) {
  if (!Number.isFinite(Number(record.circumferences[0])) || !(Number(record.circumferences[0])>0)) throw Error('請填寫第一根樹幹周長。');
  const cs=record.circumferences.filter(v=>v!==null && v!=='' && v!==undefined).map(Number);
  if (!cs.length || cs.some(c=>!Number.isFinite(c)||c<=0)) throw Error('請填寫大於零的樹幹周長。');
  if (!Number.isFinite(Number(record.height)) || !(Number(record.height)>0)) throw Error('請完成樹高量測。');
  const dbh=round1(Math.sqrt(cs.reduce((sum,c)=>sum+(c/Math.PI)**2,0)));
  const excluded=['棕櫚','竹類'].includes(species.type);
  if (dbh<5 && !excluded) throw Error('等效胸徑未達 5 公分，不符合本課程碳盤查納入門檻。');
  const density=species.density ?? PARAMETERS.density;
  if(excluded) return {dbh,density,excluded:true,densitySource:species.density==null?'預設密度':'對照表密度'};
  const agb=round1(PARAMETERS.a*(density*dbh**2*Number(record.height))**PARAMETERS.b);
  const biomass=round1(agb*(1+PARAMETERS.rootRatio));
  const carbon=round1(biomass*PARAMETERS.carbonFraction);
  const co2=round1(carbon*44/12);
  const comparison=round1(PARAMETERS.comparison*density*dbh**2*Number(record.height));
  return {dbh,density,agb,biomass,carbon,co2,comparison,difference:(comparison-agb)/agb,excluded:false,densitySource:species.density==null?'預設密度':'對照表密度'};
}
export function validateRecord(r,catalog,records=[]) {
  const species=catalog.species.find(s=>s.name===r.species);
  if(!species) throw Error('請從校園樹種清單選擇樹種。');
  if(!catalog.zones.some(z=>z.code===r.zone)) throw Error('請選擇責任區。');
  if(!r.recorder.trim() || !/^\d{4,}$/.test(r.studentId)) throw Error('請填寫姓名及至少四碼的數字學號。');
  if(!Number.isInteger(r.sequence)||r.sequence<1||r.sequence>99) throw Error('樹木序號須為 1–99。');
  if(records.some(x=>x.id===r.id)) throw Error('此樹木編號已存在，請更換序號。');
  if(!r.date) throw Error('請填寫調查日期。');
  if(!r.gps || !Number.isFinite(r.gps.lat)||!Number.isFinite(r.gps.lon)||Math.abs(r.gps.lat)>90||Math.abs(r.gps.lon)>180) throw Error('請先取得樹旁 GPS 座標。');
  if(!(r.crownEW>0 && r.crownNS>0)) throw Error('請完成東西向及南北向冠幅。');
  return calculate(r,species);
}
