"""
Regenerates every brand image from design/tickorbit-logo-source.jpg.

    pip install numpy pillow
    python design/make_brand.py design/tickorbit-logo-source.jpg frontend/public/brand frontend/app design/preview.png

Outputs: frontend/public/brand/tickorbit-{mark,wordmark,logo}[-dark].png (logo cut out of
the grid background; "-dark" = navy parts turned light for dark mode) and the favicons
in frontend/app: favicon.ico / icon.svg (symbol only, thin white outline so it reads on
light and dark tabs) and apple-icon.png.
"""
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
APP = pathlib.Path(sys.argv[3])
PREVIEW = pathlib.Path(sys.argv[4])
OUT.mkdir(parents=True, exist_ok=True)
APP.mkdir(parents=True, exist_ok=True)

BG = np.array([220.0, 220.0, 220.0])
NAVY_LIGHT = np.array([241.0, 243.0, 255.0])   # what navy becomes in dark mode

img = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float64)
H, W, _ = img.shape
chroma = img.max(2) - img.min(2)
luma = img @ np.array([0.299, 0.587, 0.114])

hard = (chroma > 38) | (luma < 160)
# drop isolated JPEG specks
hard_img = Image.fromarray((hard * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
hard = np.asarray(hard_img) > 127


def shift(a, dy, dx, fill=0):
    out = np.full_like(a, fill)
    ys = slice(max(dy, 0), H + min(dy, 0))
    yd = slice(max(-dy, 0), H + min(-dy, 0))
    xs = slice(max(dx, 0), W + min(dx, 0))
    xd = slice(max(-dx, 0), W + min(-dx, 0))
    out[ys, xs] = a[yd, xd]
    return out


def erode(m, n):
    for _ in range(n):
        acc = m.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            acc &= shift(m, dy, dx, False)
        m = acc
    return m


def dilate(m, n):
    for _ in range(n):
        acc = m.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            acc |= shift(m, dy, dx, False)
        m = acc
    return m


interior = erode(hard, 2)
band = dilate(hard, 2) & ~interior

# Propagate solid foreground colours outward into the edge band.
F = np.where(interior[..., None], img, 0.0)
known = interior.copy()
for _ in range(8):
    acc = np.zeros_like(F)
    cnt = np.zeros((H, W))
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        k = shift(known, dy, dx, False)
        acc += np.where(k[..., None], shift(F, dy, dx, 0.0), 0.0)
        cnt += k
    newly = (~known) & (cnt > 0)
    F[newly] = acc[newly] / cnt[newly][:, None]
    known |= newly

# Alpha in the band: how far the pixel moved from background toward its foreground colour.
d_f = F - BG
d_c = img - BG
denom = (d_f * d_f).sum(2)
alpha = np.where(denom > 1, (d_c * d_f).sum(2) / np.maximum(denom, 1), 0.0)
alpha = np.clip(alpha, 0, 1)
alpha = np.where(interior, 1.0, np.where(band & known, alpha, 0.0))
alpha[alpha < 0.06] = 0
color = np.where(interior[..., None], img, F)

# Dark-mode recolour: navy (dark, low-ish chroma) -> near white, smoothly.
f_luma = color @ np.array([0.299, 0.587, 0.114])
f_chroma = color.max(2) - color.min(2)
w = np.clip((105 - f_luma) / 35, 0, 1) * np.clip((125 - f_chroma) / 30, 0, 1)
color_dark = color * (1 - w[..., None]) + NAVY_LIGHT * w[..., None]


def rgba(col, a):
    return Image.fromarray(np.dstack([np.clip(col, 0, 255), a * 255]).round().astype(np.uint8), "RGBA")


light = rgba(color, alpha)
dark = rgba(color_dark, alpha)


def bbox(y0, y1):
    a = alpha[y0:y1]
    ys, xs = np.where(a > 0.05)
    return xs.min(), y0 + ys.min(), xs.max() + 1, y0 + ys.max() + 1


rows_mark = (150, 704)
rows_word = (704, 1000)
mark_box = bbox(*rows_mark)
word_box = bbox(*rows_word)
full_box = (min(mark_box[0], word_box[0]), mark_box[1], max(mark_box[2], word_box[2]), word_box[3])
print("mark", mark_box, "word", word_box, "full", full_box)


def crop_pad(im, box, pad=8):
    x0, y0, x1, y1 = box
    return im.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))


def save(im, name, max_h=None, max_w=None):
    if max_h and im.height > max_h:
        im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(OUT / name, optimize=True)
    return im


assets = {}
for theme, src in (("", light), ("-dark", dark)):
    assets["mark" + theme] = save(crop_pad(src, mark_box), f"tickorbit-mark{theme}.png", max_h=256)
    assets["wordmark" + theme] = save(crop_pad(src, word_box), f"tickorbit-wordmark{theme}.png", max_h=128)
    assets["logo" + theme] = save(crop_pad(src, full_box, 16), f"tickorbit-logo{theme}.png", max_w=640)

# ---- Favicons: the symbol only, with a thin white outline so it reads on light AND dark tabs ----
import base64, io as _io
from PIL import ImageFilter as _IF

mark_hi = crop_pad(light, mark_box, 0)


def outlined(size, pad=0.04):
    """Symbol centred in a transparent square, with a white keyline around it."""
    ss = 8                                   # supersample for smooth edges
    big = size * ss
    inner = round(big * (1 - 2 * pad))
    m = mark_hi.copy()
    m.thumbnail((inner, inner), Image.LANCZOS)
    layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    layer.alpha_composite(m, ((big - m.width) // 2, (big - m.height) // 2))

    # Outline thickness in final pixels: ~1px at 16, growing slowly with size.
    stroke_px = max(1.0, size / 22)
    r = max(1, round(stroke_px * ss))
    a = layer.getchannel("A").point(lambda v: 255 if v > 40 else 0)
    halo = a.filter(_IF.MaxFilter(2 * r + 1 if (2 * r + 1) <= 255 else 255))
    halo = halo.filter(_IF.GaussianBlur(ss * 0.35))
    white = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    white.putalpha(halo)

    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    canvas.alpha_composite(white)
    canvas.alpha_composite(layer)
    out = canvas.resize((size, size), Image.LANCZOS)
    if size <= 48:
        out = out.filter(_IF.UnsharpMask(radius=0.5, percent=50, threshold=0))
    return out


ico_sizes = [16, 24, 32, 48, 64]
frames = [outlined(s) for s in ico_sizes]
frames[-1].save(APP / "favicon.ico", sizes=[(s, s) for s in ico_sizes], append_images=frames[:-1])

buf = _io.BytesIO(); outlined(128).save(buf, format="PNG", optimize=True)
(APP / "icon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">'
    f'<image width="128" height="128" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/></svg>',
    encoding="utf-8")

apple = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
m = mark_hi.copy(); m.thumbnail((144, 144), Image.LANCZOS)
apple.alpha_composite(m, ((180 - m.width) // 2, (180 - m.height) // 2))
apple.convert("RGB").save(APP / "apple-icon.png", optimize=True)

# Preview on the tab colours Chrome actually uses
tabs = [(255, 255, 255), (222, 225, 230), (53, 54, 58), (32, 32, 32), (0, 0, 0)]
sheet = Image.new("RGB", (760, 60 * len(tabs) + 20), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for i, bg in enumerate(tabs):
    y = 10 + i * 60
    d.rectangle((10, y, 750, y + 52), fill=bg)
    x = 30
    for s in (16, 32, 48):
        ic = outlined(s)
        tile_ = Image.new("RGBA", ic.size, bg + (255,)); tile_.alpha_composite(ic)
        sheet.paste(tile_.convert("RGB"), (x, y + 26 - s // 2)); x += s + 30
    for s in (16, 32):  # zoomed 16/32 to inspect pixels
        ic = outlined(s)
        tile_ = Image.new("RGBA", ic.size, bg + (255,)); tile_.alpha_composite(ic)
        z = tile_.convert("RGB").resize((48 if s == 16 else 48, 48), Image.NEAREST)
        sheet.paste(z, (x, y + 2)); x += 48 + 30
sheet.save(PREVIEW)
print("ok")
