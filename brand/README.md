# Mutiny — brand

<p><img src="mutiny-logo.svg" alt="Mutiny" width="420"></p>

Words start mutinies. Mutiny's mark is spray paint on a screen: **MUTINY** painted in pixel art, every letter in the same hand — thick strokes with a slight lean, paint that drips — with a teal ghost one pixel up and to the left, like a CRT picking up a signal it shouldn't. The icon is the logo's first letter, **M**, pixel for pixel. Its hand comes from the graffiti logo of Mutiny in *Halt and Catch Fire*.

## Files

| File | Use |
|---|---|
| `mutiny-logo.svg` · `mutiny-logo-{64,128,256,512}.png` | The logo, in colour |
| `mutiny-logo-light.svg` | One ink, light — on dark backgrounds, shirts, stickers |
| `mutiny-logo-dark.svg` | One ink, dark — on light backgrounds, print |
| `mutiny-icon.svg` · `mutiny-icon-{16…1024}.png` | The icon (the app, the favicon, avatars) |
| `favicon.ico` | 16, 32 and 48 px |

All of it comes from `scripts/make-brand.py` (the logo) and `scripts/make-icon.py` (the icon). Change the drawing there, never by hand, and run `python3 scripts/make-brand.py`.

## Colours

| | |
|---|---|
| Red | `#BE3F50` |
| Teal (the ghost) | `#14B9B5` |
| Night (the background) | `#0e091d` |
| Cream (one ink, light) | `#e9e2d0` |

## Using it

- **Size:** the logo needs at least **24 px of height**; below that the drips and the ghost clog up, so use the icon alone.
- **Room:** keep clear space around it at least the height of the icon's drips (about a seventh of the logo's height).
- **Pixels stay square:** scale by whole steps where you can, and use `image-rendering: pixelated` on the web.
- **Don't** redraw the letters, stretch them, recolour the red and teal separately, add effects or set "Mutiny" in another typeface next to it as if it were the logo.
- On a light background, use `mutiny-logo-dark.svg`: the colour logo is made for the night.
