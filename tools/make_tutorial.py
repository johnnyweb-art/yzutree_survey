# Windows build: python -m pip install Pillow
# From project root: python -m pip install --target .video-tools imageio-ffmpeg
# Then: python tools/make_tutorial.py (Microsoft JhengHei font required)
from pathlib import Path
import sys, math, subprocess
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.video-tools'))
import imageio_ffmpeg
OUT=ROOT/'media'
# Each scene lasts 12 seconds. Button labels match app v0.2; UI cards are illustrations.
SCENES=[
('跟著 App，完成一棵樹',['先填資料 → 量尺寸','到樹旁定位 → 儲存匯出'],'本片為字幕操作動畫，介面為示意；手機量測精度仍需實測。'),
('先分清楚：定位不等於量高度',['GPS：這棵樹在哪裡？','樹高：瞄準樹基與樹頂。'],'取 GPS 要站在樹旁；量樹高要退開，讓整棵樹看得見。'),
('出發前，準備這三樣',['手機＋捲尺＋一位同伴','開啟手機定位，用瀏覽器開 App。'],'用 Safari 或 Chrome 開 HTTPS 網址；依提示允許相機、動作及定位。'),
('先填基本資料，避免認錯樹',['選責任區、樹種，填姓名學號','確認第幾株，記住樹木編號。'],'樹木編號把尺寸、座標及照片連在一起；照片請另存並對應編號。'),
('量樹高：先站好，再拿手機',['在平地退開，看見樹基與樹頂','兩腳站定，記住這個站位。'],'站位與樹基地面等高；傾斜樹、斜坡或看不清頂端時不適用。'),
('量的是鏡頭高度，不是身高',['請同伴量地面到後置鏡頭','輸入實際數字，單位是公尺。'],'例如量得 150 cm 就填 1.50 m；不能直接沿用別人的數字。'),
('想減少推距離誤差？可用捲尺',['選「捲尺實量水平距離」','量鏡頭正下方到樹基的距離。'],'平地示意：10 m 要填 10；不是斜距，也不能拿 GPS 距離代替。'),
('啟用後置相機，再水平校正',['按「啟用相機與感測器」','準星對同高標記，穩定後校正。'],'直向握持；請同伴指出與鏡頭同高的點，不要把手機平放歸零。'),
('第一下：瞄樹幹碰地面的地方',['向下轉動手機，準星對樹基','確認準備事項，等角度穩定。'],'按「記錄樹基角度」；不要瞄樹根突起、前方草地或樹幹中段。'),
('第二下：原地轉動，瞄最高枝梢',['腳不移動，鏡頭也不抬高','轉動手機向上，等角度穩定。'],'按「記錄樹頂角度」；若換站位或改鏡頭高度，兩個角度都要重測。'),
('遇到提示，不要硬按下一步',['角度不穩：扶正手機再等一下','俯角太小：改用捲尺距離。'],'頂角超過 60° 時退後再測；換站位後，實量距離也要重量。'),
('先帶入，再換方向複測',['看估測結果，按「帶入紀錄」','記下第一次，換方向再量一次。'],'兩次差異超過 10% 或 1 m 應重量；重測帶入會取代前一次樹高。'),
('冠幅與周長：量對地方',['找東西、南北兩端的地面投影','鏡頭在一端上方，瞄另一端地面。'],'冠幅不是樹影；先量鏡頭高度。周長用捲尺在離地 1.3 m 處量。'),
('GPS：走回樹幹旁，站定 20 秒',['勾選「我現在站在樹幹旁」','按「樹旁定位（20 秒）」。'],'回報精度 > 15 m 建議重取、補地標；不要走遠去取另一處座標。'),
('最後一定要儲存與備份',['按「儲存這棵樹並計算」','到「盤查紀錄」匯出 Excel。'],'另存 JSON 備份；資料只在目前瀏覽器，沒有全班雲端同步。')]
KINDS=[0,9,10,11,1,2,12,3,4,5,13,6,7,14,8]
BUTTONS=['現場盤查','樹旁定位 ≠ 樹高量測','先看準備步驟與影片','量樹高','量樹高','鏡頭離地高度（m）','樹高的距離來源','水平校正','記錄樹基角度','記錄樹頂角度','重新量測','帶入紀錄','量冠幅','樹旁定位（20 秒）','儲存這棵樹並計算']

F={s:ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',s) for s in [18,20,22,24,26,28,36,42]}
GREEN='#164c3c';GOLD='#c8882e'
def txt(d,xy,t,size=26,color=GREEN):d.text(xy,t,font=F[size],fill=color)
def dash(d,a,b,color=GOLD):
 dx,dy=b[0]-a[0],b[1]-a[1];dist=math.hypot(dx,dy)
 for k in range(0,int(dist),16):
  e=min(k+9,dist);d.line((a[0]+dx*k/dist,a[1]+dy*k/dist,a[0]+dx*e/dist,a[1]+dy*e/dist),fill=color,width=3)
def frame(t):
 j=min(int(t//12),14);i=KINDS[j];p=(t%12)/12;title,lines,caption=SCENES[j]
 im=Image.new('RGB',(1280,720),'#f5f3eb');d=ImageDraw.Draw(im)
 txt(d,(46,24),'木測 / 元智校園樹木盤查',22);txt(d,(940,28),'操作動畫・介面示意・v0.2',20)
 d.line((46,68,1234,68),fill='#d8ded3',width=2);txt(d,(46,88),title,42)
 d.rounded_rectangle((46,164,814,562),radius=24,fill='#e7eddf')
 base=(675,510);top=(675,207);lens=(255,441)
 d.line((72,510,790,510),fill='#9cad8c',width=3);d.rectangle((661,282,689,510),fill='#8a6a4d')
 for x,y,r in [(638,284,58),(701,275,58),(669,236,42)]:d.ellipse((x-r,y-r,x+r,y+r),fill='#71956b')
 d.ellipse((186,394,218,426),fill=GOLD);d.line((202,429,205,474),fill=GREEN,width=9)
 d.line((204,471,186,508),fill=GREEN,width=7);d.line((204,471,224,508),fill=GREEN,width=7)
 d.line((205,439,228,451,249,441),fill=GREEN,width=6)
 aim=0 if i<4 else (math.atan2(69,420) if i==4 else -math.atan2(234,420))
 if i==5:aim=math.atan2(69,420)+(-math.atan2(234,420)-math.atan2(69,420))*min(p*2,1)
 vx,vy=-math.sin(aim),math.cos(aim)
 d.line((255-vx*13,441-vy*13,255+vx*20,441+vy*20),fill=GREEN,width=10);d.ellipse((251,437,259,445),fill='white')
 if i<7:
  dash(d,lens,(762,441),'#a7b8a0')
  if i in [0,1,6]:dash(d,lens,base);dash(d,lens,top)
  if i==3:
   d.line((*lens,675,441),fill=GOLD,width=4);d.ellipse((667,433,683,449),outline=GREEN,width=3);txt(d,(326,400),'同高標記 → 水平校正',24)
  if i in [4,5]:
   target=base if i==4 else (675,441+420*math.tan(aim));d.line((*lens,*target),fill=GOLD,width=4)
   x,y=target;d.line((x-14,y,x+14,y),fill='#b85734',width=3);d.line((x,y-14,x,y+14),fill='#b85734',width=3)
  if i==2:
   d.line((282,441,282,510),fill=GOLD,width=4);d.line((274,441,290,441),fill=GOLD,width=3);d.line((274,510,290,510),fill=GOLD,width=3);txt(d,(306,469),'實際鏡頭高度',24)
  txt(d,(85,184),'側面示意・非比例圖',20);txt(d,(122,523),'站位固定',20);txt(d,(627,523),'樹基地面',20)
 elif i==7:
  d.rounded_rectangle((76,186,790,543),radius=18,fill='#e7eddf');d.ellipse((302,214,575,447),fill='#71956b')
  d.line((302,332,575,332),fill=GOLD,width=4);d.line((438,214,438,447),fill=GOLD,width=4)
  for xy,label in [((156,312),'西'),((689,312),'東'),((427,170),'北'),((427,476),'南')]:txt(d,xy,label)
  txt(d,(91,200),'俯視示意',20);txt(d,(326,366),'垂直地面投影',24,'white')
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
   txt(d,(102,210),'平地上的「水平距離」',36)
   d.line((145,363,721,363),fill=GOLD,width=5)
   for x in [145,721]:d.line((x,350,x,376),fill=GREEN,width=4)
   txt(d,(108,393),'鏡頭正下方',24);txt(d,(658,393),'樹基',24);txt(d,(350,300),'例如 10.00 m',28)
   txt(d,(104,469),'換站位 → 重新量距離',28)
  else:
   cards={10:['① 充好電，開啟定位服務','② 準備捲尺，兩人互相協助','③ 先用已知高度練習一次'],11:['責任區、樹種','姓名、學號、你的第幾株','樹木編號 → 照片也用同一編號'],13:['不要抬高手機去追樹頂','不要走動後只補量樹頂角','不要把 GPS 精度當成量尺']}[i]
   txt(d,(108,206),'先確認，再繼續',36)
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
 d.rounded_rectangle((46,651,1234,659),radius=4,fill='#d6ded1');d.rounded_rectangle((46,651,46+max(8,1188*t/180),659),radius=4,fill=GREEN)
 txt(d,(46,677),'鏡頭高度固定 / 原地轉動 / 先樹基，後樹頂',20);txt(d,(1083,677),f'{int(t)//60:02d}:{int(t)%60:02d} / 03:00',18)
 return im
if __name__=='__main__':
 OUT.mkdir(exist_ok=True);frame(0).save(OUT/'tree-height-poster.jpg',quality=90)
 cmd=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','12','-i','-','-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'tree-height-tutorial.mp4')]
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
 for n in range(2160):proc.stdin.write(frame(n/12).tobytes())
 proc.stdin.close()
 if proc.wait():raise RuntimeError('Encoding failed')
 (OUT/'tutorial-script.txt').write_text('\n\n'.join(f'{i*12}–{(i+1)*12} 秒｜{s[0]}\n'+'\n'.join(s[1])+'\n'+s[2] for i,s in enumerate(SCENES)),encoding='utf-8')
 sheet=Image.new('RGB',(960,900),'white')
 for i in range(15):sheet.paste(frame(i*12+7).resize((320,180)),((i%3)*320,(i//3)*180))
 (ROOT/'.test-output').mkdir(exist_ok=True)
 sheet.save(ROOT/'.test-output/tutorial-storyboard.jpg')
 print('MP4 bytes:',(OUT/'tree-height-tutorial.mp4').stat().st_size)
