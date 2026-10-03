# Headless integration check. Usage: python _check_index.py <page.html> [port]
import sys, json, time
from playwright.sync_api import sync_playwright
page_name = sys.argv[1]; port = sys.argv[2] if len(sys.argv) > 2 else '8941'
OUT = r'C:/Users/LENOVO/Downloads/new-app/.ao-private/tasks/teacher-notes/directions/v3-target/characters/'
URL = f'http://127.0.0.1:{port}/{page_name}'
R = {'checks': {}, 'shots': [], 'seq': {}, 'fps': {}}; errs = []; cons = []
def ok(name, cond, extra=''):
    R['checks'][name] = ('PASS' if cond else 'FAIL') + (' ' + str(extra) if extra != '' else '')
def newpage(br, w=1440, h=900):
    pg = br.new_page(viewport={'width': w, 'height': h})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: cons.append(m.type + ': ' + m.text[:160]) if m.type in ('error', 'warning') else None)
    return pg
def shot(pg, name, sel=None):
    p = OUT + name + '.png'
    (pg.locator(sel).screenshot(path=p) if sel else pg.screenshot(path=p)); R['shots'].append(p)
def ready(pg):
    pg.wait_for_function('window.__ready===true', timeout=60000)
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else ['pebble', 'floaty', 'lumo', 'nemu']
with sync_playwright() as pw:
    br = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    # --- Settings row + switching with real clicks
    pg = newpage(br); pg.goto(URL + '?start=panes'); ready(pg); pg.wait_for_timeout(800)
    pg.click('#profBtn'); pg.click('#profMenu [data-act="settings"]'); pg.wait_for_timeout(400)
    labels = pg.eval_on_selector_all('#charBtns button', 'els => els.map(e => e.getAttribute("aria-label"))') if pg.locator('#charBtns').count() else []
    ok('settings has Assistant row with 5 choices Orb,Pebble,Lumo,Floaty,Nemu', labels == ['Orb', 'Pebble', 'Lumo', 'Floaty', 'Nemu'], labels)
    ok('Orb is pressed by default', pg.locator('#charBtns [data-char="orb"]').get_attribute('aria-pressed') == 'true' if labels else False)
    shot(pg, 'index-settings-assistant', '#setCard')
    if labels:
        for name in ('pebble', 'floaty'):
            pg.click(f'#charBtns [data-char="{name}"]'); pg.wait_for_timeout(1500)
            ok(f'click {name}: html[data-char]={name} + canvas in host', pg.evaluate('document.documentElement.dataset.char') == name and pg.locator('#charHost canvas').count() == 1)
            ok(f'click {name}: orb sphere hidden', pg.evaluate("getComputedStyle(document.querySelector('.sphere')).display") == 'none')
            ok(f'click {name}: pressed', pg.locator(f'#charBtns [data-char="{name}"]').get_attribute('aria-pressed') == 'true')
        pg.focus('#charBtns [data-char="orb"]'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
        ok('keyboard Enter on Orb -> back to orb, host empty', pg.evaluate('document.documentElement.dataset.char') is None and pg.locator('#charHost canvas').count() == 0)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.close()
    for name in ONLY:
        # --- opening panel (big) + Talk flow
        pg = newpage(br); pg.goto(URL + f'?char={name}'); ready(pg); pg.wait_for_timeout(1500)
        ok(f'{name}: opening panel shows character host', pg.evaluate('document.documentElement.dataset.char') == name and pg.evaluate("getComputedStyle(document.getElementById('charHost')).display") == 'block')
        has_canvas = pg.locator('#charHost canvas').count() == 1; has_fb = pg.locator('#charHost .char-fb').count() == 1
        R['seq'][name + '-render'] = 'canvas' if has_canvas else ('silhouette-fallback' if has_fb else 'EMPTY')
        ok(f'{name}: something drawn (canvas or fallback)', has_canvas or has_fb)
        shot(pg, f'index-open-{name}-ready', '.stage')
        shot(pg, f'index-open-{name}-full')
        R['fps'][name + '-opening'] = pg.evaluate('window.__fps(2500)')
        pg.click('#ovTalk'); t0 = time.time(); seq = []; got = set()
        while time.time() - t0 < 11:
            st = pg.evaluate('document.documentElement.dataset.ostate')
            if not seq or seq[-1] != st: seq.append(st)
            if st in ('listening', 'thinking', 'speaking') and st not in got:
                time.sleep(.9 if st != 'thinking' else .6); got.add(st); shot(pg, f'index-open-{name}-{st}', '.stage')
            time.sleep(.05)
        R['seq'][name + '-talk'] = seq
        ok(f'{name}: Talk drives listening>thinking>speaking>normal', seq[-4:] == ['listening', 'thinking', 'speaking', 'normal'], seq)
        if has_canvas and pg.evaluate('typeof window.__char().debug') == 'function':
            ok(f'{name}: module state followed (debug target = page state)', pg.evaluate('window.__char().debug().target') == pg.evaluate('document.documentElement.dataset.ostate'))
        pg.close()
        # --- agent pane (small)
        pg = newpage(br); pg.goto(URL + f'?start=panes&char={name}'); ready(pg); pg.wait_for_timeout(1200)
        shot(pg, f'index-pane-{name}-ready', '.agent .stage')
        shot(pg, f'index-pane-{name}-full')
        pg.click('#bMic'); pg.wait_for_timeout(1600); shot(pg, f'index-pane-{name}-listening', '.agent .stage')
        pg.wait_for_timeout(2400); shot(pg, f'index-pane-{name}-thinking', '.agent .stage')
        pg.wait_for_timeout(2600); shot(pg, f'index-pane-{name}-speaking', '.agent .stage')
        R['fps'][name + '-pane'] = pg.evaluate('window.__fps(2500)')
        pg.close()
    # --- missing module must fail gracefully
    pg = newpage(br); errs_before = len(errs)
    pg.route('**/characters/lumo.js', lambda r: r.fulfill(status=404, body='nope'))
    pg.goto(URL + '?start=panes&char=lumo'); ready(pg); pg.wait_for_timeout(800)
    ok('missing lumo.js: still silhouette shown, page keeps working', pg.locator('#charHost .char-fb svg').count() == 1)
    pg.click('#bMic'); pg.wait_for_timeout(500)
    ok('missing lumo.js: Talk still works', pg.evaluate('document.documentElement.dataset.ostate') == 'listening')
    shot(pg, 'index-pane-lumo-MISSING-fallback', '.agent .stage')
    ok('missing lumo.js: no page error', len(errs) == errs_before)
    pg.close()
    # --- orb default untouched
    pg = newpage(br); pg.goto(URL + '?start=panes'); ready(pg); pg.wait_for_timeout(1200)
    ok('default: orb ring canvas present, no data-char', pg.evaluate('document.documentElement.dataset.char') is None and pg.locator('#orbGl canvas').count() == 1)
    shot(pg, 'index-pane-orb-default', '.agent .stage')
    br.close()
R['page_errors'] = errs; R['console_error_warn'] = sorted(set(cons))
print(json.dumps(R, indent=1))
