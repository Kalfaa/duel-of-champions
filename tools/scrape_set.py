#!/usr/bin/env python3
"""Scrape the cards of a set (stats + images) from mightandmagic.fandom.com.

Usage: scrape_set.py ["Wiki page of the set" output.json]   (default: "Base set 1" data/base_set_1.json)
"""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

API = "https://mightandmagic.fandom.com/api.php"
ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "img" / "cards"
UA = {"User-Agent": "duel-of-champions-fan-project/1.0",
      "Referer": "https://mightandmagic.fandom.com/"}
NUM = {"resource", "might", "magic", "destiny", "attack", "retaliate", "health"}


def api(**params):
    params.update(format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
        return json.load(r)


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def card_titles(page):
    text = api(action="parse", page=page, prop="wikitext")["parse"]["wikitext"]
    table = text.split("==Card list==", 1)[1]
    return [m.split("|")[0] for m in re.findall(r"^\|\[\[([^\]]+)\]\]", table, re.M)]


def extract_template(text, name="DoCcard"):
    start = text.find("{{" + name)
    if start < 0:
        return None
    depth, i = 0, start
    while i < len(text):
        if text.startswith("{{", i):
            depth += 1; i += 2
        elif text.startswith("}}", i):
            depth -= 1; i += 2
            if depth == 0:
                return text[start + 2 + len(name):i - 2]
        else:
            i += 1
    return None


def split_params(body):
    """Split on top-level '|' (ignoring nested {{ }} and [[ ]])."""
    parts, depth, cur, i = [], 0, "", 0
    while i < len(body):
        two = body[i:i + 2]
        if two in ("{{", "[["):
            depth += 1; cur += two; i += 2; continue
        if two in ("}}", "]]"):
            depth -= 1; cur += two; i += 2; continue
        if body[i] == "|" and depth == 0:
            parts.append(cur); cur = ""
        else:
            cur += body[i]
        i += 1
    parts.append(cur)
    out = {}
    for p in parts:
        if "=" in p:
            k, v = p.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def clean_desc(s):
    s = re.sub(r"\{\{DoC ability\|([^}|]+)[^}]*\}\}", r"[\1]", s)
    s = re.sub(r"<hr\s*/?>", "\n", s)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"\{\{[^}|]*\|?([^}]*)\}\}", r"\1", s)
    s = re.sub(r"'''?", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"[ \t]+", " ", s).strip()


def to_card(title, p):
    card = {"name": title.split(" (card)")[0], "page": title}
    for k in ("type", "faction", "rarity", "expansion"):
        card[k] = p.get(k, "")
    card["subtype"] = p.get("type 2") or p.get("type2") or ""
    for k in NUM:
        v = p.get(k, "")
        card[k] = int(v) if re.fullmatch(r"-?\d+", v) else (v or None)
    card["schools"] = [p[k] for k in ("som1", "som2", "som3") if p.get(k)]
    card["description"] = clean_desc(p.get("desc", ""))
    card["description_raw"] = p.get("desc", "")
    card["image_file"] = p.get("image", "")
    if p.get("image2"):
        card["image2_file"] = p["image2"]
    return card


def main():
    page, out = (sys.argv[1], sys.argv[2]) if len(sys.argv) == 3 else ("Base set 1", "data/base_set_1.json")
    out_json = ROOT / out
    titles = card_titles(page)
    print(f"{len(titles)} cards listed")
    cards = {}
    for batch in chunks(titles, 50):
        res = api(action="query", prop="revisions", rvprop="content", rvslots="main",
                  titles="|".join(batch), redirects=1)
        redirect = {r["to"]: r["from"] for r in res["query"].get("redirects", [])}
        norm = {n["to"]: n["from"] for n in res["query"].get("normalized", [])}
        for page in res["query"]["pages"]:
            if "revisions" not in page:
                print("  missing:", page["title"]); continue
            text = page["revisions"][0]["slots"]["main"]["content"]
            body = extract_template(text)
            if body is None:
                print("  no template:", page["title"]); continue
            t = page["title"]
            orig = redirect.get(t, t); orig = norm.get(orig, orig)
            cards[orig] = to_card(t, split_params(body))
        time.sleep(0.5)

    ordered = [cards[t] for t in titles if t in cards]

    # Resolve image URLs
    files = sorted({f for c in ordered for f in (c["image_file"], c.get("image2_file")) if f})
    urls = {}
    for batch in chunks(files, 50):
        res = api(action="query", prop="imageinfo", iiprop="url",
                  titles="|".join("File:" + f for f in batch))
        norm = {n["to"]: n["from"] for n in res["query"].get("normalized", [])}
        for page in res["query"]["pages"]:
            if page.get("imageinfo"):
                name = re.sub(r"^File:", "", norm.get(page["title"], page["title"]))
                urls[name.replace("_", " ")] = page["imageinfo"][0]["url"]
        time.sleep(0.5)

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    for c in ordered:
        for key in ("image_file", "image2_file"):
            f = c.get(key)
            if not f:
                continue
            url = urls.get(f.replace("_", " "))
            local_key = key.replace("_file", "")
            if not url:
                print("  no image url:", f); c[local_key] = None; continue
            dest = IMG_DIR / re.sub(r"[^\w.-]+", "_", f)
            if not dest.exists():
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
                    dest.write_bytes(r.read())
                time.sleep(0.2)
            c[local_key] = str(dest.relative_to(ROOT))
            c[local_key + "_url"] = url

    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(ordered, ensure_ascii=False, indent=2))
    print(f"wrote {len(ordered)} cards to {out_json}")


if __name__ == "__main__":
    main()
