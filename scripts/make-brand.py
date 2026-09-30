"""Mutiny's brand files: the logo (MUTINY spray-painted in pixel art, every
letter in the same hand as the icon's M: thick strokes, a slight lean, drips,
and the teal CRT ghost one pixel up-left) and the lockups, from one source.

The icon's M is the logo's first letter, stroke for stroke (make-icon.py M32).
Writes brand/*.svg and the copies the app uses (logo.svg), then PNGs with
rsvg-convert when it's installed.   python3 scripts/make-brand.py"""
import os, shutil, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, 'brand')
RED, TEAL, NIGHT, CREAM, INK = '#BE3F50', '#14B9B5', '#0e091d', '#e9e2d0', '#15101f'


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return ((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2) ** 0.5


# each letter: its width, its strokes (ax, ay, bx, by, width) and loose paint
# dots. Letters stand between y 5.5 and 26.5, like the icon's M; drips run below.
LETTERS = {
    'M': (23, [(2.0, 26.5, 3.5, 6.0, 4.4), (3.5, 6.0, 11.0, 19.0, 4.0), (11.0, 19.0, 17.5, 5.5, 4.0), (17.5, 5.5, 20.5, 26.0, 4.4),
               (1.8, 26.0, 1.8, 29.0, 2.0), (20.6, 25.5, 20.9, 28.0, 1.8), (11.0, 19.0, 11.0, 21.5, 1.6)], [(1, 30), (11, 23)]),
    'U': (19, [(3.0, 6.0, 3.4, 20.5, 4.4), (3.4, 20.5, 6.0, 25.2, 4.2), (6.0, 25.2, 11.6, 25.6, 4.2), (11.6, 25.6, 14.6, 20.5, 4.2),
               (14.6, 20.5, 15.2, 5.6, 4.4), (8.8, 26.0, 8.9, 29.2, 1.8)], [(9, 30)]),
    'T': (19, [(1.0, 7.2, 17.4, 6.0, 4.2), (9.0, 6.5, 9.6, 26.5, 4.4), (9.7, 26.0, 9.8, 29.6, 1.8), (16.8, 7.0, 16.9, 10.2, 1.6)], [(9, 31)]),
    'I': (8, [(3.2, 6.0, 3.6, 26.5, 4.4), (3.6, 26.0, 3.6, 28.6, 1.8)], []),
    'N': (20, [(2.4, 26.5, 3.2, 6.0, 4.4), (3.2, 6.0, 15.2, 25.8, 4.0), (15.2, 25.8, 16.0, 5.6, 4.4), (2.3, 26.0, 2.3, 29.2, 1.8)], [(2, 30)]),
    'Y': (20, [(2.0, 5.6, 9.2, 16.2, 4.2), (16.8, 5.0, 9.2, 16.2, 4.2), (9.2, 16.2, 9.5, 26.5, 4.4), (9.6, 26.0, 9.7, 29.8, 1.8)], [(10, 31)]),
}
GAP = 2


def paint(text, x0=0):
    """The painted pixels of a word, as a set of (x, y)."""
    pts = set()
    for ch in text:
        w, strokes, dots = LETTERS[ch]
        for y in range(0, 33):
            for x in range(-2, w + 2):
                cx, cy = x + 0.5, y + 0.5
                if any(seg_dist(cx, cy, ax, ay, bx, by) <= sw / 2 for (ax, ay, bx, by, sw) in strokes):
                    pts.add((x + x0, y))
        for (dx, dy) in dots:
            pts.add((dx + x0, dy))
        x0 += w + GAP
    return pts


def rects(pts, colour, dx=0, dy=0):
    """One <rect> per horizontal run of pixels — the same picture, a fraction of the size."""
    out = []
    rows = {}
    for (x, y) in pts:
        rows.setdefault(y, []).append(x)
    for y in sorted(rows):
        xs = sorted(rows[y])
        start = prev = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == prev + 1:
                prev = x
                continue
            out.append(f'<rect x="{start + dx}" y="{y + dy}" width="{prev - start + 1.02:g}" height="1.02"/>')
            if x is not None:
                start = prev = x
    return f'<g fill="{colour}">' + ''.join(out) + '</g>'


def svg(pts, mono=None, tile=None, pad=1, extra=''):
    """mono: one ink, no ghost. tile: a rounded background colour."""
    allp = set(pts) if mono else set(pts) | {(x - 1, y - 1) for (x, y) in pts}
    minx, miny = min(x for x, _ in allp) - pad, min(y for _, y in allp) - pad
    w, h = max(x for x, _ in allp) - minx + 1 + pad, max(y for _, y in allp) - miny + 1 + pad
    body = rects(pts, mono) if mono else rects(pts, TEAL, -1, -1) + rects(pts, RED)
    bg = f'<rect x="{minx}" y="{miny}" width="{w}" height="{h}" rx="{min(w, h) * 0.22:.2f}" fill="{tile}"/>' if tile else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx} {miny} {w} {h}" shape-rendering="crispEdges">'
            f'<title>Mutiny</title>{bg}{extra}{body}</svg>\n')


def main():
    os.makedirs(BRAND, exist_ok=True)
    word = paint('MUTINY')
    files = {
        'mutiny-logo.svg': svg(word),
        'mutiny-logo-light.svg': svg(word, mono=CREAM),
        'mutiny-logo-dark.svg': svg(word, mono=INK),
    }
    # the lockup: the icon tile, then the logo, on one baseline
    icon_src = open(os.path.join(ROOT, 'build', 'icon.svg')).read()
    for name, content in files.items():
        open(os.path.join(BRAND, name), 'w').write(content)
    shutil.copy(os.path.join(ROOT, 'build', 'icon.svg'), os.path.join(BRAND, 'mutiny-icon.svg'))
    # the app shows the logo in the manual and in About
    shutil.copy(os.path.join(BRAND, 'mutiny-logo.svg'), os.path.join(ROOT, 'logo.svg'))
    if shutil.which('rsvg-convert'):
        for h in (64, 128, 256, 512):
            subprocess.run(['rsvg-convert', '-h', str(h), os.path.join(BRAND, 'mutiny-logo.svg'), '-o', os.path.join(BRAND, f'mutiny-logo-{h}.png')], check=True)
        for s in (16, 32, 48, 64, 128, 256, 512, 1024):
            subprocess.run(['rsvg-convert', '-w', str(s), '-h', str(s), os.path.join(BRAND, 'mutiny-icon.svg'), '-o', os.path.join(BRAND, f'mutiny-icon-{s}.png')], check=True)
    print('brand files written to', BRAND)


if __name__ == '__main__':
    main()
