# Draws the "coming soon" avatar tiles and the empty avatar, in the same frame and scale as the real
# avatars (assets/avatars/64): 64x64, a 2 px dark frame with notched corners, a flat background with the
# Assembly building in two darker shades of it, and a person's outline in front.
# Run: python3 scripts/avatar-placeholders.py  (needs Pillow) → assets/avatars/uskoro/*.png
from pathlib import Path
from PIL import Image

FRAME = (18, 14, 28)
OUT = Path(__file__).resolve().parent.parent / "assets/avatars/uskoro"
TILES = {  # name: background (same saturation as the red, yellow and blue of the real ones)
    "prazno": (196, 194, 186),
    "1": (46, 168, 74),
    "2": (247, 122, 26),
    "3": (126, 74, 230),
    "4": (22, 164, 154),
    "5": (236, 84, 150),
    "6": (64, 176, 238),
    "7": (150, 196, 42),
    "8": (176, 104, 62),
}


def shade(c, k):
    return tuple(round(v * k) for v in c)


def draw(bg):
    im = Image.new("RGB", (64, 64), bg)
    px = im.load()
    t1, t2, fig = shade(bg, 0.88), shade(bg, 0.77), shade(bg, 0.6)

    def rect(x0, y0, x1, y1, c):  # inclusive
        for y in range(max(y0, 2), min(y1, 61) + 1):
            for x in range(max(x0, 2), min(x1, 61) + 1):
                px[x, y] = c

    def tri(cx, top, base, half, c):  # pediment: one step wider every row
        for i, y in enumerate(range(top, base + 1)):
            w = round(i * half / max(1, base - top))
            rect(cx - w, y, cx + w, y, c)

    # building: pavilions on both sides, colonnade, central block with pediment, drum and dome
    for cx in (8, 55):
        tri(cx, 13, 18, 6, t2)
        rect(cx - 6, 19, cx + 6, 34, t1)
        for x in range(cx - 5, cx + 6, 3):
            rect(x, 21, x, 33, t2)
    rect(14, 22, 49, 34, t1)
    for x in range(15, 49, 3):
        rect(x, 24, x, 33, t2)
    tri(32, 17, 23, 13, t2)
    rect(23, 14, 41, 16, t1)
    for y in range(5, 14):  # dome
        r = round((1 - ((13 - y) / 9) ** 2) ** 0.5 * 9)
        rect(32 - r, y, 31 + r, y, t2)
    rect(31, 2, 32, 4, t2)
    rect(2, 34, 61, 34, t2)

    # a person in front: head, neck, shoulders with rounded tops
    for y in range(20, 39):
        r = round((1 - ((29 - y) / 9.5) ** 2) ** 0.5 * 8.5)
        rect(32 - r, y, 31 + r, y, fig)
    rect(29, 38, 34, 41, fig)
    for y in range(41, 62):
        d = y - 41  # rounded shoulders: a quarter circle of radius 11 on each side
        inset = 11 - round((121 - (11 - d) ** 2) ** 0.5) if d < 11 else 0
        rect(10 + inset, y, 53 - inset, y, fig)
    rect(30, 42, 33, 47, shade(bg, 0.7))  # collar

    # frame: 2 px, notched corners (the outer corner pixels stay white, as in the real ones)
    for i in range(64):
        for j in (0, 1, 62, 63):
            px[i, j] = FRAME
            px[j, i] = FRAME
    for (x, y) in ((0, 0), (1, 0), (0, 1)):
        for fx, fy in ((x, y), (63 - x, y), (x, 63 - y), (63 - x, 63 - y)):
            px[fx, fy] = (255, 255, 255)
    return im


OUT.mkdir(parents=True, exist_ok=True)
for name, bg in TILES.items():
    draw(bg).save(OUT / f"{name}.png", optimize=True)
print("wrote", len(TILES), "tiles to", OUT)
