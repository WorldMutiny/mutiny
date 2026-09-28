"""Pixel-art M for Mutiny's icon, inspired by the graffiti M of the show's
logo: four spray-paint strokes (left leg, two diagonals, right leg) rasterised
on a small grid, plus paint drips. Output: SVG, one <rect> per pixel.

The app uses variant C (the 32x32 M with a teal CRT offset). build/icon.svg is
that tile at 824 px centred on a 1024 canvas (Apple's icon grid); build/icon.png
is it rendered: rsvg-convert -w 1024 -h 1024 build/icon.svg -o build/icon.png"""
import math, json, sys, os

OUT = os.path.dirname(os.path.abspath(__file__))

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

def raster(n, strokes, dots=()):
    grid = [[0] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            cx, cy = x + 0.5, y + 0.5
            for (ax, ay, bx, by, w) in strokes:
                if seg_dist(cx, cy, ax, ay, bx, by) <= w / 2:
                    grid[y][x] = 1
    for (x, y) in dots:
        grid[y][x] = 1
    return grid

# 32 × 32: the hand-drawn M — the left leg leans in, the right one out,
# the diagonals meet low, like the logo's
M32 = [
    (7.0, 26.5, 8.5, 6.0, 4.4),    # left leg
    (8.5, 6.0, 16.0, 19.0, 4.0),   # down to the middle
    (16.0, 19.0, 22.5, 5.5, 4.0),  # up to the right
    (22.5, 5.5, 25.5, 26.0, 4.4),  # right leg
    (6.8, 26.0, 6.8, 29.0, 2.0),   # drip under the left leg
    (25.6, 25.5, 25.9, 28.0, 1.8), # shorter drip on the right
    (16.0, 19.0, 16.0, 21.5, 1.6), # a small drip from the middle
]
DOTS32 = [(6, 30), (16, 23)]

# 16 × 16: the same M, chunkier
M16 = [(3.4, 13.4, 4.2, 3.0, 2.6), (4.2, 3.0, 8.0, 9.6, 2.2), (8.0, 9.6, 11.4, 2.8, 2.2),
       (11.4, 2.8, 12.8, 13.0, 2.6), (3.2, 13.0, 3.2, 14.6, 1.2)]
DOTS16 = [(12, 14)]

BG = '#0e091d'
RED = '#BE3F50'      # Aetheria's accent — Mutiny's red on screen
LOGO_RED = '#A6021E' # the show's logo red, deeper
TEAL = '#14B9B5'

def svg(grid, size=512, pad=0.16, bg=True, color=RED, glitch=None, radius=0.22):
    n = len(grid)
    inner = size * (1 - 2 * pad)
    px = inner / n
    off = size * pad
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" shape-rendering="crispEdges">']
    if bg:
        parts.append(f'<rect width="{size}" height="{size}" rx="{size * radius:.0f}" fill="{BG}"/>')
    if glitch:  # a teal copy one pixel left-and-up, under the red: a CRT misregistration
        gx, gy = glitch
        for y in range(n):
            for x in range(n):
                if grid[y][x]:
                    parts.append(f'<rect x="{off + (x + gx) * px:.2f}" y="{off + (y + gy) * px:.2f}" width="{px:.2f}" height="{px:.2f}" fill="{TEAL}"/>')
    for y in range(n):
        for x in range(n):
            if grid[y][x]:
                parts.append(f'<rect x="{off + x * px:.2f}" y="{off + y * px:.2f}" width="{px + 0.02:.2f}" height="{px + 0.02:.2f}" fill="{color}"/>')
    parts.append('</svg>')
    return ''.join(parts)

g32 = raster(32, M32, DOTS32)
g16 = raster(16, M16, DOTS16)
variants = {
    'A': svg(g16, color=RED),
    'B': svg(g32, color=RED),
    'C': svg(g32, color=RED, glitch=(-1, -1)),
}
for k, v in variants.items():
    open(os.path.join(OUT, f'mutiny-icon-{k}.svg'), 'w').write(v)
# the small sizes the systems also show (taskbar, dock): how each reads at 32 px
json.dump(variants, open(os.path.join(OUT, 'variants.json'), 'w'))
print('\n'.join(''.join('█' if c else '·' for c in row) for row in g32))
