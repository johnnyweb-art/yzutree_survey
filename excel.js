// Dependency-free OOXML export. ZIP entries are stored, not compressed.
// Formulas come from the supplied course workbook; user text is always inlineStr.
import {calculate} from './core.js';
const encoder=new TextEncoder();
const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function column(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function buffer(size){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};}
export function zip(files){
  const parts=[],central=[];let offset=0;
  for(const [path,text] of Object.entries(files)){
    const name=encoder.encode(path),data=encoder.encode(text),crc=crc32(data),h=buffer(30+name.length);
    h.view.setUint32(0,0x04034b50,true);h.view.setUint16(4,20,true);h.view.setUint16(6,0x800,true);h.view.setUint16(12,0x21,true);
    h.view.setUint32(14,crc,true);h.view.setUint32(18,data.length,true);h.view.setUint32(22,data.length,true);h.view.setUint16(26,name.length,true);h.bytes.set(name,30);
    parts.push(h.bytes,data);
    const c=buffer(46+name.length);c.view.setUint32(0,0x02014b50,true);c.view.setUint16(4,20,true);c.view.setUint16(6,20,true);c.view.setUint16(8,0x800,true);c.view.setUint16(14,0x21,true);c.view.setUint32(16,crc,true);c.view.setUint32(20,data.length,true);c.view.setUint32(24,data.length,true);c.view.setUint16(28,name.length,true);c.view.setUint32(42,offset,true);c.bytes.set(name,46);central.push(c.bytes);offset+=h.bytes.length+data.length;
  }
  const size=central.reduce((n,a)=>n+a.length,0),end=buffer(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,central.length,true);end.view.setUint16(10,central.length,true);end.view.setUint32(12,size,true);end.view.setUint32(16,offset,true);
  const all=[...parts,...central,end.bytes],result=new Uint8Array(offset+size+22);let pos=0;for(const a of all){result.set(a,pos);pos+=a.length;}return result;
}
const formula=(value,cache)=>({formula:value.slice(1),cache});
function asTemplate(rows){return rows.map(r=>r.map(v=>typeof v==='string'&&v.startsWith('=')?formula(v):v));}
function sheetXml(rows,main=false){
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${main?5:2}" topLeftCell="A${main?6:3}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="${Math.max(2,...rows.map(r=>r.length))}" width="21" customWidth="1"/></cols><sheetData>${rows.map((row,i)=>`<row r="${i+1}"${i===0?' ht="34" customHeight="1"':''}>${row.map((v,j)=>{
    if(v===null||v===undefined||v==='')return '';
    const ref=column(j)+(i+1),style=i<2?1:main&&j>=18?3:main?2:0;
    if(typeof v==='object'&&'formula' in v){const cached=v.cache;return `<c r="${ref}" s="${style}"${typeof cached==='string'?' t="str"':''}><f>${xml(v.formula)}</f>${cached!==undefined?`<v>${xml(cached)}</v>`:''}</c>`;}
    return typeof v==='number'?`<c r="${ref}" s="${style}"><v>${v}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('')}</row>`).join('')}</sheetData>${main?`<autoFilter ref="A2:AE${rows.length}"/>`:''}</worksheet>`;
}
function notes(r){return [r.notes,'手機原型；樹高／冠幅為估測；平地幾何法',r.gps?.accuracy!=null?`GPS 精度約 ${r.gps.accuracy.toFixed(1)} m`:'手填座標',r.photoCount<4?'照片不足4張，待補':null].filter(Boolean).join('；');}
export function buildWorkbook(records,template,catalog){
  const sheets=Object.fromEntries(Object.entries(template).map(([name,rows])=>[name,asTemplate(rows)]));
  const main=sheets['填寫表'];main.splice(5);
  const lastRow=Math.max(405,records.length+5),base=template['填寫表'][5];
  for(let index=0;index<lastRow-5;index++){
    const r=records[index],rowNumber=index+6,row=Array(31).fill(null);let result;
    if(r){
      row.splice(0,18,r.id,r.species,r.circumferences[0],r.circumferences[1]??null,r.circumferences[2]??null,r.height,'估計',r.crownEW,r.crownNS,r.gps.lat,r.gps.lon,r.health,r.photoCount,r.inat||null,r.identification,`${r.recorder} ${r.studentId}`,r.date,notes(r));
      result=calculate(r,catalog.species.find(s=>s.name===r.species));
    }
    for(let col=18;col<31;col++){
      const f=base[col].replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g,(all,c,absolute,n)=>Number(n)===6&&!absolute?c+rowNumber:Number(n)===405?c+absolute+lastRow:all);
      let cache;
      if(r){const s=catalog.species.find(s=>s.name===r.species);const c=result;
        cache=[s.scientific,s.type,c.density,c.dbh,c.excluded?'不適用':c.agb,c.biomass??'',c.carbon??'',c.co2??'',c.comparison??'',c.difference??'',r.photoCount<4?'✗照片不足4張':c.excluded?`△${s.type==='棕櫚'?'棕櫚科':'竹類'}不計碳`:'△樹高為估計值',r.zone,c.densitySource==='預設密度'?'預設密度':'實測密度'][col-18];
      }else cache='';
      row[col]=formula(f,cache);
    }main.push(row);
  }
  // Keep source formulas, including their rounding order and example exclusion.
  for(const rows of Object.values(sheets))for(const row of rows)for(const v of row)if(v&&typeof v==='object'&&v.formula)v.formula=v.formula.replace(/\$405\b/g,'$'+lastRow);
  sheets['量測原始紀錄']=[['手機量測原始紀錄｜0.1｜未經現場精度驗證'],['編號','儲存時間','GPS精度 m','樹高方法','鏡頭高 m','樹基角 °','樹頂角 °','水平距離 m','東西冠幅方法','東西鏡頭高 m','東西俯角 °','南北冠幅方法','南北鏡頭高 m','南北俯角 °','高度量測JSON','東西量測JSON','南北量測JSON'],...records.map(r=>{const h=r.measurements.height,e=r.measurements.ew,n=r.measurements.ns;return [r.id,r.savedAt,r.gps.accuracy,h.method,h.phoneHeight,h.baseAngle,h.topAngle,h.distance,e.method,e.phoneHeight,e.baseAngle,n.method,n.phoneHeight,n.baseAngle,JSON.stringify(h),JSON.stringify(e),JSON.stringify(n)];})];
  const names=Object.keys(sheets),files={};
  files['[Content_Types].xml']=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  files['_rels/.rels']='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  files['xl/workbook.xml']=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name,i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1" calcMode="auto"/></workbook>`;
  files['xl/_rels/workbook.xml.rels']=`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${names.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files['xl/styles.xml']='<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft JhengHei"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123E32"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF8D9"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F3F1"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  names.forEach((name,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=sheetXml(sheets[name],name==='填寫表'));
  return zip(files);
}
