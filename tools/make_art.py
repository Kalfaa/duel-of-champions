#!/usr/bin/env python3
"""Build lightweight card art thumbnails and faction board backgrounds (served by game-client) from img/cards/."""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "img" / "cards"
ART = ROOT / "game-client" / "public" / "img" / "art"
BG = ROOT / "game-client" / "public" / "img" / "bg"
LOGO_CUT = 0.80  # the bottom ~20% of every artwork holds the Duel of Champions logo
BACKGROUNDS = {"havre": "Sun_crusader_card.jpg", "necropole": "Ghost_dragon_card.jpg", "inferno": "Abyssal_lord_card.jpg"}


def crop(im):
    w, h = im.size
    return im.crop((0, 0, w, int(h * LOGO_CUT)))


def main():
    ART.mkdir(parents=True, exist_ok=True)
    BG.mkdir(parents=True, exist_ok=True)
    for f in sorted(SRC.glob("*.jpg")):
        dest = ART / (f.stem + ".webp")
        if dest.exists():
            continue
        im = crop(Image.open(f).convert("RGB"))
        im.thumbnail((360, 440), Image.LANCZOS)
        im.save(dest, "WEBP", quality=82)
    for fac, f in BACKGROUNDS.items():
        im = crop(Image.open(SRC / f).convert("RGB"))
        im.thumbnail((900, 900), Image.LANCZOS)
        im = im.filter(ImageFilter.GaussianBlur(3))
        im = ImageEnhance.Brightness(im).enhance(0.55)
        im.save(BG / (fac + ".webp"), "WEBP", quality=75)
    print("done")


if __name__ == "__main__":
    main()
