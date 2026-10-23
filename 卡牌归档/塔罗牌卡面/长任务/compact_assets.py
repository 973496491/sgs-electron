"""Small viewing copies of committed cards; original PNGs and records are immutable."""
from pathlib import Path
from io import BytesIO
from datetime import datetime, timezone
import hashlib
import html
import json
from PIL import Image

HERE = Path(__file__).resolve().parent
CARDS = HERE.parent / "生产底图"
OUTPUT = CARDS / "压缩预览"
LIMIT = 200_000
PROFILE = "webp-max744x1040-under200000-v1"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".next")
    temporary.write_bytes(data)
    temporary.replace(path)


def encode(source):
    with Image.open(source) as image:
        image = image.convert("RGBA")
        for maximum in ((744, 1040), (558, 780), (465, 650)):
            resized = image.copy()
            resized.thumbnail(maximum, Image.Resampling.LANCZOS)
            for quality in (86, 80, 74, 66):
                buffer = BytesIO()
                resized.save(buffer, "WEBP", quality=quality, method=4, exact=True)
                data = buffer.getvalue()
                if len(data) <= LIMIT:
                    return data, list(resized.size), quality
    raise ValueError(f"Cannot satisfy viewing-copy size limit: {source}")


def synchronize(create_page=False):
    state = read(HERE / "runtime/state.json")
    tasks = read(HERE / "tasks.json")["tasks"]
    index = OUTPUT / "manifest.json"
    previous = read(index) if index.exists() else {"cards": []}
    cached = {item["id"]: item for item in previous["cards"]}
    entries = []
    for task in tasks:
        task_id = task["id"]
        if task_id not in state["done"]:
            continue
        record = read(HERE / "子任务" / f"{task_id}.json")
        native = record["production"]["native"]
        production = record["production"]["export"]
        production_path = Path(production["path"])
        if production_path.stat().st_size > LIMIT:
            raise ValueError(f"Production PNG exceeds 200 KB: {task_id}")
        target = OUTPUT / f"{task_id}.webp"
        item = cached.get(task_id)
        if not (item and item.get("profile") == PROFILE and item["sourceSha256"] == native["sha256"]
                and target.is_file() and digest(target.read_bytes()) == item["sha256"]):
            source = Path(native["path"])
            if digest(source.read_bytes()) != native["sha256"]:
                raise ValueError(f"Original PNG changed: {task_id}")
            data, size, quality = encode(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists() and target.read_bytes() != data:
                raise ValueError(f"Refusing to replace a different viewing copy: {target}")
            if not target.exists():
                with target.open("xb") as stream:
                    stream.write(data)
            with Image.open(target) as reopened:
                reopened.load()
                if reopened.format != "WEBP" or list(reopened.size) != size:
                    raise ValueError(f"Viewing copy failed readback: {target}")
            item = {"id": task_id, "file": target.name, "bytes": len(data), "size": size,
                    "sha256": digest(data), "sourceSha256": native["sha256"], "sourceBytes": native["bytes"],
                    "profile": PROFILE, "quality": quality, "encoderMethod": 4, "role": "lossy viewing copy; not the production PNG"}
        if item["bytes"] > LIMIT:
            raise ValueError(f"Viewing copy exceeds 200 KB: {task_id}")
        entries.append({**item, "name": task["displayName"], "suit": task["suitName"],
                        "productionFile": f"../186x260/{task_id}.png", "productionBytes": production_path.stat().st_size})
    summary = {"cards": len(entries), "limitBytes": LIMIT,
               "maxPreviewBytes": max((r["bytes"] for r in entries), default=0),
               "maxProductionPngBytes": max((r["productionBytes"] for r in entries), default=0),
               "originalBytes": sum(r["sourceBytes"] for r in entries),
               "previewBytes": sum(r["bytes"] for r in entries)}
    manifest = {"schemaVersion": 1, "updatedAt": datetime.now(timezone.utc).isoformat(),
                "profile": PROFILE, "originalFilesModified": False, "summary": summary, "cards": entries}
    atomic(index, (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    if not create_page:
        return {**summary, "highResolutionDirectory": str(OUTPUT), "extraPreviewPagesGenerated": False}
    tiles = []
    for entry in entries:
        label = html.escape(entry["name"] + " · " + entry["suit"])
        image = "压缩预览/" + entry["file"]
        tiles.append(f'<article data-name="{label}"><a href="{image}"><img loading="lazy" src="{image}" alt="{label}"></a>'
                     f'<strong>{label}</strong><span>{entry["bytes"]/1000:.1f} KB · {entry["size"][0]}×{entry["size"][1]}</span>'
                     f'<a href="186x260/{entry["id"]}.png">186×260 PNG</a></article>')
    page = ('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            '<title>生产卡面 · 小文件预览</title><style>body{margin:24px;background:#17171c;color:#e8e1d2;font:16px system-ui}'
            'a{color:#d6b778}input{padding:10px;width:260px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(186px,1fr));gap:20px}'
            'article{display:flex;flex-direction:column;gap:5px;max-width:250px}img{width:100%;height:auto}span{color:#aaa}[hidden]{display:none}</style>'
            f'<h1>生产卡面 · 小文件预览</h1><p>已提交{len(entries)}张，每张预览≤200 KB。PNG入口为186×260实际生产底图；原始生成PNG单独归档。</p>'
            '<p><a href="../通用图层/preview.html">四花色与十三点数</a> · <a href="../preview.html">素材首页</a> · '
            '<a href="压缩预览/manifest.json">压缩记录</a></p><p><input placeholder="按牌名或花色筛选" aria-label="筛选"></p><main>'
            + ''.join(tiles) + '</main><script>document.querySelector("input").oninput=e=>{const q=e.target.value.trim();'
            'document.querySelectorAll("article").forEach(a=>a.hidden=!a.dataset.name.includes(q))};</script></html>')
    atomic(CARDS / "preview.html", page.encode("utf-8"))
    return {**summary, "preview": str(CARDS / "preview.html")}


if __name__ == "__main__":
    import sys
    import argparse
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser=argparse.ArgumentParser();parser.add_argument("--page",action="store_true")
    args=parser.parse_args()
    print(json.dumps(synchronize(create_page=args.page), ensure_ascii=False, indent=2))
