# still-mode frames of the Pebble / Floaty thinking arc: python _arc.py pebble
import sys
from playwright.sync_api import sync_playwright
from PIL import Image
c=sys.argv[1]; OUT=r'C:/Users/LENOVO/Downloads/new-app/.ao-private/tasks/teacher-notes/directions/v3-target/characters/'
ims=[]
with sync_playwright() as pw:
    br=pw.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=br.new_page(viewport={'width':700,'height':560}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:8941/characters/test.html?c={c}')
    pg.wait_for_function('window.__ready===true'); pg.wait_for_timeout(800)
    pg.evaluate('window.__char.setState("thinking")')
    # real-time frames at 0,300,700,1200 ms after entering thinking
    import time; t0=time.time()
    for ms in (150,450,850,1250):
        while (time.time()-t0)*1000<ms: time.sleep(.005)
        p=OUT+f'{c}-think-{ms}.png'; pg.locator('#stage').screenshot(path=p); ims.append(Image.open(p).convert('RGB'))
    print('errors',errs); br.close()
w,h=ims[0].size; s=Image.new('RGB',(w*4,h))
for i,im in enumerate(ims): s.paste(im,(i*w,0))
s.save(OUT+f'{c}-think-strip.png')
