# Windows build: python -m pip install Pillow
# From project root: python -m pip install --target .video-tools imageio-ffmpeg
# Then: python tools/make_tutorial.py (Microsoft JhengHei font required)
from pathlib import Path
import sys, math, subprocess, wave, json, bisect
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.video-tools'))
import imageio_ffmpeg
OUT=ROOT/'media'
DURATIONS=[12]*15
STARTS=[12*i for i in range(15)]
TOTAL=180
SCENES=[
('跟著 App，完成一棵樹',['填資料 → 量樹高、冠幅','到樹旁定位 → 儲存匯出'],'0.5 版：免水平校正，距離由手機推算；介面為示意，精度仍需實測。'),
('先分清楚：定位不等於量高度',['GPS：這棵樹在哪裡？','樹高：瞄準樹基與樹頂。'],'取 GPS 要站在樹旁；量樹高要退開，讓整棵樹看得見。'),
('出發前，準備這三樣',['手機＋一條捲尺＋一位同伴','捲尺只量鏡頭高度與周長。'],'用 Safari 或 Chrome 開 HTTPS 網址；依提示允許相機、動作及定位。'),
('先填基本資料，避免認錯樹',['選責任區、樹種，填姓名學號','確認第幾株，記住樹木編號。'],'樹木編號把尺寸、座標及照片連在一起；照片請另存並對應編號。'),
('量樹高：站在 8–12 公尺',['平地上，看得見樹基與樹頂','兩腳站定，記住這個站位。'],'站太遠時角度誤差會放大；傾斜樹、斜坡或看不清頂端時不適用。'),
('鏡頭高度量一次就好',['請同伴量地面到後置鏡頭','輸入公尺，App 會記住。'],'例如量得 150 cm 就填 1.50 m；換人拿手機時要重量。'),
('距離由手機推算',['距離 = 鏡頭高度 ÷ tan(俯角)','不用再拉長捲尺量距離。'],'有夠長的捲尺時，也可在「進階」改填實量水平距離。'),
('免校正：按開始量測就好',['允許相機與動作感測','準星下方即時顯示數字。'],'直接使用重力感測器；顯示「穩定，可記錄」時再按記錄。'),
('第一下：瞄樹幹碰地面的地方',['向下轉動手機，準星對樹基','畫面即時顯示距離。'],'按「記錄樹基」或點一下畫面；不要瞄樹根突起或前方草地。'),
('第二下：原地轉動，瞄最高枝梢',['腳不移動，手機不抬高','畫面即時顯示樹高。'],'按「記錄樹頂」；換站位就從樹基重新量。'),
('遇到提示，照著調整',['晃動：扶正手機，停一下','俯角太小：走近一點。'],'仰角超過 60° 請退後；比對後有固定偏差，才用選用校正。'),
('先帶入，再換方向複測',['看估測結果，按「帶入紀錄」','記下第一次，換方向再量一次。'],'兩次差異超過 10% 或 1 m 應重量；重測帶入會取代前一次樹高。'),
('冠幅：站定後左右轉',['東西向站在樹的正南或正北','先瞄樹幹，再轉向兩端。'],'冠幅＝距離 ×（tan 左轉角＋tan 右轉角）的估算；周長在離地 1.3 m 處量。'),
('GPS：走回樹幹旁，站定 20 秒',['勾選「我現在站在樹幹旁」','按「樹旁定位（20 秒）」。'],'回報精度 > 15 m 建議重取、補地標；不要走遠去取另一處座標。'),
('最後儲存、備份，量錯可刪除',['按「儲存這棵樹並計算」','到「盤查紀錄」匯出 Excel。'],'量錯按「刪除」兩次即刪除，可按「復原」；另存 JSON 備份。')]
KINDS=[0,9,10,11,1,2,12,3,4,5,13,6,7,14,8]
BUTTONS=['現場盤查','樹旁定位 ≠ 樹高量測','先看準備步驟與影片','量樹高','量樹高','鏡頭離地高度（m）','距離 約 10.0 m','開始量測','記錄樹基','記錄樹頂','穩定，可記錄','帶入紀錄','量冠幅','樹旁定位（20 秒）','儲存這棵樹並計算']

F={s:ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',s) for s in [18,20,22,24,26,28,36,42]}
GREEN='#164c3c';GOLD='#c8882e'
def txt(d,xy,t,size=26,color=GREEN):d.text(xy,t,font=F[size],fill=color)
def dash(d,a,b,color=GOLD):
 dx,dy=b[0]-a[0],b[1]-a[1];dist=math.hypot(dx,dy)
 for k in range(0,int(dist),16):
  e=min(k+9,dist);d.line((a[0]+dx*k/dist,a[1]+dy*k/dist,a[0]+dx*e/dist,a[1]+dy*e/dist),fill=color,width=3)
def frame(t):
 j=min(bisect.bisect_right(STARTS,t)-1,14);i=KINDS[j];p=(t-STARTS[j])/DURATIONS[j];title,lines,caption=SCENES[j]
 im=Image.new('RGB',(1280,720),'#f5f3eb');d=ImageDraw.Draw(im)
 txt(d,(46,24),'木測 / 元智校園樹木盤查',22);txt(d,(940,28),'操作動畫・介面示意・v0.5',20)
 d.line((46,68,1234,68),fill='#d8ded3',width=2);txt(d,(46,88),title,42)
 d.rounded_rectangle((46,164,814,562),radius=24,fill='#e7eddf')
 base=(675,510);top=(675,207);lens=(255,441)
 d.line((82,510,790,510),fill='#9cad8c',width=3);d.rectangle((661,282,689,510),fill='#8a6a4d')
 for x,y,r in [(638,284,58),(701,275,58),(669,236,42)]:d.ellipse((x-r,y-r,x+r,y+r),fill='#71956b')
 d.ellipse((186,394,218,426),fill=GOLD);d.line((202,429,205,474),fill=GREEN,width=9)
 d.line((204,471,186,508),fill=GREEN,width=7);d.line((204,471,224,508),fill=GREEN,width=7)
 d.line((205,439,228,451,249,441),fill=GREEN,width=6)
 aim=0 if i<4 else (math.atan2(69,420) if i==4 else -math.atan2(234,420))
 if i==5:aim=math.atan2(69,420)+(-math.atan2(234,420)-math.atan2(69,420))*min(p*2,1)
 vx,vy=-math.sin(aim),math.cos(aim)
 d.line((255-vx*13,441-vy*13,255+vx*20,441+vy*20),fill=GREEN,width=10);d.ellipse((251,437,259,445),fill='white')
 if i<7 and i!=3:
  dash(d,lens,(762,441),'#a7b8a0')
  if i in [0,1,6]:dash(d,lens,base);dash(d,lens,top)
  if i in [4,5]:
   target=base if i==4 else (675,441+420*math.tan(aim));d.line((*lens,*target),fill=GOLD,width=4)
   x,y=target;d.line((x-14,y,x+14,y),fill='#b85734',width=3);d.line((x,y-14,x,y+14),fill='#b85734',width=3)
   label='距離 約 10.0 m' if i==4 else '樹高 約 12.0 m'
   d.rounded_rectangle((372,(452 if i==4 else 214),600,(492 if i==4 else 254)),radius=20,fill=GREEN);txt(d,(390,(456 if i==4 else 218)),label,24,'#dcf273')
  if i==2:
   d.line((282,441,282,510),fill=GOLD,width=4);d.line((274,441,290,441),fill=GOLD,width=3);d.line((274,510,290,510),fill=GOLD,width=3);txt(d,(306,469),'實際鏡頭高度',24)
  txt(d,(85,184),'側面示意・非比例圖',20);txt(d,(122,523),'站位固定',20);txt(d,(627,523),'樹基地面',20)
 elif i==3:
  d.rounded_rectangle((76,186,790,543),radius=18,fill='#e7eddf');txt(d,(91,200),'量測畫面示意',20)
  d.rounded_rectangle((300,196,566,536),radius=26,fill='#132921')
  d.rectangle((314,226,552,398),fill='#7aa0c8');d.rectangle((314,398,552,506),fill='#9cad8c')
  d.ellipse((380,236,488,350),fill='#71956b');d.rectangle((426,320,442,420),fill='#8a6a4d')
  cx,cy=434,418;d.ellipse((cx-14,cy-14,cx+14,cy+14),outline='#dcf273',width=2);d.line((cx-22,cy,cx+22,cy),fill='#dcf273',width=2);d.line((cx,cy-22,cx,cy+22),fill='#dcf273',width=2)
  d.rounded_rectangle((344,444,524,476),radius=16,fill='#000000');txt(d,(358,446),'距離 約 10.0 m',20,'#dcf273')
  txt(d,(322,232),'重力感測・免校正',18,'white');txt(d,(322,484),'-8.5°',22,'#dcf273');txt(d,(440,486),'穩定，可記錄',18,'white')
  txt(d,(590,300),'① 開始量測',24);txt(d,(590,350),'② 允許權限',24);txt(d,(590,400),'③ 對準、穩住',24);txt(d,(590,450),'④ 記錄',24)
 elif i==7:
  d.rounded_rectangle((76,186,790,543),radius=18,fill='#e7eddf');txt(d,(91,200),'俯視示意・非比例',20)
  cx,cy,r=438,300,96;d.ellipse((cx-r,cy-r,cx+r,cy+r),fill='#71956b');d.ellipse((cx-9,cy-9,cx+9,cy+9),fill='#8a6a4d')
  st=(438,500);d.ellipse((st[0]-11,st[1]-11,st[0]+11,st[1]+11),fill=GOLD)
  d.line((*st,cx,cy),fill=GOLD,width=4);dash(d,st,(cx-r,cy),GREEN);dash(d,st,(cx+r,cy),GREEN)
  d.line((cx-r,cy-112,cx+r,cy-112),fill=GREEN,width=3)
  for x in [cx-r,cx+r]:d.line((x,cy-122,x,cy-102),fill=GREEN,width=3)
  txt(d,(cx-24,cy-150),'冠幅',22);txt(d,(cx+8,410),'距離 D',22);txt(d,(368,452),'θ1',22);txt(d,(480,452),'θ2',22)
  for xy,label in [((112,288),'西'),((736,288),'東'),((700,206),'北 ↑')]:txt(d,xy,label)
  txt(d,(470,492),'你（站在正南方）',22)
 elif i==8:
  d.rounded_rectangle((76,186,790,543),radius=18,fill='#e7eddf');txt(d,(117,218),'一棵樹 → 一筆紀錄',36)
  for y,label in [(294,'① 儲存這棵樹並計算'),(364,'② 盤查紀錄 → 匯出 Excel'),(434,'③ 備份原始紀錄 JSON')]:
   d.rounded_rectangle((110,y-8,741,y+48),radius=12,fill='white');txt(d,(130,y),label,28)
 else:
  d.rounded_rectangle((76,180,792,543),radius=18,fill='#e7eddf')
  if i in [9,14]:
   txt(d,(102,208),'兩個不同的站位',36)
   d.ellipse((578,284,674,380),fill='#71956b');d.rectangle((619,358,633,435),fill='#8a6a4d')
   d.line((130,436,741,436),fill='#9cad8c',width=3)
   for x,label in [(216,'量樹高'),(590,'取 GPS')]:
    d.ellipse((x-10,388,x+10,408),fill=GOLD);d.line((x,409,x,434),fill=GREEN,width=5);txt(d,(x-42,458),label,24)
   dash(d,(232,410),(626,286));txt(d,(285,491),'GPS 不會提供樹高',28)
  elif i==12:
   txt(d,(102,200),'手機推算的水平距離',36)
   eye=(160,300);foot=(160,440);tree=(700,440)
   d.line((120,440,750,440),fill='#9cad8c',width=3);d.line((*eye,*foot),fill=GREEN,width=4);d.line((*foot,*tree),fill=GOLD,width=5)
   d.line((*eye,*tree),fill='#b85734',width=3);d.line((*eye,560,300),fill='#a7b8a0',width=2)
   d.ellipse((eye[0]-7,eye[1]-7,eye[0]+7,eye[1]+7),fill=GREEN);d.rectangle((692,330,708,440),fill='#8a6a4d')
   txt(d,(124,356),'h',28);txt(d,(250,302),'β（俯角）',22);txt(d,(380,450),'D = h ÷ tan β',28)
   txt(d,(104,492),'h＝1.5 m、β＝8.5° → D 約 10 m',26)
  else:
   cards={10:['① 充好電，開啟定位服務','② 一條捲尺：量鏡頭高與周長','③ 先用已知高度練習一次'],11:['責任區、樹種','姓名、學號、你的第幾株','樹木編號 → 照片也用同一編號'],13:['晃動 → 扶正手機，停一下再記錄','俯角太小（站太遠）→ 走近一點','仰角超過 60° → 退後再測']}[i]
   txt(d,(108,206),'看提示調整' if i==13 else '先確認，再繼續',36)
   for y,label in zip([293,371,449],cards):
    d.rounded_rectangle((101,y-10,758,y+48),radius=12,fill='white');txt(d,(119,y),label,26)
 d.rounded_rectangle((842,164,1234,562),radius=24,fill=GREEN);txt(d,(868,189),f'{j+1:02d} / 15',22,'#cbd9be')
 yy=244
 for line in lines:
  chunk=''
  for c in line:
   if d.textlength(chunk+c,font=F[26])>335:txt(d,(868,yy),chunk,26,'white');yy+=39;chunk=''
   chunk+=c
  txt(d,(868,yy),chunk,26,'white');yy+=58
 d.rounded_rectangle((859,476,1217,544),radius=12,fill='#dcefad');txt(d,(875,495),BUTTONS[j],22,GREEN)
 txt(d,(46,590),caption,24)
 d.rounded_rectangle((46,651,1234,659),radius=4,fill='#d6ded1');d.rounded_rectangle((46,651,46+max(8,1188*t/TOTAL),659),radius=4,fill=GREEN)
 txt(d,(46,677),'鏡頭高度固定 / 原地轉動 / 先樹基，後樹頂',20);txt(d,(1083,677),f'{int(t)//60:02d}:{int(t)%60:02d} / {int(TOTAL)//60:02d}:{int(TOTAL)%60:02d}',18)
 return im
if __name__=='__main__':
 OUT.mkdir(exist_ok=True)
 clips=sorted((ROOT/'.test-output/narration').glob('*.wav'))
 audio_args=['-an']
 narration=json.loads((OUT/'narration.json').read_text(encoding='utf-8')) if (OUT/'narration.json').exists() else []
 if len(clips)==15:
  audio=[];DURATIONS=[]
  for clip in clips:
   with wave.open(str(clip),'rb') as w:
    if w.getparams()[:3]!=(1,2,22050):raise ValueError('Expected mono 16-bit 22050 Hz WAV')
    n=w.getnframes();raw=w.readframes(n)
    if n==0:raise ValueError('Narration clip is empty')
    length=max(12,math.ceil(n/22050+1.6));DURATIONS.append(length)
    audio.append(b'\0'*int(.6*22050)*2+raw+b'\0'*(length*22050-n-int(.6*22050))*2)
  STARTS=[];TOTAL=0
  for length in DURATIONS:STARTS.append(TOTAL);TOTAL+=length
  wavpath=ROOT/'.test-output/tutorial-narration.wav'
  with wave.open(str(wavpath),'wb') as w:w.setparams((1,2,22050,0,'NONE','not compressed'));w.writeframes(b''.join(audio))
  audio_args=['-i',str(wavpath),'-c:a','aac','-b:a','48k']
 frame(0).save(OUT/'tree-height-poster.jpg',quality=90)
 cmd=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','12','-i','-']+audio_args+['-c:v','libx264','-preset','fast','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'tree-height-tutorial.mp4')]
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
 for n in range(TOTAL*12):proc.stdin.write(frame(n/12).tobytes())
 proc.stdin.close()
 if proc.wait():raise RuntimeError('Encoding failed')
 (OUT/'tutorial-script.txt').write_text('繁體中文合成旁白｜動畫與介面示意，非實機錄影\n\n'+'\n\n'.join(f'{STARTS[i]}–{STARTS[i]+DURATIONS[i]} 秒｜{scene[0]}\n'+(narration[i] if narration else '\n'.join(scene[1])+'\n'+scene[2]) for i,scene in enumerate(SCENES)),encoding='utf-8')
 (OUT/'tutorial-timing.json').write_text(json.dumps({'seconds':TOTAL,'starts':STARTS,'durations':DURATIONS}),encoding='utf-8')
 sheet=Image.new('RGB',(960,900),'white')
 for i in range(15):sheet.paste(frame(STARTS[i]+DURATIONS[i]*.7).resize((320,180)),((i%3)*320,(i//3)*180))
 (ROOT/'.test-output').mkdir(exist_ok=True)
 sheet.save(ROOT/'.test-output/tutorial-storyboard.jpg')
 print('Duration:',TOTAL,'MP4 bytes:',(OUT/'tree-height-tutorial.mp4').stat().st_size)
