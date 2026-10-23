"""Split a single-page Laya atlas and merge edited PNGs at their original positions."""

import argparse
import csv
import hashlib
import html
import json
from pathlib import Path
import shutil
import sys
from datetime import datetime, timezone

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow is required. Run: python -m pip install Pillow==13.0.0")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def save_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def rgba(path):
    with Image.open(path) as image:
        return image.convert("RGBA")


def inside(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"Path outside workspace: {relative}")
    return path


def validate_frames(atlas, image_size):
    frames = atlas["frames"]
    if not isinstance(frames, dict) or not frames:
        raise ValueError("Atlas frames must be a nonempty object")
    rectangles = []
    names = set()
    for name, item in frames.items():
        if Path(name).name != name or "/" in name or "\\" in name or not name.endswith(".png"):
            raise ValueError(f"Unsupported frame filename: {name}")
        if name.casefold() in names:
            raise ValueError(f"Duplicate filename on Windows: {name}")
        names.add(name.casefold())
        frame = item["frame"]
        x, y, w, h = (frame[k] for k in ("x", "y", "w", "h"))
        if not all(type(v) is int for v in (x, y, w, h)):
            raise ValueError(f"Non-integer rectangle: {name}")
        if frame.get("idx", 0) != 0 or item.get("rotated"):
            raise ValueError(f"Only unrotated single-page atlases are supported: {name}")
        if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > image_size[0] or y + h > image_size[1]:
            raise ValueError(f"Frame outside source image: {name}")
        for other, ox, oy, ow, oh in rectangles:
            if x < ox + ow and ox < x + w and y < oy + oh and oy < y + h:
                if (x, y, w, h) != (ox, oy, ow, oh):
                    raise ValueError(f"Partially overlapping frames: {name}, {other}")
        rectangles.append((name, x, y, w, h))
    return frames


def make_preview(root, entries):
    cards = []
    for entry in entries:
        label = " / ".join(entry["names"]) or entry["resourceKey"]
        search = html.escape(label + " " + entry["resourceKey"], quote=True)
        path = html.escape(entry["file"], quote=True)
        cards.append(f'<a class="card" href="{path}" data-search="{search}">'
                     f'<img src="{path}" loading="lazy"><b>{html.escape(label)}</b>'
                     f'<small>{html.escape(entry["resourceKey"])}</small></a>')
    document = """<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>原始卡牌预览</title><style>
body{font-family:system-ui,sans-serif;background:#202124;color:#eee;margin:24px}
input{font:inherit;padding:10px;width:360px;max-width:90%;margin:0 0 24px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:18px}
.card{display:flex;align-items:center;flex-direction:column;color:inherit;text-decoration:none;gap:6px}
img{width:140px;height:196px;object-fit:contain;background:#ddd}small{font-size:11px;overflow-wrap:anywhere}
[hidden]{display:none!important}</style>
<h1>原始卡牌预览</h1><p>点击图片查看对应 PNG。编辑 cards 文件夹中的图片，保留文件名和像素尺寸。</p>
<input placeholder="搜索牌名或纹理名" aria-label="搜索卡牌"><main>"""
    document += "\n".join(cards)
    document += """</main><script>
document.querySelector('input').addEventListener('input',e=>{
 const q=e.target.value.toLowerCase();
 document.querySelectorAll('.card').forEach(c=>c.hidden=!c.dataset.search.toLowerCase().includes(q));
});</script></html>"""
    (root / "preview.html").write_text(document, encoding="utf-8")


def split(atlas_path, image_path, root, names_index=None):
    root = root.resolve()
    if (root / "manifest.json").exists() or (root / "cards").exists():
        raise ValueError("Output already contains extracted cards; use a new folder to protect edits")
    atlas_bytes = atlas_path.read_bytes()
    atlas = json.loads(atlas_bytes)
    image = rgba(image_path)
    frames = validate_frames(atlas, image.size)
    labels = {}
    if names_index:
        for row in load_json(names_index):
            key = row.get("resourceKey")
            if key:
                labels.setdefault(key, {"names": set(), "ids": set()})
                if row.get("name"):
                    labels[key]["names"].add(row["name"])
                if row.get("id") is not None:
                    labels[key]["ids"].add(row["id"])
    (root / "source").mkdir(parents=True, exist_ok=True)
    (root / "cards").mkdir()
    original_path = root / "source" / "cards.png"
    original_atlas = root / "source" / "cards.atlas"
    if image_path.resolve() != original_path:
        shutil.copy2(image_path, original_path)
    if atlas_path.resolve() != original_atlas:
        shutil.copy2(atlas_path, original_atlas)
    entries = []
    rectangle_names = {}
    for name, item in frames.items():
        rectangle = tuple(item["frame"][k] for k in ("x", "y", "w", "h"))
        rectangle_names.setdefault(rectangle, []).append(name)
    for name, item in frames.items():
        f = item["frame"]
        crop = image.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
        relative = "cards/" + name
        crop.save(root / relative, format="PNG")
        key = name.removesuffix(".png")
        label = labels.get(key, {"names": set(), "ids": set()})
        entries.append({"name": name, "resourceKey": key,
                        "texturePath": atlas.get("meta", {}).get("prefix", "cards/") + name,
                        "file": relative, "names": sorted(label["names"]),
                        "cardIds": sorted(label["ids"]), "atlasEntry": item,
                        "sharedFrameNames": rectangle_names[tuple(f[k] for k in ("x", "y", "w", "h"))],
                        "rgbaSha256": digest(crop.tobytes())})
    manifest = {"format": "sgsol-card-atlas-v1", "createdAt": datetime.now(timezone.utc).isoformat(),
                "origin": "official atlas frames; no live baseCardTexMap memory was read",
                "image": {"file": "source/cards.png", "width": image.width, "height": image.height,
                          "sha256": digest(original_path.read_bytes()), "rgbaSha256": digest(image.tobytes())},
                "atlas": {"file": "source/cards.atlas", "sha256": digest(atlas_bytes), "meta": atlas.get("meta", {})},
                "namesSource": "2026-10-08 sys_playcard snapshot; labels only" if names_index else None,
                "sharedFrameGroups": [names for names in rectangle_names.values() if len(names) > 1],
                "frames": entries}
    save_json(root / "manifest.json", manifest)
    with (root / "card-index.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["纹理名", "名称", "文件", "x", "y", "宽", "高", "scale", "配置卡牌ID"])
        for entry in entries:
            f = entry["atlasEntry"]["frame"]
            writer.writerow([entry["resourceKey"], "/".join(entry["names"]), entry["file"],
                             f["x"], f["y"], f["w"], f["h"], entry["atlasEntry"].get("scale", 1),
                             ";".join(map(str, entry["cardIds"]))])
    make_preview(root, entries)
    return {"frames": len(entries), "uniqueRectangles": len(rectangle_names),
            "imageSize": list(image.size), "workspace": str(root)}


def compose(root):
    root = root.resolve()
    manifest = load_json(root / "manifest.json")
    if manifest["format"] != "sgsol-card-atlas-v1":
        raise ValueError("Unknown manifest format")
    image_path = inside(root, manifest["image"]["file"])
    atlas_path = inside(root, manifest["atlas"]["file"])
    if digest(image_path.read_bytes()) != manifest["image"]["sha256"]:
        raise ValueError("Original source image was modified; restore source/cards.png")
    atlas_bytes = atlas_path.read_bytes()
    if digest(atlas_bytes) != manifest["atlas"]["sha256"]:
        raise ValueError("Original source atlas was modified; restore source/cards.atlas")
    atlas = json.loads(atlas_bytes)
    image = rgba(image_path)
    frames = validate_frames(atlas, image.size)
    if len(manifest["frames"]) != len(frames) or {e["name"] for e in manifest["frames"]} != set(frames):
        raise ValueError("Manifest frame list differs from the source atlas")
    edited = []
    groups = {}
    for entry in manifest["frames"]:
        name = entry["name"]
        if entry["atlasEntry"] != frames[name]:
            raise ValueError(f"Manifest coordinates differ from the source atlas: {name}")
        f = frames[name]["frame"]
        crop = rgba(inside(root, entry["file"]))
        if crop.size != (f["w"], f["h"]):
            raise ValueError(f"{name}: expected {f['w']}x{f['h']}, got {crop.width}x{crop.height}; no automatic resizing")
        pixel_hash = digest(crop.tobytes())
        changed = pixel_hash != entry["rgbaSha256"]
        if changed:
            edited.append(name)
        rectangle = tuple(f[k] for k in ("x", "y", "w", "h"))
        groups.setdefault(rectangle, []).append((name, crop, pixel_hash, changed))
    shared_applied = []
    for (x, y, w, h), variants in groups.items():
        changes = [variant for variant in variants if variant[3]]
        if len({variant[2] for variant in changes}) > 1:
            raise ValueError("Conflicting edits to a shared rectangle: " + ", ".join(v[0] for v in changes))
        selected = changes[0] if changes else variants[0]
        # Paste without an alpha mask: exact RGBA replacement, including transparent RGB.
        image.paste(selected[1], (x, y))
        if changes and len(variants) > 1:
            shared_applied.append({"editedFile": selected[0], "affects": [v[0] for v in variants]})
    return image, atlas_bytes, manifest, edited, shared_applied


def merge(root, output=None):
    image, atlas_bytes, manifest, edited, shared_applied = compose(root)
    if output is None:
        output = root / "merged" / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    output = output.resolve()
    if output.exists():
        raise ValueError(f"Output directory already exists: {output}")
    output.mkdir(parents=True)
    image.save(output / "cards.png", format="PNG")
    (output / "cards.atlas").write_bytes(atlas_bytes)
    report = {"output": str(output), "frames": len(manifest["frames"]), "editedFrames": edited,
              "sharedFrameEdits": shared_applied,
              "imageSize": list(image.size), "rgbaSha256": digest(image.tobytes()),
              "pixelsIdenticalToOriginal": digest(image.tobytes()) == manifest["image"]["rgbaSha256"],
              "atlasUnchanged": True}
    save_json(output / "merge-report.json", report)
    return report


def verify(root):
    image, _, manifest, edited, _ = compose(root)
    equal = digest(image.tobytes()) == manifest["image"]["rgbaSha256"]
    report = {"frames": len(manifest["frames"]), "editedFrames": edited,
              "pixelsIdenticalToOriginal": equal, "imageSize": list(image.size)}
    if not equal:
        raise ValueError("Roundtrip is not identical to original (one or more cards have been edited)")
    save_json(root / "roundtrip-verification.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("split")
    p.add_argument("--atlas", type=Path, required=True)
    p.add_argument("--image", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--names-index", type=Path)
    p = sub.add_parser("merge")
    p.add_argument("--workspace", type=Path, required=True)
    p.add_argument("--output", type=Path)
    p = sub.add_parser("verify")
    p.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "split":
            result = split(args.atlas, args.image, args.out, args.names_index)
        elif args.command == "merge":
            result = merge(args.workspace, args.output)
        else:
            result = verify(args.workspace)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
