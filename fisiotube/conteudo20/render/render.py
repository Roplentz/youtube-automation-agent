"""Renderizador 'Conteúdo 2.0' — lê cenas.json (saída do agente diretor) + words.json
(transcrição palavra a palavra) e gera o vídeo vertical 1080x1920.
Uso: python3 render.py [preview_t ...]   (sem args = render completo)"""
import json, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
SPLIT = 880                       # altura do painel no modo dividido
C = json.load(open('cenas.json', encoding='utf-8'))
SRC0, SRC1 = C['fonte']['inicio'], C['fonte']['fim']
MAIN = SRC1 - SRC0
TOTAL = C['cenas'][-1]['t1']
SC = {s['modelo']: s for s in C['cenas']}

# ---------- estilo ----------
BG = (14, 13, 16); CARD = (26, 24, 28); LINE = (52, 48, 54)
OR = (255, 122, 61); OR2 = (255, 170, 120); WH = (245, 242, 238); MUT = (150, 144, 150); RED = (235, 80, 70)
FONT_DIRS = [os.environ.get('CONTEUDO20_FONT_DIR', ''), '/usr/share/fonts/truetype/google-fonts',
             os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts'), 'C:/Windows/Fonts']
def F(name, size):
    for d in FONT_DIRS:
        if d and os.path.exists(os.path.join(d, name)): return ImageFont.truetype(os.path.join(d, name), size)
    sys.exit(f'Fonte {name} não encontrada. Instale Poppins ou defina CONTEUDO20_FONT_DIR.')
fBig = F('Poppins-Bold.ttf', 150); fH = F('Poppins-Bold.ttf', 58); fM = F('Poppins-Medium.ttf', 36)
fS = F('Poppins-Medium.ttf', 28); fB = F('Poppins-Bold.ttf', 44); fCap = F('Poppins-Bold.ttf', 70); fHook = F('Poppins-Bold.ttf', 112)

def ease(x): x = max(0, min(1, x)); return 1 - (1 - x) ** 3
def lerp(a, b, k): return a + (b - a) * k
def mix(c1, c2, k): return tuple(int(lerp(a, b, k)) for a, b in zip(c1, c2))

# ---------- legendas ----------
FIX = C.get('correcoes', {})                       # erros do Whisper -> grafia correta
HL = {w.lower() for w in C.get('destaques', [])}   # palavras da legenda em laranja
words = []
for w in json.load(open('words.json', encoding='utf-8')):
    t = w['s'] - SRC0
    if 0 <= t < MAIN - 0.05:
        raw = w['w'].strip()
        txt = FIX.get(f"{raw}@{w['s']}", FIX.get(raw, raw))   # correção pontual (palavra@tempo) ou global
        if not txt: continue                                   # correção vazia remove a palavra da legenda
        if (txt.startswith('-') or re.match(r'^[.,]\d', txt)) and words: words[-1]['w'] += txt; continue
        words.append(dict(w=txt, s=t, e=w['e'] - SRC0))
chunks, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    if len(cur) == 3 or w['w'][-1] in ',.' or not nxt or nxt['s'] - w['e'] > 0.35:
        chunks.append(cur); cur = []
def caption_at(t):
    for i, ch in enumerate(chunks):
        end = chunks[i + 1][0]['s'] if i + 1 < len(chunks) else ch[-1]['e'] + 0.4
        end = min(end, ch[-1]['e'] + 0.6)
        if ch[0]['s'] <= t < end: return ch
    return None

def draw_caption(img, t, cy):
    ch = caption_at(t)
    if not ch: return
    d = ImageDraw.Draw(img)
    parts = [(w['w'].strip(',.'), w) for w in ch]
    sp = d.textlength(' ', font=fCap)
    widths = [d.textlength(p, font=fCap) for p, _ in parts]
    x = W / 2 - (sum(widths) + sp * (len(parts) - 1)) / 2
    k = ease((t - ch[0]['s']) / 0.12); y = cy + (1 - k) * 18
    for (p, w), wd in zip(parts, widths):
        col = OR if p.lower().strip('.,') in HL else WH
        d.text((x, y), p, font=fCap, fill=col, anchor='lm', stroke_width=7, stroke_fill=(10, 10, 12))
        x += wd + sp

# ---------- fonte de vídeo ----------
def source_frames():
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', str(SRC0), '-t', str(MAIN), '-i', C['fonte']['arquivo'],
                          '-vf', f'fps={FPS}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    n = 1920 * 1080 * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield Image.frombuffer('RGB', (1920, 1080), b)

CX = C['fonte'].get('cx', 960)  # centro horizontal do apresentador na fonte (px, fonte 1920x1080)
def crop_cam(fr, w, h):
    ch = 1080; cw = int(ch * w / h)
    x0 = max(0, min(1920 - cw, CX - cw // 2))
    return fr.crop((x0, 0, x0 + cw, ch)).resize((w, h), Image.LANCZOS)

# ---------- simulação: pulsos + tensão (relação força-frequência) ----------
OSC = SC.get('osciloscopio', {'keyframes_hz': [[0, 10]], 'rotulos': [], 'chips': [], 'chips_ate': 0}); SLOW = 0.3; WIN = 0.5; TP = 0.02
def hz_at(t):
    kf = OSC['keyframes_hz']
    if t <= kf[0][0]: return kf[0][1]
    val = kf[0][1]
    for i, (a, fa) in enumerate(kf):
        if t >= a: val = lerp(kf[i - 1][1] if i else fa, fa, ease((t - a) / 0.4))
    return val
# pulsos em tempo simulado
pulses, ph, dt = [], 0.0, 1 / 1200
for i in range(int(TOTAL / dt) if 'osciloscopio' in SC else 0):
    t = i * dt; ph += hz_at(t) * SLOW * dt
    if ph >= 1: ph -= 1; pulses.append(t * SLOW)
pulses = np.array(pulses)
def tension(ts_arr):
    S = np.zeros_like(ts_arr)
    for p in pulses[(pulses > ts_arr[0] - 0.4) & (pulses < ts_arr[-1])]:
        tau = ts_arr - p; m = tau > 0
        S[m] += (tau[m] / TP) * np.exp(1 - tau[m] / TP)
    return 1 - np.exp(-0.9 * S)

def rr(d, box, r, **kw): d.rounded_rectangle(box, r, **kw)
def arrow(d, cx, cy, s, col, up=True):
    k = -1 if up else 1
    d.polygon([(cx - s, cy - k * s * 0.4), (cx + s, cy - k * s * 0.4), (cx, cy + k * s * 0.8)], fill=col)

def draw_osc(img, t, box, full, _s=None):
    d = ImageDraw.Draw(img); x0, y0, x1, y1 = box
    rr(d, box, 36, fill=CARD, outline=LINE, width=2)
    pad = 44; hz = hz_at(t)
    # cabeçalho
    rr(d, (x0 + pad, y0 + pad, x0 + pad + 250, y0 + pad + 52), 26, fill=(48, 34, 28))
    d.ellipse((x0 + pad + 20, y0 + pad + 19, x0 + pad + 34, y0 + pad + 33), fill=OR)
    d.text((x0 + pad + 48, y0 + pad + 26), 'FREQUÊNCIA', font=fS, fill=OR2, anchor='lm')
    d.text((x1 - pad, y0 + pad - 18), f'{round(hz)} Hz', font=fBig, fill=OR, anchor='ra')
    # traços
    ts = t * SLOW; xs = np.linspace(ts - WIN, ts, 700)
    gx0, gx1 = x0 + pad, x1 - pad
    def X(v): return gx0 + (v - (ts - WIN)) / WIN * (gx1 - gx0)
    ya = y0 + (250 if full else 205); ha = 110 if full else 85
    d.text((gx0, ya - 22), 'Estímulo elétrico', font=fS, fill=MUT, anchor='ls')
    d.line((gx0, ya + ha, gx1, ya + ha), fill=LINE, width=2)
    pw = max(3, int((gx1 - gx0) * 0.006))
    for p in pulses[(pulses > ts - WIN) & (pulses <= ts)]:
        px = X(p); d.rectangle((px, ya + 6, px + pw, ya + ha), fill=OR)
    yb = ya + ha + (90 if full else 70); hb = 300 if full else 175
    d.text((gx0, yb - 22), 'Tensão muscular', font=fS, fill=MUT, anchor='ls')
    T = tension(xs)
    pts = [(X(v), yb + hb - T[i] * hb) for i, v in enumerate(xs)]
    d.polygon(pts + [(gx1, yb + hb), (gx0, yb + hb)], fill=(70, 40, 30))
    d.line(pts, fill=OR, width=5, joint='curve')
    d.line((gx0, yb + hb, gx1, yb + hb), fill=LINE, width=2)
    # músculo + rótulo
    yc = yb + hb + (70 if full else 25)
    Tn = float(T[-60:].mean())
    L = 190 - 55 * Tn; Th = 46 + 40 * Tn; mx = gx0 + 105
    d.ellipse((mx - L / 2, yc + 60 - Th / 2, mx + L / 2, yc + 60 + Th / 2), fill=mix((90, 50, 40), OR, Tn))
    d.line((mx - L / 2 - 30, yc + 60, mx - L / 2, yc + 60), fill=MUT, width=6)
    d.line((mx + L / 2, yc + 60, mx + L / 2 + 30, yc + 60), fill=MUT, width=6)
    lab = [r for r in OSC['rotulos'] if r[0] <= t]
    if lab:
        t0, a, b = lab[-1]; k = ease((t - t0) / 0.3)
        d.text((gx0 + 250, yc + 40 - (1 - k) * 20), a, font=fH, fill=mix(CARD, WH, k), anchor='lm')
        d.text((gx0 + 252, yc + 100 - (1 - k) * 20), b, font=fS, fill=mix(CARD, MUT, k), anchor='lm')
    return yc + 160

def draw_chips(img, t, y):
    if t >= OSC['chips_ate']: return
    d = ImageDraw.Draw(img); x = 70
    for t0, txt in OSC['chips']:
        if t < t0: continue
        k = ease((t - t0) / 0.25); w = d.textlength(txt, font=fM) + 70
        rr(d, (x, y + (1 - k) * 30, x + w, y + 76 + (1 - k) * 30), 38, fill=mix(BG, (48, 34, 28), k), outline=mix(BG, OR, k), width=2)
        d.text((x + 35, y + 38 + (1 - k) * 30), txt, font=fM, fill=mix(BG, WH, k), anchor='lm')
        x += w + 20

def draw_ff(img, t, box, full=False, s=None):
    ev = (s or SC['forca_fadiga'])['eventos']; d = ImageDraw.Draw(img); x0, y0, x1, y1 = box
    rr(d, box, 36, fill=CARD, outline=LINE, width=2); pad = 50
    k = ease((t - ev['freq_sobe']) / 2.2); hz = lerp(10, 80, k)
    d.text((x0 + pad, y0 + pad + 30), 'Frequência', font=fH, fill=WH, anchor='lm'); arrow(d, x0 + pad + d.textlength('Frequência', font=fH) + 40, y0 + pad + 30, 18, OR)
    d.text((x1 - pad, y0 + pad + 30), f'{round(hz)} Hz', font=fH, fill=OR, anchor='rm')
    sy = y0 + pad + 110
    rr(d, (x0 + pad, sy, x1 - pad, sy + 18), 9, fill=LINE)
    rr(d, (x0 + pad, sy, x0 + pad + (x1 - x0 - 2 * pad) * (0.08 + 0.92 * k), sy + 18), 9, fill=OR)
    rows = [('Força / tensão', ev['forca'], OR, 0.35 + 0.6 * k), ('Fadiga', ev['fadiga'], RED, 0.25 + 0.7 * ease((t - ev['fadiga']) / 1.6))]
    yy = sy + 110
    for name, t0, col, val in rows:
        a = ease((t - t0) / 0.3)
        if a <= 0: yy += 150; continue
        d.text((x0 + pad, yy), name, font=fM, fill=mix(CARD, WH, a), anchor='lm')
        arrow(d, x1 - pad - 20, yy, 18, mix(CARD, col, a))
        rr(d, (x0 + pad, yy + 40, x1 - pad, yy + 90), 25, fill=mix(CARD, LINE, a))
        rr(d, (x0 + pad, yy + 40, x0 + pad + max(50, (x1 - x0 - 2 * pad) * val * a), yy + 90), 25, fill=col)
        yy += 150

def draw_osc_full(img, t, box, full, s):
    yend = draw_osc(img, t, box, full, s)
    if full: draw_chips(img, t, yend + 60)

def wrap(d, text, font, width):
    lines, cur = [], ''
    for w in text.split():
        nxt = (cur + ' ' + w).strip()
        if d.textlength(nxt, font=font) <= width or not cur: cur = nxt
        else: lines.append(cur); cur = w
    return lines + ([cur] if cur else [])

def draw_cartao(img, t, box, full, s):
    """Modelo genérico: título + itens que entram no tempo da fala + fonte (PMID) no rodapé."""
    d = ImageDraw.Draw(img); x0, y0, x1, y1 = box; pad = 50
    rr(d, box, 36, fill=CARD, outline=LINE, width=2)
    if s.get('kicker'):
        d.text((x0 + pad, y0 + pad + 10), s['kicker'].upper(), font=fS, fill=OR2, anchor='lm')
    yy = y0 + pad + 50
    for line in wrap(d, s.get('titulo', ''), fH, x1 - x0 - 2 * pad):
        d.text((x0 + pad, yy + 30), line, font=fH, fill=WH, anchor='lm'); yy += 70
    yy += 30
    draw_itens(d, t, s.get('itens', []), x0 + pad, yy, x1 - x0 - 2 * pad)
    if s.get('fonte'):
        d.text((x0 + pad, y1 - pad), s['fonte'], font=fS, fill=MUT, anchor='ls')

def draw_itens(d, t, itens, x, yy, width):
    for t0, txt in itens:
        a = ease((t - t0) / 0.3)
        if a <= 0: continue
        lines = wrap(d, txt, fM, width - 50)
        d.ellipse((x, yy + 13 + (1 - a) * 20, x + 18, yy + 31 + (1 - a) * 20), fill=mix(CARD, OR, a))
        for j, line in enumerate(lines):
            d.text((x + 44, yy + 22 + j * 48 + (1 - a) * 20), line, font=fM, fill=mix(CARD, WH, a), anchor='lm')
        yy += 48 * max(1, len(lines)) + 28
    return yy

def draw_equacao(img, t, box, full, s):
    """A + B = resultado. Eventos: a, b, resultado (tempos da fala)."""
    d = ImageDraw.Draw(img); x0, y0, x1, y1 = box; pad = 50
    rr(d, box, 36, fill=CARD, outline=LINE, width=2)
    ev = s.get('eventos', {}); cx = (x0 + x1) / 2; w = x1 - x0 - 2 * pad
    if s.get('kicker'): d.text((x0 + pad, y0 + pad + 10), s['kicker'].upper(), font=fS, fill=OR2, anchor='lm')
    bh = 175 if full else 118; gap = 120 if full else 70
    yy = y0 + pad + (130 if full else 60)
    def termo(key, txt, y, destaque=False):
        a = ease((t - ev.get(key, 1e9)) / 0.35)
        if a <= 0: return
        dy = (1 - a) * 30
        if destaque:
            rr(d, (x0 + pad, y + dy, x1 - pad, y + bh + 30 + dy), 30, fill=mix(CARD, OR, a))
            d.text((cx, y + (bh + 30) / 2 + dy), txt, font=fH, fill=mix(CARD, WH, a), anchor='mm')
        else:
            rr(d, (x0 + pad, y + dy, x1 - pad, y + bh + dy), 28, fill=mix(CARD, (34, 31, 36), a), outline=mix(CARD, LINE, a), width=2)
            lines = wrap(d, txt, fB, w - 60)
            for j, line in enumerate(lines):
                d.text((cx, y + bh / 2 + (j - (len(lines) - 1) / 2) * 50 + dy), line, font=fB, fill=mix(CARD, WH, a), anchor='mm')
    def sinal(key, y, eq=False):
        a = ease((t - ev.get(key, 1e9)) / 0.3)
        if a <= 0: return
        c = mix(CARD, OR, a); r = 22
        if eq:
            d.rectangle((cx - r, y - 12, cx + r, y - 4), fill=c); d.rectangle((cx - r, y + 4, cx + r, y + 12), fill=c)
        else:
            d.rectangle((cx - r, y - 4, cx + r, y + 4), fill=c); d.rectangle((cx - 4, y - r, cx + 4, y + r), fill=c)
    termo('a', s.get('a', ''), yy)
    sinal('b', yy + bh + gap / 2)
    termo('b', s.get('b', ''), yy + bh + gap)
    sinal('resultado', yy + 2 * bh + gap * 1.5, eq=True)
    termo('resultado', s.get('resultado', ''), yy + 2 * bh + 2 * gap, destaque=True)

def draw_numero(img, t, box, full, s):
    """Número grande que conta até `valor` a partir do evento `conta`; unidade, rótulo e itens."""
    d = ImageDraw.Draw(img); x0, y0, x1, y1 = box; pad = 50
    rr(d, box, 36, fill=CARD, outline=LINE, width=2)
    ev = s.get('eventos', {}); cx = (x0 + x1) / 2
    if s.get('kicker'): d.text((x0 + pad, y0 + pad + 10), s['kicker'].upper(), font=fS, fill=OR2, anchor='lm')
    k = ease((t - ev.get('conta', 1e9)) / 1.4)
    yb = y0 + pad + (230 if full else 170)
    if k > 0:
        v = f"{round(s.get('valor', 0) * k):,}".replace(',', '.')
        pre = s.get('prefixo', '')
        num = pre + v; un = s.get('unidade', '')
        wn = d.textlength(num, font=fBig); wu = d.textlength(' ' + un, font=fH) if un else 0
        xs = cx - (wn + wu) / 2
        d.text((xs, yb), num, font=fBig, fill=OR, anchor='ls')
        if un: d.text((xs + wn, yb - 12), ' ' + un, font=fH, fill=WH, anchor='ls')
        if s.get('rotulo'): d.text((cx, yb + 60), s['rotulo'], font=fM, fill=MUT, anchor='mm')
    draw_itens(d, t, s.get('itens', []), x0 + pad, yb + 130, x1 - x0 - 2 * pad)

DRAW = {'osciloscopio': draw_osc_full, 'forca_fadiga': draw_ff, 'cartao': draw_cartao,
        'equacao': draw_equacao, 'numero': draw_numero}

def panel(img, t, box, full):
    s = next((s for s in C['cenas'] if s['modelo'] in DRAW and s['t0'] <= t < s['t1']), None)
    if s: DRAW[s['modelo']](img, t, box, full, s)

def cam_ok(t): return not any(a <= t < b for a, b in C['camera_indisponivel'])

def frame(t, fr):
    hook = SC['gancho']
    if t < hook['t1']:
        img = crop_cam(fr, W, H)
        if hook.get('fundo') == 'desfocado':   # esconde tarjas/marcas atrás do título
            img = Image.blend(img.filter(ImageFilter.GaussianBlur(22)), Image.new('RGB', (W, H), (8, 8, 10)), 0.35)
        ov = Image.new('RGBA', (W, H)); od = ImageDraw.Draw(ov)
        for y in range(900): od.line((0, y, W, y), fill=(8, 8, 10, int(210 * (1 - y / 900))))
        img = Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB'); d = ImageDraw.Draw(img)
        d.text((W / 2, 230), '·  ' + hook['kicker'] + '  ·', font=fS, fill=OR2, anchor='mm')
        for i, line in enumerate(hook['titulo']):
            k = ease((t - 0.12 * i) / 0.25)
            d.text((W / 2, 360 + i * 130 + (1 - k) * 40), line, font=fHook, fill=mix((30, 30, 30), OR if i == 0 else WH, k),
                   anchor='mm', stroke_width=4, stroke_fill=(10, 10, 12))
        draw_caption(img, t, 1500); return img
    if t >= MAIN:   # CTA
        return None
    img = Image.new('RGB', (W, H), BG)
    if cam_ok(t):
        img.paste(crop_cam(fr, W, H - SPLIT), (0, SPLIT))
        d = ImageDraw.Draw(img); d.rectangle((0, SPLIT - 4, W, SPLIT), fill=OR)
        panel(img, t, (40, 40, W - 40, SPLIT - 40), False)
        draw_caption(img, t, 1640)
    else:
        panel(img, t, (40, 180, W - 40, 1180), True)
        draw_caption(img, t, 1640)
    return img

def cta(t, last):
    s = SC['cta']; k = ease((t - s['t0']) / 0.4)
    bg = last.filter(ImageFilter.GaussianBlur(28 * k))
    img = Image.blend(bg, Image.new('RGB', (W, H), (8, 8, 10)), 0.55 * k); d = ImageDraw.Draw(img)
    for i, (txt, col) in enumerate([(s['linha1'], WH), (s['destaque'], OR), (s['linha2'], WH)]):
        kk = ease((t - s['t0'] - 0.1 * i) / 0.35)
        d.text((W / 2, 700 + i * 120 + (1 - kk) * 40), txt, font=fHook if col == OR else fH, fill=mix((20, 20, 20), col, kk), anchor='mm')
    kb = ease((t - s['t0'] - 0.5) / 0.35); pulse = 1 + 0.03 * math.sin((t - s['t0']) * 6)
    bw, bh = 520 * pulse, 120 * pulse
    rr(d, (W / 2 - bw / 2, 1120 - bh / 2, W / 2 + bw / 2, 1120 + bh / 2), 60, fill=mix((20, 20, 20), OR, kb))
    d.text((W / 2 - 25, 1120), 'Salvar vídeo', font=fH, fill=mix((20, 20, 20), WH, kb), anchor='mm'); arrow(d, W / 2 + 205, 1118, 16, mix((20, 20, 20), WH, kb), up=False)
    d.text((W / 2, 1720), s['rodape'], font=fS, fill=mix((20, 20, 20), MUT, kb), anchor='mm')
    return img

if __name__ == '__main__':
    if len(sys.argv) > 1:   # prévia de quadros
        want = [float(a) for a in sys.argv[1:]]; frs = {}
        for i, fr in enumerate(source_frames()):
            t = i / FPS
            for w in want:
                if abs(t - w) < 0.5 / FPS: frs[w] = frame(t, fr)
        last = list(frs.values())[-1]
        for w in want:
            im = frs.get(w) or cta(w, last); im.save(f'prev_{w:05.1f}.jpg', quality=85)
        sys.exit()
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-ss', str(SRC0), '-t', str(MAIN), '-i', C['fonte']['arquivo'],
                            '-filter_complex', f'[1:a]afade=t=out:st={MAIN-0.25}:d=0.25,apad=whole_dur={TOTAL}[a]',
                            '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
                            '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', C.get('saida', 'video_conteudo20.mp4')], stdin=subprocess.PIPE)
    last = None; n = 0
    for i, fr in enumerate(source_frames()):
        t = i / FPS
        if t >= MAIN: break
        im = frame(t, fr); enc.stdin.write(im.tobytes()); last = im; n += 1
    while n / FPS < TOTAL:
        enc.stdin.write(cta(n / FPS, last).tobytes()); n += 1
    enc.stdin.close(); enc.wait(); print('ok', n, 'frames')
