from PIL import Image, ImageDraw
from pathlib import Path
import struct
from io import BytesIO

OUT = Path('assets')
OUT.mkdir(parents=True, exist_ok=True)
BG = (10, 10, 10, 255)
FG = (245, 245, 245, 255)
TRANSPARENT = (0, 0, 0, 0)

def draw_ez_vector(draw, size):
    s = size / 512.0
    def R(x, y, w, h, r=8):
        draw.rounded_rectangle(
            (x * s, y * s, (x + w) * s - 1e-6, (y + h) * s - 1e-6),
            radius=max(1, int(r * s)),
            fill=FG,
        )
    R(118, 148, 48, 216, 8)
    R(118, 148, 140, 44, 8)
    R(118, 234, 118, 44, 8)
    R(118, 320, 140, 44, 8)
    R(278, 148, 116, 44, 8)
    R(278, 320, 116, 44, 8)
    pts = [(378 * s, 192 * s), (310 * s, 320 * s), (278 * s, 320 * s), (346 * s, 192 * s)]
    draw.polygon(pts, fill=FG)

def draw_ez_pixel(img, size):
    px = img.load()
    d = ImageDraw.Draw(img)
    rad = max(2, round(size * 108 / 512))
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=rad, fill=BG)
    def fill_rect(x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < size and 0 <= y < size:
                    px[x, y] = FG
    if size == 16:
        fill_rect(2, 3, 3, 12); fill_rect(2, 3, 6, 4); fill_rect(2, 7, 5, 8); fill_rect(2, 11, 6, 12)
        fill_rect(8, 3, 13, 4); fill_rect(8, 11, 13, 12)
        for i, x in enumerate(range(12, 7, -1)):
            fill_rect(x - 1, 5 + i, x, 5 + i)
    elif size == 20:
        fill_rect(3, 4, 4, 15); fill_rect(3, 4, 8, 5); fill_rect(3, 9, 7, 10); fill_rect(3, 14, 8, 15)
        fill_rect(10, 4, 16, 5); fill_rect(10, 14, 16, 15)
        for i, x in enumerate(range(15, 9, -1)):
            y = 6 + i
            if y <= 13: fill_rect(x - 1, y, x, y)
    elif size == 24:
        fill_rect(3, 5, 5, 18); fill_rect(3, 5, 10, 7); fill_rect(3, 11, 9, 13); fill_rect(3, 16, 10, 18)
        fill_rect(12, 5, 20, 7); fill_rect(12, 16, 20, 18)
        for i in range(8):
            x = 18 - i; y = 8 + i; fill_rect(x - 1, y, x, y + 1)
    elif size == 32:
        fill_rect(5, 7, 8, 24); fill_rect(5, 7, 14, 10); fill_rect(5, 14, 12, 17); fill_rect(5, 21, 14, 24)
        fill_rect(17, 7, 26, 10); fill_rect(17, 21, 26, 24)
        for i in range(10):
            x = 24 - i; y = 11 + i; fill_rect(x - 1, y, x + 1, y + 1)
    else:
        draw_ez_vector(d, size)

def make_icon(size):
    if size <= 32:
        img = Image.new('RGBA', (size, size), TRANSPARENT)
        draw_ez_pixel(img, size)
        return img
    scale = 4
    big = size * scale
    big_img = Image.new('RGBA', (big, big), TRANSPARENT)
    bd = ImageDraw.Draw(big_img)
    brad = max(2, round(big * 108 / 512))
    bd.rounded_rectangle((0, 0, big - 1, big - 1), radius=brad, fill=BG)
    draw_ez_vector(bd, big)
    return big_img.resize((size, size), Image.Resampling.LANCZOS)

sizes = [16, 20, 24, 32, 48, 64, 128, 256, 512]
images = {}
for s in sizes:
    images[s] = make_icon(s)
    images[s].save(OUT / f'icon-{s}.png')
images[512].save(OUT / 'icon.png')

# Proper multi-PNG ICO
ico_sizes = [16, 24, 32, 48, 64, 128, 256]
entries = []
for s in ico_sizes:
    buf = BytesIO(); images[s].save(buf, format='PNG'); entries.append((s, buf.getvalue()))
header = struct.pack('<HHH', 0, 1, len(entries))
offset = 6 + 16 * len(entries)
dir_entries = b''; blobs = b''
for s, data in entries:
    w = 0 if s >= 256 else s; h = 0 if s >= 256 else s
    dir_entries += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(data), offset)
    blobs += data; offset += len(data)
(OUT / 'icon.ico').write_bytes(header + dir_entries + blobs)
(OUT / 'README.md').write_text('Black squircle + soft white EZ. Multi-size PNG/ICO; 16-32 pixel-tuned for tray/taskbar.\n', encoding='utf-8')
print('ok ico', (OUT / 'icon.ico').stat().st_size)
for s in sizes:
    print(s, (OUT / f'icon-{s}.png').stat().st_size)
