# Headless check for one character module via characters/test.html. Usage: python _check_char.py pebble [port]
import sys, time, json, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
c = sys.argv[1]; port = sys.argv[2] if len(sys.argv) > 2 else '8941'
OUT = r'C:/Users/LENOVO/Downloads/new-app/.ao-private/tasks/teacher-notes/directions/v3-target/characters/'
errs = []; res = {'char': c, 'timings': {}, 'shots': []}
def shot(page, name):
    p = OUT + f'{c}-{name}.png'
    page.locator('#stage').screenshot(path=p); res['shots'].append(p); return Image.open(p).convert('RGB')
def diff(a, b):
    d = ImageChops.difference(a, b).convert('L'); h = d.histogram()
    return round(sum(h[16:]) / (a.width * a.height) * 100, 2)
with sync_playwright() as pw:
    br = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = br.new_page(viewport={'width': 700, 'height': 560})
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console.error: ' + m.text) if m.type == 'error' else None)
    pg.goto(f'http://127.0.0.1:{port}/characters/test.html?c={c}')
    pg.wait_for_function('window.__ready === true', timeout=60000)
    res['fallback'] = pg.evaluate('!!window.__char.fallback')
    pg.wait_for_timeout(1200)
    imgs = {}
    # level slider for listening / speaking
    imgs['normal'] = shot(pg, 'normal')
    for s, lv in (('listening', 0.8), ('thinking', 0.0), ('speaking', 0.8)):
        pg.click(f'button[data-s="{s}"]'); pg.evaluate(f'window.__setLevel({lv})')
        pg.wait_for_timeout(1500 if s != 'thinking' else 1000)   # thinking: ~ mid-arc
        imgs[s] = shot(pg, s)
    # speaking low level vs high level
    pg.evaluate('window.__setLevel(0)'); pg.wait_for_timeout(600); imgs['speaking-lo'] = shot(pg, 'speaking-lo')
    # thinking arc frames
    pg.click('button[data-s="thinking"]')
    for ms in (0, 300, 700, 1100):
        pg.wait_for_timeout(300 if ms else 0)
    # return to ready
    pg.click('button[data-s="normal"]'); pg.wait_for_timeout(1400); imgs['return'] = shot(pg, 'return')
    # timing: enter + return, measured in page via debug weights
    t = pg.evaluate('''async () => {
      const ch = window.__char; const out = {};
      const wait = (key, st, thr) => new Promise(res => { const t0 = performance.now(); const f = () => { const w = ch.debug().weights[st]; if (w >= thr) res(performance.now() - t0); else if (performance.now() - t0 > 3000) res(-1); else requestAnimationFrame(f); }; f(); });
      for (const s of ['listening', 'thinking', 'speaking']) {
        ch.setState('normal'); await new Promise(r => setTimeout(r, 1200));
        ch.setState(s); out['enter-' + s] = Math.round(await wait('e', s, 0.999));
        ch.setState('normal'); out['return-from-' + s] = Math.round(await wait('r', 'normal', 0.999));
      }
      return out; }''')
    res['timings'] = t
    # calm + look
    pg.evaluate('window.__char.setState("speaking"); window.__setLevel(0.8)'); pg.click('#calm'); pg.wait_for_timeout(900); imgs['calm-speaking'] = shot(pg, 'calm-speaking')
    pg.click('#calm'); pg.evaluate('window.__char.setState("normal"); window.__setLevel(0)'); pg.wait_for_timeout(900)
    pg.evaluate('window.__char.setLook(1,-0.6)'); pg.wait_for_timeout(900); imgs['look'] = shot(pg, 'look')
    pg.evaluate('window.__char.setLook(0,0)')
    res['diffs'] = {k: diff(imgs['normal'], v) for k, v in imgs.items() if k != 'normal'}
    res['diffs']['speaking-hi-vs-lo'] = diff(imgs['speaking'], imgs['speaking-lo'])
    # non-empty: count non-background pixels of normal
    bg = imgs['normal'].getpixel((2, 2)); px = imgs['normal'].load(); n = 0
    for y in range(0, imgs['normal'].height, 3):
        for x in range(0, imgs['normal'].width, 3):
            r = px[x, y]
            if abs(r[0]-bg[0]) + abs(r[1]-bg[1]) + abs(r[2]-bg[2]) > 40: n += 1
    res['normal_nonbg_samples'] = n
    res['fps_3s'] = pg.evaluate('window.__fps ? window.__fps(3000) : null')
    br.close()
res['errors'] = errs
print(json.dumps(res, indent=1))
