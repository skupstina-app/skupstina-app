# Draws the site's logo (the pixel building from "Dolazi uskoro") into assets/icons/:
# favicon.svg, icon-192/512.png, icon-maskable-512.png, apple-touch-icon.png (180), favicon-32.png and og.png (1200x630).
# build.mjs serves them (src/generated/icons.js). Run again after changing LOGO:
#   python3 scripts/icons.py [folder with wix-madefor-display-{latin,latin-ext}-500-normal.woff2 from @fontsource]
import io, os, sys
from PIL import Image, ImageDraw, ImageFont

LOGO = """
...........#...........
...........#...........
...........#...........
..........###..........
.........#####.........
........#######........
.......#########.......
.......#-#-#-#-#.......
.......#########.......
.....#############.....
...#################...
.#####################.
..###################..
..#.#.#.#.....#.#.#.#..
..#.#.#.#.....#.#.#.#..
..#.#.#.#..#..#.#.#.#..
..#.#.#.#.###.#.#.#.#..
..#.#.#.#.###.#.#.#.#..
..#.#.#.#.###.#.#.#.#..
.#####################.
#######################
""".split()
FLAG = [(12, 0), (13, 0), (14, 0), (12, 1), (13, 1)]
W, H = len(LOGO[0]), len(LOGO)
BG, INK, MUTE, LIVE = (245, 245, 242), (23, 23, 23), (150, 150, 147), (31, 122, 114)
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")


def px():
    for y, row in enumerate(LOGO):
        for x, c in enumerate(row):
            if c == "#": yield x, y, INK
            elif c == "-": yield x, y, MUTE
    for x, y in FLAG: yield x, y, LIVE


def draw(img, ox, oy, s):
    d = ImageDraw.Draw(img)
    for x, y, c in px(): d.rectangle([ox + x * s, oy + y * s, ox + (x + 1) * s - 1, oy + (y + 1) * s - 1], fill=c)


def icon(size, pad):
    # whole pixels only, centred; pad = share of the side kept empty around the logo
    s = max(1, int(size * (1 - 2 * pad) / W))
    img = Image.new("RGB", (size, size), BG)
    draw(img, (size - W * s) // 2, (size - H * s) // 2 + s // 2, s)
    return img


def save(img, name):
    img.save(os.path.join(OUT, name), optimize=True)


def svg():
    # rows of runs → one path per colour; the page uses the same art inline
    runs = {"#": [], "-": []}
    for y, row in enumerate(LOGO):
        x = 0
        while x < W:
            c = row[x]
            if c in runs:
                e = x
                while e < W and row[e] == c: e += 1
                runs[c].append(f"M{x} {y}h{e - x}v1h-{e - x}z")
                x = e
            else: x += 1
    flag = "M12 0h3v1h-3zM12 1h2v1h-2z"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" shape-rendering="crispEdges">'
            f'<style>.i{{fill:#171717}}.m{{fill:#969693}}.f{{fill:#1f7a72}}@media(prefers-color-scheme:dark){{.i{{fill:#ecebe6}}.f{{fill:#5fc2b6}}}}</style>'
            f'<path class="i" d="{"".join(runs["#"])}"/><path class="m" d="{"".join(runs["-"])}"/><path class="f" d="{flag}"/></svg>')


def font(folder, sub, size):
    from fontTools.ttLib import TTFont
    f = TTFont(os.path.join(folder, f"wix-madefor-display-{sub}-500-normal.woff2"))
    f.flavor = None
    b = io.BytesIO(); f.save(b); b.seek(0)
    return ImageFont.truetype(b, size), set(f.getBestCmap())


def text(d, xy, s, fonts, fill):
    x, y = xy
    for ch in s:
        f = next((f for f, cmap in fonts if ord(ch) in cmap), fonts[0][0])
        d.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch)
    return x


def og(folder):
    img = Image.new("RGB", (1200, 630), BG)
    s = 14
    draw(img, 110, (630 - H * s) // 2, s)
    d = ImageDraw.Draw(img)
    big = [font(folder, "latin", 92), font(folder, "latin-ext", 92)]
    small = [font(folder, "latin", 38), font(folder, "latin-ext", 38)]
    text(d, (110 + W * s + 70, 205), "skupština.app", big, INK)
    text(d, (110 + W * s + 74, 335), "Narodna skupština uživo", small, (95, 95, 92))
    text(d, (110 + W * s + 74, 390), "prenos, poslanici, statistika", small, (95, 95, 92))
    save(img, "og.png")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save(icon(512, .14), "icon-512.png")
    save(icon(192, .14), "icon-192.png")
    save(icon(512, .22), "icon-maskable-512.png")
    save(icon(180, .14), "apple-touch-icon.png")
    save(icon(32, 0), "favicon-32.png")
    open(os.path.join(OUT, "favicon.svg"), "w").write(svg())
    if len(sys.argv) > 1: og(sys.argv[1])
    print("icons written to", os.path.normpath(OUT))
