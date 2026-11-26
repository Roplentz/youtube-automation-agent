"""Conteúdo 2.0 — formato v2: Reel montado por cenas que alternam 6 tipos de tela.
Telas: hook (vídeo + caixa-manchete) · footage (vídeo + legenda progressiva) · kinetic (tipografia em fundo escuro)
       · objeto (card com moldura cobre + objeto animado) · prova (evidência em cima + vídeo embaixo)
       · icone (objeto pequeno em cima + vídeo embaixo) · final (palavras grandes).
Uso: python3 render_v2.py roteiro.json [t1 t2 ...]   (com tempos = só prévias JPG; sem = render completo)
Roda localmente, sem API paga. O vídeo gerado é RASCUNHO para revisão humana."""
import json, math, os, random, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIRS = [os.environ.get('CONTEUDO20_FONT_DIR', ''), os.path.join(HERE, 'fonts'),
             '/usr/share/fonts/truetype/google-fonts/ofl/montserrat', '/usr/share/fonts/truetype/google-fonts', 'C:/Windows/Fonts']
def _find(name):
    for d in FONT_DIRS:
        if d and os.path.exists(os.path.join(d, name)): return os.path.join(d, name)
MONT = _find('Montserrat[wght].ttf')
POPPINS = {'ExtraBold': 'Poppins-Bold.ttf', 'Bold': 'Poppins-Bold.ttf', 'SemiBold': 'Poppins-Medium.ttf', 'Medium': 'Poppins-Medium.ttf'}
def M(size, style):
    """Montserrat variável (preferida); sem ela, cai para Poppins."""
    if MONT:
        f = ImageFont.truetype(MONT, size); f.set_variation_by_name(style); return f
    p = _find(POPPINS[style])
    if not p: sys.exit('Fonte não encontrada: instale Montserrat ou Poppins, ou defina CONTEUDO20_FONT_DIR.')
    return ImageFont.truetype(p, size)
fCap, fCapBig, fKin, fBox = M(56, 'ExtraBold'), M(74, 'ExtraBold'), M(74, 'ExtraBold'), M(56, 'ExtraBold')
fKick, fBody, fBodyB, fSmall, fHuge, fTag = M(30, 'SemiBold'), M(46, 'Medium'), M(54, 'Bold'), M(28, 'Medium'), M(150, 'ExtraBold'), M(28, 'ExtraBold')
BG1, BG2 = (22, 21, 25), (32, 30, 34)
CU, CU2, CUD = (217, 119, 58), (244, 168, 110), (120, 62, 30)
WH, MUT, YEL = (246, 243, 239), (160, 154, 160), (255, 212, 0)

def ease(x): x = max(0., min(1., x)); return 1 - (1 - x) ** 3
def mix(a, b, k): return tuple(int(x + (y - x) * k) for x, y in zip(a, b))

RT = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'roteiro.json', encoding='utf-8'))
SCENES = RT['cenas']
t = 0
for s in SCENES: s['t0'] = t; t += s['dur']
TOTAL = t

# ---------- vídeo ----------
READERS = []
def clip_reader(path, ss, dur):
    """clip = [arquivo relativo à pasta do roteiro, início em s]; respeita rotação de vídeos de celular."""
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', str(ss), '-t', str(dur + 0.5), '-i', path, '-vf', f'fps={FPS}',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    READERS.append(p)
    info = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation',
                           '-of', 'json', path], capture_output=True, text=True).stdout
    st = json.loads(info)['streams'][0]; w, h = st['width'], st['height']
    rot = any(abs(sd.get('rotation', 0)) == 90 for sd in st.get('side_data_list', []))
    if rot: w, h = h, w
    last = None
    while True:
        b = p.stdout.read(w * h * 3)
        if len(b) < w * h * 3: break
        last = Image.frombuffer('RGB', (w, h), b); yield last
    while True: yield last

def cover(fr, w, h, cy=0.5):
    k = max(w / fr.width, h / fr.height); nw, nh = int(fr.width * k + .5), int(fr.height * k + .5)
    im = fr.resize((nw, nh), Image.BILINEAR); x0 = (nw - w) // 2; y0 = int((nh - h) * cy)
    return im.crop((x0, y0, x0 + w, y0 + h))

def fit(fr, w, h):
    bg = Image.blend(cover(fr, w, h).filter(ImageFilter.GaussianBlur(26)), Image.new('RGB', (w, h), BG1), 0.5)
    fh = int(w * fr.height / fr.width); bg.paste(fr.resize((w, fh), Image.BILINEAR), (0, (h - fh) // 2)); return bg

# ---------- fundo e tipografia ----------
_bg = None
def dark_bg():
    global _bg
    if _bg is None:
        a = np.linspace(0, 1, H)[:, None, None]
        arr = (np.array(BG1) * (1 - a) + np.array(BG2) * a).repeat(W, 1)
        yy, xx = np.mgrid[0:H, 0:W]; v = 1 - 0.35 * (((xx - W / 2) / (W * .8)) ** 2 + ((yy - H / 2) / (H * .7)) ** 2)
        _bg = Image.fromarray(np.clip(arr * v[..., None], 0, 255).astype('uint8'))
    return _bg.copy()

def kicker(d, text, cx, y, k=1):
    sp = 9; chars = list(text); ws = [d.textlength(c, font=fKick) for c in chars]; tw = sum(ws) + sp * (len(chars) - 1)
    x = cx - tw / 2
    for c, w in zip(chars, ws): d.text((x, y), c, font=fKick, fill=mix(BG1, CU, k), anchor='lm'); x += w + sp
    d.line((cx - 18, y + 30, cx + 18, y + 30), fill=mix(BG1, CU, k), width=3)

def lines_for(d, words, font, maxw):
    lines, cur = [], []
    for w in words:
        if cur and d.textlength(' '.join(cur + [w]), font=font) > maxw: lines.append(cur); cur = [w]
        else: cur.append(w)
    return lines + ([cur] if cur else [])

def reveal_text(img, text, keys, tl, cy, font, maxw=880, per=0.11, shadow=True):
    """Palavra por palavra (entra com leve subida), palavras-chave em cobre."""
    d = ImageDraw.Draw(img); words = text.split(); keys = [k.upper() for k in keys]
    lines = lines_for(d, words, font, maxw); lh = font.size * 1.18
    y = cy - lh * (len(lines) - 1) / 2; i = 0
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh); draws = []
    for ln in lines:
        tw = d.textlength(' '.join(ln), font=font); x = W / 2 - tw / 2
        for w in ln:
            k = ease((tl - i * per) / 0.18)
            if k > 0:
                col = CU if any(w.strip('.,?!').upper() == kk or kk in w.upper() for kk in keys) else WH
                draws.append((x, y + (1 - k) * 14, w, col, k))
            x += d.textlength(w + ' ', font=font); i += 1
        y += lh
    if shadow:
        for x, y2, w, col, k in draws: sd.text((x + 3, y2 + 4), w, font=font, fill=(0, 0, 0, int(150 * k)), anchor='lm')
        sh = sh.filter(ImageFilter.GaussianBlur(5)); img.paste(sh, (0, 0), sh)
    d = ImageDraw.Draw(img)
    for x, y2, w, col, k in draws: d.text((x, y2), w, font=font, fill=mix((40, 40, 40), col, k) if k < 1 else col, anchor='lm')
    return img

# ---------- objetos (cobre, pseudo-3D) ----------
def glow_layer(draw_fn, size, blur):
    lay = Image.new('RGBA', size, (0, 0, 0, 0)); draw_fn(ImageDraw.Draw(lay)); return lay.filter(ImageFilter.GaussianBlur(blur))

def icon(name, S=520, phase=0.0):
    """Desenha em 2x para suavizar; tons cobre com realce = falso volume."""
    Z = S * 2; c = Z // 2; im = Image.new('RGBA', (Z, Z), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    dark, mid, hi = (58, 40, 32, 255), CU + (255,), CU2 + (255,)
    def bar(x0, y0, x1, y1, r, fill=mid):
        d.rounded_rectangle((x0, y0, x1, y1), r, fill=dark); d.rounded_rectangle((x0 + 8, y0 + 6, x1 - 8, y1 - 10), r, fill=fill)
        d.rounded_rectangle((x0 + 18, y0 + 14, x0 + 34, y1 - 24), 8, fill=hi)
    if name == 'exo':
        leg = (78, 72, 76, 255); legd = (52, 48, 52, 255)
        hip, knee, ank, toe = (c - 40, 200), (c + 60, 560), (c - 10, 900), (c + 190, 960)
        d.line([hip, knee], fill=legd, width=190); d.line([knee, ank], fill=legd, width=150); d.line([ank, toe], fill=legd, width=90)
        d.line([hip, knee], fill=leg, width=160); d.line([knee, ank], fill=leg, width=124); d.line([ank, toe], fill=leg, width=66)
        d.ellipse((knee[0] - 80, knee[1] - 80, knee[0] + 80, knee[1] + 80), fill=leg); d.ellipse((ank[0] - 60, ank[1] - 60, ank[0] + 60, ank[1] + 60), fill=leg)
        d.rounded_rectangle((c - 230, 130, c + 170, 230), 46, fill=dark); d.rounded_rectangle((c - 220, 140, c + 160, 218), 40, fill=mid)
        d.rounded_rectangle((c - 200, 152, c - 40, 172), 10, fill=hi)
        def strut(p, q, w):
            d.line([p, q], fill=dark, width=w + 16); d.line([p, q], fill=mid, width=w); d.line([(p[0] - w / 4, p[1]), (q[0] - w / 4, q[1])], fill=hi, width=8)
        strut((c - 10, 225), (knee[0] + 25, knee[1] - 70), 44); strut((knee[0] + 20, knee[1] + 70), (ank[0] + 30, ank[1] - 50), 40)
        for y0 in (330, 450):
            x = c - 40 + (y0 - 200) * 100 / 360
            d.rounded_rectangle((x - 105, y0 - 22, x + 105, y0 + 22), 18, fill=(120, 66, 36, 255))
        d.rounded_rectangle((ank[0] - 90, ank[1] - 90, ank[0] + 90, ank[1] - 50), 16, fill=(120, 66, 36, 255))
        kx, ky = knee[0] + 25, knee[1]
        for i in range(12):
            a_ = phase * 1.5 + i * math.pi / 6
            d.polygon([(kx + math.cos(a_ - .12) * 92, ky + math.sin(a_ - .12) * 92), (kx + math.cos(a_ + .12) * 92, ky + math.sin(a_ + .12) * 92),
                       (kx + math.cos(a_ + .12) * 72, ky + math.sin(a_ + .12) * 72), (kx + math.cos(a_ - .12) * 72, ky + math.sin(a_ - .12) * 72)], fill=mid)
        d.ellipse((kx - 78, ky - 78, kx + 78, ky + 78), fill=dark); d.ellipse((kx - 64, ky - 64, kx + 64, ky + 64), fill=mid)
        d.ellipse((kx - 26, ky - 26, kx + 26, ky + 26), fill=hi)
        g = glow_layer(lambda gd: gd.ellipse((c + 90, 170, c + 130, 210), fill=(190, 140, 255, 255)), (Z, Z), 14); im.alpha_composite(g)
        d.ellipse((c + 100, 180, c + 120, 200), fill=(220, 190, 255, 255))
    elif name == 'bolt':
        d.ellipse((c - 330, c - 170, c + 330, c + 170), fill=dark); d.ellipse((c - 310, c - 150, c + 310, c + 150), fill=(110, 62, 40, 255))
        for k in range(-3, 4): d.arc((c - 300, c - 140 + k * 26, c + 300, c + 140 + k * 26), 200, 340, fill=(150, 85, 50, 255), width=6)
        bolt = [(c + 40, c - 420), (c - 160, c + 40), (c - 20, c + 40), (c - 90, c + 420), (c + 170, c - 70), (c + 20, c - 70), (c + 110, c - 420)]
        g = glow_layer(lambda gd: gd.polygon(bolt, fill=CU2 + (255,)), (Z, Z), 40); im.alpha_composite(g)
        d.polygon(bolt, fill=dark); d.polygon([(x * 0.94 + c * 0.06, y * 0.94 + c * 0.06) for x, y in bolt], fill=mid)
        d.line([(c + 30, c - 330), (c - 90, c - 20)], fill=hi, width=16)
    elif name == 'sensor':
        d.ellipse((c - 300, c - 300, c + 300, c + 300), fill=dark); d.ellipse((c - 270, c - 270, c + 270, c + 270), fill=(40, 30, 28, 255))
        d.ellipse((c - 300, c - 300, c + 300, c + 300), outline=mid, width=22)
        pts = []
        for i in range(0, 41):
            x = c - 220 + i * 11; ph = i / 40 * 4 * math.pi + phase * 6
            y = c + (math.sin(ph) * 50 if i < 14 or i > 26 else (-170 if i == 19 else 150 if i == 21 else math.sin(ph) * 50))
            pts.append((x, y))
        g = glow_layer(lambda gd: gd.line(pts, fill=CU2 + (255,), width=26, joint='curve'), (Z, Z), 22); im.alpha_composite(g)
        d.line(pts, fill=hi, width=14, joint='curve')
        d.rounded_rectangle((c - 60, c - 420, c + 60, c - 300), 24, fill=mid)
    elif name == 'escudo':
        shield = [(c, 150), (c + 330, 270), (c + 300, 620), (c, 900), (c - 300, 620), (c - 330, 270)]
        g = glow_layer(lambda gd: gd.polygon(shield, fill=CU + (180,)), (Z, Z), 40); im.alpha_composite(g)
        d.polygon(shield, fill=dark); d.polygon([(x * 0.9 + c * 0.1, y * 0.9 + 520 * 0.1) for x, y in shield], fill=mid)
        d.polygon([(x * 0.74 + c * 0.26, y * 0.74 + 520 * 0.26) for x, y in shield], fill=(110, 60, 34, 255))
        d.line([(c - 130, 520), (c - 30, 630), (c + 160, 400)], fill=hi, width=56, joint='curve')
    return im.resize((S, S), Image.LANCZOS)

ICON_CACHE = {}
def draw_object(img, name, t, cx, cy, S, intro=0.6):
    k = ease(t / intro); sc = 0.82 + 0.18 * k
    key = (name, S, int(t * 6) if name in ('sensor', 'exo') else 0)
    if key not in ICON_CACHE: ICON_CACHE[key] = icon(name, S, phase=t)
    ic = ICON_CACHE[key]; sz = int(S * sc)
    ic2 = ic.resize((sz, sz), Image.BILINEAR).rotate(math.sin(t * 1.4) * 4, resample=Image.BICUBIC)
    a = ic2.split()[3].point(lambda v: int(v * k)); ic2.putalpha(a)
    oy = math.sin(t * 2.0) * 10
    # anéis de órbita + partícula
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for r, al in ((S * 0.62, 70), (S * 0.82, 40)):
        od.ellipse((cx - r, cy - r + oy, cx + r, cy + r + oy), outline=CU + (int(al * k),), width=2)
    ang = t * 1.3; r = S * 0.62; od.ellipse((cx + r * math.cos(ang) - 7, cy + oy + r * math.sin(ang) - 7, cx + r * math.cos(ang) + 7, cy + oy + r * math.sin(ang) + 7), fill=CU2 + (int(230 * k),))
    rnd = random.Random(7)
    for i in range(16):
        px, py = cx + rnd.uniform(-S, S), cy + rnd.uniform(-S * .9, S * .9); tw = 0.5 + 0.5 * math.sin(t * 3 + i)
        rr = rnd.uniform(1.5, 4); od.ellipse((px - rr, py - rr - t * 8 % 40, px + rr, py + rr - t * 8 % 40), fill=CU2 + (int(150 * tw * k),))
    img.alpha_composite(ov)
    img.alpha_composite(ic2, (int(cx - sz / 2), int(cy - sz / 2 + oy)))

def frame_border(img, k=1):
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    od.rounded_rectangle((36, 36, W - 36, H - 36), 24, outline=CU + (int(110 * k),), width=2); img.alpha_composite(ov)

# ---------- telas ----------
def captions_at(s, tl):
    cur = None
    for c in s.get('legendas', []):
        if tl >= c[0]: cur = c
    return cur

def screen(s, tl, fr):
    kind = s['tipo']
    if kind in ('hook', 'footage'):
        img = (fit(fr, W, H) if s.get('encaixe') else cover(fr, W, H)).convert('RGBA')
        ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
        for y in range(1250, H): od.line((0, y, W, y), fill=(0, 0, 0, int(150 * (y - 1250) / (H - 1250))))
        img.alpha_composite(ov)
        if kind == 'hook':
            d = ImageDraw.Draw(img); k = ease(tl / 0.25)
            lines = s['caixa']; widths = [d.textlength(l, font=fBox) for l in lines]; bw = max(widths) + 80; bh = 76 * len(lines) + 40
            y0 = (430 if s.get('encaixe') else 980) - bh / 2 + (1 - k) * 30
            d.rounded_rectangle((W / 2 - bw / 2, y0, W / 2 + bw / 2, y0 + bh), 26, fill=(12, 12, 14))
            for i, l in enumerate(lines):
                x = W / 2 - widths[i] / 2; yy = y0 + 58 + i * 76
                for w in l.split():
                    col = YEL if w.upper() in [x.upper() for x in s['chave']] else WH
                    d.text((x, yy), w, font=fBox, fill=col, anchor='lm'); x += d.textlength(w + ' ', font=fBox)
        c = captions_at(s, tl)
        if c: img = reveal_text(img, c[1], c[2], tl - c[0], 1560, fCap, maxw=820)
        return img.convert('RGB')
    if kind == 'kinetic':
        img = dark_bg().convert('RGBA')
        return reveal_text(img, s['texto'], s['chave'], tl, H / 2, fKin, maxw=860, per=0.2).convert('RGB')
    if kind == 'objeto':
        img = dark_bg().convert('RGBA'); k = ease(tl / 0.4); frame_border(img, k); d = ImageDraw.Draw(img)
        kicker(d, s['kicker'], W / 2, 150, k); draw_object(img, s['icone'], tl, W / 2, 860, 560)
        return reveal_text(img, s['legenda'], s['chave'], tl - 0.5, 1520, fCap, maxw=820).convert('RGB')
    if kind == 'icone':
        top = dark_bg().crop((0, 0, W, 760)).convert('RGBA'); d = ImageDraw.Draw(top)
        kicker(d, s['kicker'], W / 2, 90, ease(tl / 0.4)); draw_object(top, s['icone'], tl, W / 2, 420, 300)
        img = Image.new('RGBA', (W, H)); img.paste(top, (0, 0))
        img.paste(fit(fr, W, H - 760) if s.get('encaixe') else cover(fr, W, H - 760, 0.35), (0, 760))
        c = captions_at(s, tl)
        if c: img = reveal_text(img, c[1], c[2], tl - c[0], 1600, fCap, maxw=820)
        return img.convert('RGB')
    if kind == 'prova':
        top = dark_bg().crop((0, 0, W, 900)).convert('RGBA'); d = ImageDraw.Draw(top); k = ease(tl / 0.35)
        ov = Image.new('RGBA', top.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
        od.rounded_rectangle((50, 90 + (1 - k) * -20, W - 50, 840), 30, fill=(28, 26, 30, int(240 * k)), outline=CU + (int(140 * k),), width=2)
        top.alpha_composite(ov); d = ImageDraw.Draw(top)
        tag = s['tag']; tw = d.textlength(tag, font=fTag) + 40
        tg = Image.new('RGBA', (int(tw), 56), (0, 0, 0, 0)); tgd = ImageDraw.Draw(tg); tgd.rounded_rectangle((0, 0, tw - 1, 55), 10, fill=CU + (255,))
        tgd.text((tw / 2, 28), tag, font=fTag, fill=(20, 16, 14), anchor='mm'); tg = tg.rotate(4, expand=True, resample=Image.BICUBIC)
        a = tg.split()[3].point(lambda v: int(v * k)); tg.putalpha(a); top.alpha_composite(tg, (int(W - 70 - tg.width), 66))
        d.text((100, 190), 'O QUE DIZ A EVIDÊNCIA', font=fKick, fill=mix(BG1, CU, k), anchor='lm')
        kb = ease((tl - 0.4) / 0.3); y = 290
        for line in lines_for(d, s['numero'].split(), fBodyB, W - 220):
            d.text((100, y), ' '.join(line), font=fBodyB, fill=mix(BG1, WH, kb), anchor='lm'); y += 66
        y += 30
        for j, line in enumerate(lines_for(d, s['achado'].split(), fBody, W - 220)):
            kk = ease((tl - 0.9 - j * 0.15) / 0.3); d.text((100, y), ' '.join(line), font=fBody, fill=mix(BG1, WH, kk), anchor='lm'); y += 64
        kf = ease((tl - 1.6) / 0.3); d.line((100, 720, 300, 720), fill=mix(BG1, CU, kf), width=2)
        d.text((100, 770), s['fonte'], font=fSmall, fill=mix(BG1, MUT, kf), anchor='lm')
        img = Image.new('RGBA', (W, H)); img.paste(top, (0, 0))
        bot = fit(fr, W, H - 900) if s.get('encaixe') else cover(fr, W, H - 900, 0.4)
        img.paste(bot, (0, 900)); return img.convert('RGB')
    if kind == 'lista':
        img = dark_bg().convert('RGBA'); k = ease(tl / 0.35); frame_border(img, k); d = ImageDraw.Draw(img)
        kicker(d, s['kicker'], W / 2, 170, k)
        tl_lines = lines_for(d, s['titulo'].split(), M(64, 'ExtraBold'), W - 200)
        y = H / 2 - (len(tl_lines) * 78 + 70 + len(s['itens']) * 150) / 2 + 40
        for line in tl_lines:
            d.text((W / 2, y), ' '.join(line), font=M(64, 'ExtraBold'), fill=mix(BG1, WH, k), anchor='mm'); y += 78
        y += 70; per = s.get('ritmo', 0.55)
        for i, item in enumerate(s['itens']):
            a = ease((tl - 0.6 - i * per) / 0.3)
            if a <= 0: continue
            dx = (1 - a) * 40
            d.rounded_rectangle((100 + dx, y - 38, 176 + dx, y + 38), 20, fill=mix(BG1, CU, a))
            d.line([(127 + dx, y + 2), (140 + dx, y + 16), (162 + dx, y - 14)], fill=mix(BG1, (24, 18, 14), a), width=8, joint='curve')
            fI = M(50, 'SemiBold'); ls = lines_for(d, item.split(), fI, W - 320)
            for j, line in enumerate(ls):
                d.text((210 + dx, y + j * 60 - (len(ls) - 1) * 30), ' '.join(line), font=fI, fill=mix(BG1, WH, a), anchor='lm')
            y += 150
        return img.convert('RGB')
    if kind == 'preco':
        img = dark_bg().convert('RGBA'); k = ease(tl / 0.35); frame_border(img, k); d = ImageDraw.Draw(img)
        kicker(d, s['kicker'], W / 2, 170, k)
        if s.get('selo'):
            tw = d.textlength(s['selo'], font=fTag) + 44
            tg = Image.new('RGBA', (int(tw), 58), (0, 0, 0, 0)); tgd = ImageDraw.Draw(tg)
            tgd.rounded_rectangle((0, 0, tw - 1, 57), 12, fill=YEL + (255,)); tgd.text((tw / 2, 29), s['selo'], font=fTag, fill=(20, 16, 14), anchor='mm')
            tg = tg.rotate(-3, expand=True, resample=Image.BICUBIC); tg.putalpha(tg.split()[3].point(lambda v: int(v * k)))
            img.alpha_composite(tg, (int(W / 2 - tg.width / 2), 400)); d = ImageDraw.Draw(img)
        d.text((W / 2, 590), s['plano'], font=M(60, 'ExtraBold'), fill=mix(BG1, WH, k), anchor='mm')
        ka = ease((tl - 0.5) / 0.3)
        if s.get('de'):
            fde = M(52, 'SemiBold'); tw = d.textlength(s['de'], font=fde)
            d.text((W / 2, 760), s['de'], font=fde, fill=mix(BG1, MUT, ka), anchor='mm')
            d.line((W / 2 - tw / 2 - 10, 764, W / 2 - tw / 2 - 10 + (tw + 20) * ease((tl - 0.9) / 0.35), 756), fill=mix(BG1, CU, ka), width=6)
        kb = ease((tl - 1.3) / 0.35); sc = 0.85 + 0.15 * kb
        fp = M(int(150 * sc), 'ExtraBold'); por = s['por']
        while d.textlength(por, font=fp) > W - 140: fp = M(fp.size - 6, 'ExtraBold')
        d.text((W / 2, 960), por, font=fp, fill=mix(BG1, CU, kb), anchor='mm')
        d.text((W / 2, 1080), s.get('por_sub', ''), font=fBodyB, fill=mix(BG1, WH, kb), anchor='mm')
        kc = ease((tl - 2.0) / 0.35)
        if s.get('parcelado'):
            d.text((W / 2, 1200), s['parcelado'], font=M(56, 'ExtraBold'), fill=mix(BG1, WH, kc), anchor='mm')
        kd = ease((tl - 2.8) / 0.35); y = 1390
        for line in s.get('notas', []):
            for ln in lines_for(d, line.split(), fKick, W - 220):
                d.text((W / 2, y), ' '.join(ln), font=fKick, fill=mix(BG1, (200, 194, 198), kd), anchor='mm'); y += 48
            y += 16
        return img.convert('RGB')
    if kind == 'final':
        img = dark_bg(); d = ImageDraw.Draw(img); w1, w2 = s['palavras']
        f1 = fHuge; f2 = M(96, 'ExtraBold')
        while d.textlength(w1, font=f1) > W - 120: f1 = M(f1.size - 6, 'ExtraBold')
        while d.textlength(w2, font=f2) > W - 120: f2 = M(f2.size - 4, 'ExtraBold')
        k1 = ease(tl / 0.2); d.text((W / 2, 850 + (1 - k1) * 30), w1, font=f1, fill=mix(BG1, CU, k1), anchor='mm')
        k2 = ease((tl - 0.7) / 0.2); d.text((W / 2, 1010 + (1 - k2) * 30), w2, font=f2, fill=mix(BG1, WH, k2), anchor='mm')
        k3 = ease((tl - 1.4) / 0.4); d.text((W / 2, 1700), s['rodape'], font=fSmall, fill=mix(BG1, MUT, k3), anchor='mm')
        return img
    raise ValueError(kind)

# ---------- trilha: 'gerada' (pad original, sem direitos de terceiros), caminho de um arquivo seu, ou 'nenhuma' ----------
def music(path='trilha.wav'):
    sr = 48000; n = int(TOTAL * sr) + sr; out = np.zeros(n)
    chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 196, 261.6], [196, 246.9, 293.7]]
    bar = 3.0
    for i in range(int(TOTAL / bar) + 1):
        f = chords[i % 4]; s0 = int(i * bar * sr); L = int(bar * 1.2 * sr); tt = np.arange(L) / sr
        env = np.minimum(1, tt / 0.8) * np.exp(-np.maximum(0, tt - bar) * 3)
        tone = sum(np.sin(2 * np.pi * fr * tt) + 0.3 * np.sin(2 * np.pi * fr * 2 * tt) for fr in f) / 6
        e = min(n, s0 + L); out[s0:e] += (tone * env)[:e - s0]
    beat = 60 / 84
    for j in range(int(TOTAL / beat)):
        s0 = int(j * beat * sr); L = int(0.25 * sr); tt = np.arange(L) / sr
        out[s0:s0 + L] += 0.35 * np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 18)
    out = out[:int(TOTAL * sr)]; fade = int(1.5 * sr); out[-fade:] *= np.linspace(1, 0, fade); out[:int(0.3 * sr)] *= np.linspace(0, 1, int(0.3 * sr))
    out = out / np.abs(out).max() * 0.25
    import wave
    w = wave.open(path, 'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((out * 32767).astype('<i2').tobytes()); w.close()

if __name__ == '__main__':
    want = [float(a) for a in sys.argv[2:]]
    enc = None
    if not want:
        from gate import enforce
        enforce(sys.argv[1] if len(sys.argv) > 1 else 'roteiro.json', 'roteiro')   # trava também fora do CLI
        trilha = RT.get('trilha', 'gerada')
        if trilha == 'gerada': music(); aud = ['-i', 'trilha.wav']
        elif trilha == 'nenhuma': aud = ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono']
        else: aud = ['-stream_loop', '-1', '-i', trilha]
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                                *aud, '-af', f'loudnorm=I=-20:TP=-2,afade=t=out:st={max(0, TOTAL - 1.5)}:d=1.5', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', str(TOTAL), '-movflags', '+faststart',
                                RT.get('saida', RT.get('slug', 'reel') + '_v2.mp4')], stdin=subprocess.PIPE)
    n = 0
    for s in SCENES:
        rd = clip_reader(s['clip'][0], s['clip'][1], s['dur']) if s.get('clip') else None
        for i in range(round(s['dur'] * FPS)):
            tl = i / FPS; tg = s['t0'] + tl; fr = next(rd) if rd else None
            if enc: enc.stdin.write(screen(s, tl, fr).tobytes())
            elif any(abs(tg - w) < 0.5 / FPS for w in want): screen(s, tl, fr).save(f'q_{tg:05.1f}.jpg', quality=85)
            n += 1
        if rd: rd.close()
    for p in READERS: p.kill()
    if enc: enc.stdin.close(); enc.wait(); print('ok', n, 'quadros', TOTAL, 's')
