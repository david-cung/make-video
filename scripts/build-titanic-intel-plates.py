"""Build small, deterministic Remotion plates and project Natural Earth coastlines."""

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def low_frequency(rng, size, grid):
    samples = rng.integers(0, 256, (grid[1], grid[0]), dtype=np.uint8)
    return np.asarray(Image.fromarray(samples).resize(size, Image.Resampling.BICUBIC)) / 255 - .5


def sky(output, rng):
    width, height = 1280, 720
    y, x = np.mgrid[0:1:height*1j, 0:1:width*1j]
    horizon = np.exp(-((y - .67) / .15) ** 2) * np.exp(-((x - .62) / .49) ** 2)
    clouds = low_frequency(rng, (width, height), (15, 7)) * (4 + 13 * horizon)
    grain = low_frequency(rng, (width, height), (260, 180)) * 3
    pixels = np.stack([6 + 24 * horizon, 12 + 40 * horizon, 23 + 52 * horizon], axis=-1)
    image = Image.fromarray(np.uint8(np.clip(pixels + (clouds + grain)[..., None], 0, 255)))
    draw = ImageDraw.Draw(image)
    for _ in range(112):
        xx, yy, level = rng.integers([0, 0, 34], [width, height // 2, 102])
        draw.point((int(xx), int(yy)), fill=(int(level*.76), int(level*.86), int(level)))
    image.save(output / "sky.jpg", quality=89, optimize=True)


def water(output, rng, foreground):
    width, height = 1280, 330 if foreground else 420
    image = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(image)
    if not foreground:
        for y in range(height):
            depth = y / height
            draw.line((0, y, width, y), fill=(7, round(24 - depth*11), round(38 - depth*13), min(255, y*18)))
    strokes = 420 if foreground else 1050
    for _ in range(strokes):
        depth = float(rng.uniform(.02, 1))
        y = round(depth * height)
        x = round(float(rng.uniform(-170, width)))
        length = round(float(rng.uniform(6, 92)) * (1.1 + (2.2 if foreground else 1.1) * depth))
        opacity = round(float(rng.uniform(12, 105)) * min(1, .30 + depth))
        color = (55, 92, 108, opacity) if foreground else (34, 63, 79, opacity)
        variation = round(float(rng.uniform(-4, 4)) * depth)
        draw.line([(x,y), (x+length*.27,y+variation), (x+length*.65,y+1), (x+length,y+max(0, variation//2))],
                  fill=color, width=max(1, round(depth * (4 if foreground else 2))))
    if not foreground:
        base = Image.new("RGBA", image.size, (7, 20, 32, 255))
        base.alpha_composite(image)
        base.convert("RGB").save(output / "far-water.jpg", quality=87, optimize=True)
    else:
        image.save(output / "near-water.png", optimize=True)


def iceberg(output, rng):
    width, height = 700, 470
    size = (width, height)
    y, x = np.mgrid[0:1:height*1j, 0:1:width*1j]
    noise = (low_frequency(rng, size, (10, 10))*41 + low_frequency(rng, size, (50, 36))*16 +
             np.asarray(rng.normal(0, 2.5, (height, width))))
    shape = [(12,432),(91,407),(135,370),(195,356),(227,280),(260,245),(312,196),(351,121),
             (376,112),(409,65),(445,90),(478,143),(528,204),(548,268),(607,305),(644,355),(692,426),
             (590,446),(462,441),(372,453),(232,441),(134,449)]
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon(shape, fill=255)
    facets = Image.new("RGB", size, (79, 114, 140))
    d = ImageDraw.Draw(facets)
    d.polygon([(85,413),(227,280),(351,121),(409,65),(379,196),(320,295),(360,438)], fill=(113,151,174))
    d.polygon([(409,65),(445,90),(548,268),(689,427),(495,396),(422,272),(379,196)], fill=(56,89,116))
    d.polygon([(232,441),(286,309),(320,295),(379,196),(365,330),(409,415),(372,453)], fill=(65,100,131))
    d.polygon([(379,196),(422,272),(495,396),(409,415),(365,330)], fill=(97,137,162))
    d.line([(135,370),(223,319),(276,262),(351,121),(409,65),(445,90),(478,143)], fill=(157,182,195), width=4)
    for _ in range(100):
        xx, yy = rng.integers([50,75],[650,430])
        n = int(rng.integers(14, 70))
        d.line([(xx,yy),(xx-n*.26,yy-n*.45),(xx-n*.47,yy-n)], fill=(87,120,146), width=1)
    brightness = noise - 34 * y + 10 * np.exp(-((x-.52)/.32)**2)
    colored = np.asarray(facets.filter(ImageFilter.GaussianBlur(.5))).astype(float) + brightness[...,None]
    plate = Image.fromarray(np.uint8(np.clip(colored, 0, 255))).convert("RGBA")
    plate.putalpha(mask.filter(ImageFilter.GaussianBlur(.7)))
    plate.save(output / "iceberg.png", optimize=True)


def outline(data, path):
    def project(point):
        lon, lat = point
        return round(150 + (lon + 83) * 16.4), round(116 + (66-lat) * 23.4)

    def inside(ring):
        xs, ys = zip(*ring)
        return max(xs) > -89 and min(xs) < 26 and max(ys) > 26 and min(ys) < 72

    features = json.loads(data.read_text(encoding="utf8"))["features"]
    paths = []
    for feature in features:
        geo = feature["geometry"]
        polygons = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
        for polygon in polygons:
            for ring in polygon:
                if inside(ring):
                    paths.append("M" + "L".join(f"{x} {y}" for x, y in map(project, ring)) + "Z")
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><g fill="#27444e" stroke="#57757c" stroke-width="1.45" fill-rule="evenodd">'
    path.write_text(svg + '<path d="' + "".join(paths) + '"/></g></svg>\n', encoding="utf8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("coastline", type=Path, help="Natural Earth 1:110m land GeoJSON")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    random = np.random.default_rng(19120414)
    sky(args.output, random)
    water(args.output, random, foreground=False)
    water(args.output, random, foreground=True)
    iceberg(args.output, random)
    outline(args.coastline, args.output / "atlantic-land.svg")
