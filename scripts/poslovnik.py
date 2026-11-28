"""Poslovnik Narodne skupštine (prečišćeni tekst) from the Assembly's own page -> assets/poslovnik.json.

Run again when the Rules change:  python3 scripts/poslovnik.py
Output: {"src", "at", "a": [{"n": "107", "g": glava, "o": odeljak, "s": [[stav, alineja, ...], ...]}]}
A stav is a paragraph; "- ..." paragraphs and inline "1) ... 2) ..." are its items (alineje / tačke)."""
import html, json, re, sys, urllib.request, datetime, pathlib

URL = "https://www.parlament.gov.rs/narodna-skupstina-/vazna-dokumenta/poslovnik-(precisceni-tekst)/ceo-poslovnik-(precisceni-tekst).1423.html"
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "poslovnik.json"


def parse(page):
    a, b = page.find("<!-- print_start -->"), page.find("<!-- print_end -->")
    if a < 0 or b < 0:
        raise SystemExit("page layout changed: print_start/print_end markers missing")
    toks = re.findall(r"<(h3|p)([^>]*)>(.*?)</\1>", page[a:b], re.S)
    txt = lambda x: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", x)).replace("\xa0", " ")).strip()
    arts, g, o = [], "", ""
    for tag, attr, body in toks:
        t = txt(body)
        if not t:
            continue
        if tag == "h3":
            # the page was transliterated from Cyrillic: "IH." is IX (Х→H), "KONSTITUISANjE" is KONSTITUISANJE
            t = re.sub(r"^([IVXH]+)\.", lambda m: m[1].replace("H", "X") + ".", t)
            g, o = re.sub(r"(?<=[A-ZČĆŠŽĐ])(Nj|Lj|Dž)", lambda m: m[1].upper(), t), ""
            continue
        if "preamble" in attr:
            o = t
            continue
        m = re.fullmatch(r"Član\s*(\d+)\s*([a-z]?)\.?", t)
        if m:
            arts.append({"n": m[1] + m[2], "g": g, "o": o, "s": []})
            continue
        if not arts:
            continue
        s = arts[-1]["s"]
        if t.startswith("-") and s:
            s[-1].append(t.lstrip("- ").strip())
            continue
        # "1) Odbor za ..., 2) Odbor za ..." in one paragraph: the lead, then one item per number
        parts = re.split(r"\s(?=\d{1,2}\)\s)", t)
        s.append(parts if len(parts) > 2 else [t])
    nums = [x["n"] for x in arts]
    if len(arts) < 250 or len(set(nums)) != len(nums) or nums[:3] != ["1", "2", "3"]:
        raise SystemExit(f"unexpected parse: {len(arts)} articles, first {nums[:3]}")
    return arts


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else None  # optional saved copy of the page, for testing
    page = open(src, encoding="utf-8").read() if src else urllib.request.urlopen(
        urllib.request.Request(URL, headers={"user-agent": "Mozilla/5.0 skupstina.app"}), timeout=60).read().decode("utf-8")
    arts = parse(page)
    OUT.write_text(json.dumps({"src": URL, "at": datetime.date.today().isoformat(), "a": arts}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(arts)} članova -> {OUT}")
