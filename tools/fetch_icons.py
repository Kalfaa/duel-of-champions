#!/usr/bin/env python3
"""Download the faction and magic school icons (served by game-client) from duelofchampions.fandom.com."""
import json, urllib.parse, urllib.request
from pathlib import Path

API = "https://duelofchampions.fandom.com/api.php"
ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "game-client" / "public" / "img"
UA = {"User-Agent": "duel-of-champions-fan-project/1.0",
      "Referer": "https://duelofchampions.fandom.com/"}
# dossier de destination -> {nom du fichier servi : fichier du wiki}
ICONS = {
    "faction": {"havre": "Haven.png", "necropole": "Necropolis.png", "inferno": "Inferno.png",
                "sanctuaire": "Sanctuary.png", "bastion": "Stronghold.png", "neutre": "Neutral.png"},
    "school": {"lumiere": "Light.png", "tenebres": "Dark.png", "feu": "Fire.png", "eau": "Water.png",
               "air": "Air.png", "terre": "Earth.png", "primordiale": "Primal.png"},
}


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
        return r.read()


def image_urls(files):
    params = dict(action="query", prop="imageinfo", iiprop="url", format="json", formatversion="2",
                  titles="|".join("File:" + f for f in files))
    pages = json.loads(fetch(API + "?" + urllib.parse.urlencode(params)))["query"]["pages"]
    return {p["title"][5:].replace(" ", "_"): p["imageinfo"][0]["url"] for p in pages}


def main():
    for folder, icons in ICONS.items():
        (IMG / folder).mkdir(parents=True, exist_ok=True)
        urls = image_urls(icons.values())
        for name, file in icons.items():
            # le CDN du wiki sert ces PNG en WebP
            (IMG / folder / (name + ".webp")).write_bytes(fetch(urls[file]))
    print("done")


if __name__ == "__main__":
    main()
