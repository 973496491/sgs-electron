"""Build an immutable, suit-aware offline card package after every task is committed.

--check-only performs read-only preflight; it never writes images, state, or reports.
The queue's status fields are descriptive. runtime/state.json.done is authoritative.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import html
import importlib.util
from io import BytesIO
import json
from pathlib import Path
import re
import sys
import uuid

from PIL import Image, ImageChops, ImageDraw


BASE = Path(__file__).resolve().parent
TAROT = BASE.parent
ARCHIVE = TAROT.parent
REPOSITORY = ARCHIVE.parent
SUITS = {1: "heart", 2: "diamond", 3: "spade", 4: "club"}
EXPECTED = {"atlasResources": 111, "atlasDistinctRectangles": 109,
            "generateResources": 87, "retainOriginalResources": 24,
            "resourceSuitMappings": 197, "uniqueGenerationTasks": 194, "reuseTasks": 3}
STABLE_TASK_FIELDS = ("resourceKey", "suitValue", "suit", "displayName", "layout", "badge",
                      "weaponRange", "rangeOverrideApplied", "sharedFrameGroupId",
                      "sourceCardIds", "representativeCardId", "operation", "reuseOfTaskId")


def utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def confined(root, value):
    path = Path(value)
    result = (path if path.is_absolute() else root / path).resolve()
    require(result.is_relative_to(root.resolve()), f"Path outside allowed directory: {result}")
    return result


def rect(entry):
    return tuple(entry["frame"][key] for key in ("x", "y", "w", "h"))


def box(rectangle):
    x, y, width, height = rectangle
    return x, y, x + width, y + height


def load_atlas_tool():
    spec = importlib.util.spec_from_file_location("tarot_original_atlas_tool", REPOSITORY / "tools/card_atlas.py")
    module = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


class Inputs:
    """Read-once snapshots and fingerprints; never mutates production or checkpoints."""

    def __init__(self, root=BASE):
        self.root = root.resolve()
        self.tarot = self.root.parent
        self.archive = self.tarot.parent
        self.blobs = {}
        self.fingerprints = {}
        self.records = {}
        self.assets = {}
        self.errors = []
        self.warnings = []

    def read(self, path, freeze=False):
        path = Path(path).resolve()
        data = path.read_bytes()
        fingerprint = sha(data)
        if path in self.fingerprints:
            require(self.fingerprints[path] == fingerprint, f"Input changed between reads: {path}")
        self.fingerprints[path] = fingerprint
        if freeze:
            self.blobs[path] = data
        return data

    def read_json(self, path):
        return json.loads(self.read(path, freeze=True).decode("utf-8-sig"))

    def image_info(self, path, stored=None, expected_size=None, require_rgba=False):
        data = self.read(path)
        with Image.open(BytesIO(data)) as image:
            image.load()
            require(image.format == "PNG", f"Not a PNG: {path}")
            if expected_size is not None:
                require(image.size == tuple(expected_size), f"Wrong dimensions: {path}: {image.size}, expected {expected_size}")
            if require_rgba:
                require(image.mode == "RGBA", f"Production export must be RGBA: {path}")
            info = {"path": str(Path(path).resolve()), "bytes": len(data), "sha256": sha(data),
                    "rgbaSha256": sha(image.convert("RGBA").tobytes()),
                    "size": list(image.size), "mode": image.mode, "format": image.format}
        if stored is not None:
            require(isinstance(stored, dict) and stored.get("sha256") and stored.get("size"),
                    f"Missing recorded image hash/size: {path}")
            for key in ("sha256", "size", "bytes", "mode", "format", "rgbaSha256"):
                if key in stored:
                    require(info[key] == stored[key], f"Recorded image {key} differs: {path}")
            if "path" in stored:
                recorded = Path(stored["path"])
                recorded = (recorded if recorded.is_absolute() else self.root / recorded).resolve()
                require(recorded == Path(path).resolve(), f"Record points at another production asset: {path}")
        return info

    def assert_unchanged(self):
        for path, fingerprint in self.fingerprints.items():
            if path == self.root / "runtime/state.json":
                # Heartbeats may advance during packaging. Committed artifacts may not.
                current = json.loads(path.read_text(encoding="utf-8-sig"))
                require(current.get("done") == self.state.get("done"), "Committed task set changed during build")
            else:
                require(sha(path.read_bytes()) == fingerprint, f"Input changed during build: {path}")


def load_inputs(root=BASE):
    source = Inputs(root)
    source.scope = source.read_json(source.root / "scope.json")
    source.queue = source.read_json(source.root / "tasks.json")
    source.inventory = source.read_json(source.root / "inventory.json")
    source.state = source.read_json(source.root / "runtime/state.json")
    manifest_path = (source.root / source.scope["sourceManifest"]).resolve()
    require(manifest_path.is_relative_to(source.archive), "Manifest escaped card archive")
    source.manifest_path = manifest_path
    source.manifest = source.read_json(manifest_path)
    manifest = source.manifest
    require(manifest.get("format") == "sgsol-card-atlas-v1", "Unsupported manifest format")
    source.original_png_path = confined(manifest_path.parent, manifest["image"]["file"])
    source.original_atlas_path = confined(manifest_path.parent, manifest["atlas"]["file"])
    source.original_png = source.read(source.original_png_path)
    source.original_atlas = source.read(source.original_atlas_path)
    require(sha(source.original_png) == manifest["image"]["sha256"], "Original PNG SHA-256 mismatch")
    require(sha(source.original_atlas) == manifest["atlas"]["sha256"], "Original atlas SHA-256 mismatch")
    with Image.open(BytesIO(source.original_png)) as image:
        require(image.format == "PNG" and image.mode == "RGBA", "Original must be RGBA PNG")
        source.original_image = image.copy()
    require(source.original_image.size == (2048, 4096), "Unexpected original atlas dimensions")
    require(sha(source.original_image.tobytes()) == manifest["image"]["rgbaSha256"], "Original RGBA hash mismatch")
    source.atlas = json.loads(source.original_atlas)
    source.frames = load_atlas_tool().validate_frames(source.atlas, source.original_image.size)
    source.entries = {entry["resourceKey"]: entry for entry in manifest["frames"]}
    require(len(source.entries) == len(manifest["frames"]), "Duplicate manifest resources")
    require({entry["name"] for entry in source.entries.values()} == set(source.frames), "Manifest frame names differ from atlas")
    for entry in source.entries.values():
        require(entry["atlasEntry"] == source.frames[entry["name"]], f"Atlas entry changed: {entry['name']}")
        crop = source.original_image.crop(box(rect(entry["atlasEntry"])))
        require(sha(crop.tobytes()) == entry["rgbaSha256"], f"Original crop hash mismatch: {entry['name']}")
    source.tasks = {task["id"]: task for task in source.queue["tasks"]}
    require(len(source.tasks) == len(source.queue["tasks"]), "Duplicate task IDs")
    source.items = {item["resourceKey"]: item for item in source.inventory["inventory"]}
    require(len(source.items) == len(source.inventory["inventory"]), "Duplicate inventory resources")
    require(set(source.items) == set(source.entries), "Inventory resources differ from original manifest")
    counts = {"atlasResources": len(source.entries),
              "atlasDistinctRectangles": len({rect(entry["atlasEntry"]) for entry in source.entries.values()}),
              "generateResources": sum(item["decision"] == "generate" for item in source.items.values()),
              "retainOriginalResources": sum(item["decision"] == "retain-original" for item in source.items.values()),
              "resourceSuitMappings": len(source.tasks),
              "uniqueGenerationTasks": sum(task["operation"] == "generate" for task in source.tasks.values()),
              "reuseTasks": sum(task["operation"] == "reuse" for task in source.tasks.values())}
    require(counts == EXPECTED, f"Scope counts changed; update and review builder contract: {counts}")
    for label, data in (("queue", source.queue), ("inventory", source.inventory)):
        require(all(data["summary"].get(key) == value for key, value in counts.items()), f"{label} summary mismatch")
    combinations = set()
    aliases = source.scope.get("nameAliases", {})
    retained_names = {aliases.get(name, name) for name in source.scope["retainOriginalNames"]}
    retained_keys = set(source.scope["retainOriginalResourceKeys"])
    for key, item in source.items.items():
        excluded = key in retained_keys or bool(set(item["originalNames"]) & retained_names)
        no_information = not item["effectiveCardIds"]
        expected_decision = "retain-original" if excluded or no_information else "generate"
        require(item["decision"] == expected_decision, f"Current scope retention differs from inventory: {key}")
    for task in source.tasks.values():
        require(re.fullmatch(r"[A-Za-z0-9_]+", task["id"]) is not None, "Unsafe task ID")
        key, suit = task["resourceKey"], task["suit"]
        require(key in source.entries and SUITS.get(task["suitValue"]) == suit, f"Invalid task key/suit: {task['id']}")
        require(task["id"] == key + "__" + suit, f"Task ID differs from resource/suit: {task['id']}")
        require((key, suit) not in combinations, f"Duplicate resource/suit task: {task['id']}")
        combinations.add((key, suit))
        item = source.items[key]
        require(item["decision"] == "generate", f"Task would edit retained resource: {key}")
        require(suit in {row["key"] for row in item["actualSuits"]}, f"Task invents a missing suit: {task['id']}")
        require(task["id"] in item["taskIds"], f"Task missing from inventory: {task['id']}")
        require(item["atlasEntry"] == source.entries[key]["atlasEntry"], f"Inventory rectangle changed: {key}")
        desired_name = source.scope.get("displayNames", {}).get(task["originalName"])
        if desired_name is not None:
            require(task["displayName"] == desired_name, f"Current scope title differs from task: {task['id']}")
        desired_range = source.scope.get("rangeOverrides", {}).get(task["originalName"])
        if desired_range is not None:
            require(task["weaponRange"] == desired_range and str(task["badge"]) == str(desired_range),
                    f"Current scope range differs from task: {task['id']}")
        if task["operation"] == "reuse":
            original = source.tasks.get(task["reuseOfTaskId"])
            require(original and original["operation"] == "generate" and original["suit"] == suit,
                    f"Invalid reuse source: {task['id']}")
            require(rect(source.entries[original["resourceKey"]]["atlasEntry"]) == rect(item["atlasEntry"]),
                    f"Reuse source has another rectangle: {task['id']}")
    for key, item in source.items.items():
        actual = {(key, row["key"]) for row in item["actualSuits"]} if item["decision"] == "generate" else set()
        require({pair for pair in combinations if pair[0] == key} == actual, f"Incomplete actual-suit task coverage: {key}")
    for evidence in source.inventory.get("sources", []):
        path = (source.root / evidence["file"]).resolve()
        require(path.is_relative_to(source.archive), "Evidence escaped card archive")
        data = source.read(path, freeze=True)
        if sha(data) != evidence["sha256"]:
            if path == source.root / "scope.json":
                source.warnings.append("scope.json differs from inventory's early snapshot; current scope is frozen and task semantics are checked.")
            else:
                raise ValueError(f"Inventory evidence SHA-256 mismatch: {path}")
    require(isinstance(source.state.get("done"), dict), "state.done must be an object")
    require(not (set(source.state["done"]) - set(source.tasks)), "state.done contains unknown task IDs")
    return source


def check_task(source, task):
    task_id = task["id"]
    committed = source.state["done"][task_id]
    artifacts = committed.get("artifacts", [])
    require(artifacts, f"Committed task has no artifacts: {task_id}")
    for artifact in artifacts:
        path = Path(artifact["path"])
        path = (path if path.is_absolute() else source.root / path).resolve()
        require(path.is_relative_to(source.archive), f"Committed artifact outside card archive: {path}")
        data = source.read(path)
        require(bool(data) and sha(data) == artifact.get("sha256"), f"Committed artifact hash mismatch: {path}")
        require(len(data) == artifact.get("bytes"), f"Committed artifact size mismatch: {path}")
    record_path = source.root / "子任务" / f"{task_id}.json"
    record = source.read_json(record_path)
    require(record.get("taskId") == task_id, f"Wrong single-card record: {task_id}")
    require(record.get("status") in ("reviewed", "reused"), f"Card is not reviewed: {task_id}")
    require(any(review.get("result") in ("accepted-offline", "reused-verified") and review.get("note", "").strip()
                for review in record.get("reviews", [])), f"Missing explicit review note: {task_id}")
    original_task = record.get("sourceCard", {})
    for field in STABLE_TASK_FIELDS:
        require(original_task.get(field) == task.get(field), f"Reviewed task {field} changed: {task_id}")
    production = record.get("production")
    require(isinstance(production, dict), f"Missing promoted production metadata: {task_id}")
    export_path = source.tarot / "生产底图/186x260" / f"{task_id}.png"
    native_path = source.tarot / "生产底图/大图" / f"{task_id}.png"
    entry = source.entries[task["resourceKey"]]["atlasEntry"]
    export = source.image_info(export_path, production.get("export", {}), rect(entry)[2:], True)
    require(export["bytes"] <= 200_000, f"Single-card production PNG exceeds 200 KB: {task_id}")
    native = source.image_info(native_path, production.get("native", {}))
    source.records[task_id] = record
    source.assets[task_id] = {"export": export, "native": native, "recordPath": str(record_path)}


def check_ui_layers(source):
    """Read-only verification and portable bytes for the separate 17-layer set."""
    folder = source.tarot / "通用图层"
    source.ui_files = {}
    source.ui_manifest = None
    if not (folder / "state.json").is_file():
        return {"ready": False, "accepted": 0, "expected": 17, "reason": "UI layers not started"}
    checkpoint = source.read_json(folder / "state.json")
    manifest = source.read_json(folder / "manifest.json")
    spec = importlib.util.spec_from_file_location("tarot_ui_validation", folder / "validate.py")
    module = importlib.util.module_from_spec(spec)
    old_path = sys.path[:]
    old_bytecode = sys.dont_write_bytecode
    old_io = sys.modules.pop("layer_io", None)
    try:
        sys.path.insert(0, str(folder))
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
        report = module.verify(complete=False, exercise_writes=False)
    finally:
        sys.path[:] = old_path
        sys.dont_write_bytecode = old_bytecode
        sys.modules.pop("layer_io", None)
        if old_io is not None:
            sys.modules["layer_io"] = old_io
    expected = set(module.io.QUEUE)
    require(set(checkpoint["done"]) <= expected, "Unknown UI layer in checkpoint")
    require(len(manifest["layers"]) == 17 and {r["id"] for r in manifest["layers"]} == expected, "UI map must have 17 unique fixed IDs")
    require(manifest["pixelSize"] == [38, 34] and manifest["uiSize"] == [19, 17], "UI layer dimensions changed")
    require(manifest["positionsPx"] == {"rank": [8, 8], "suit": [8, 38]}, "UI layer positions changed")
    require(manifest["positionsUi"] == {"rank": [4, 4], "suit": [4, 19]}, "UI display positions changed")
    require(manifest["accepted"] == len(checkpoint["done"]) == report["accepted"], "UI snapshots changed during verification")
    for task_id, entry in checkpoint["done"].items():
        record = source.read_json(folder / "逐项记录" / f"{task_id}.json")
        require(record["taskId"] == task_id and record["status"] == "accepted" and record.get("generationId") and record.get("prompt"), "UI record identity or acceptance mismatch")
        require(any(r.get("result") == "reviewed" and r.get("note", "").strip() for r in record["reviews"]), "Missing UI visual review")
        for image in (record["native"], record["export"], *record["production"].values()):
            path = confined(folder, image["path"])
            require(sha(source.read(path)) == image["sha256"], "UI image changed during verification")
        files = [f"38x34/{task_id}.png", f"原图/{task_id}.png", f"逐项记录/{task_id}.json",
                 f"逐项记录/{task_id}.md", f"提示词/{task_id}.v{entry['attempt']}.txt"]
        for relative in files:
            source.ui_files[relative] = source.read(folder / relative)
    for name in ("state.json", "manifest.json"):
        source.ui_files[name] = source.read(folder / name)
    complete = set(checkpoint["done"]) == expected
    if complete:
        require(report["combinedRankSuitAlphaChecks"] == 52, "All 52 UI overlays must pass")
        for name in ("README.md", "preview.html", "图层总览.png", "52种组合.png"):
            source.ui_files[name] = source.read(folder / name)
        for name in ("verification.json", "总体验收.json", "总体验收.md"):
            if (folder / name).is_file():
                source.ui_files[name] = source.read(folder / name)
        # Keep the interactive preview self-contained in the final card package.
        preview = source.ui_files["preview.html"].decode("utf-8")
        preview = preview.replace("../生产底图/186x260/WuZhongShengYou_png__heart.png", "../cards/WuZhongShengYou_png/heart.png")
        source.ui_files["preview.html"] = preview.encode("utf-8")
        readme = source.ui_files["README.md"].decode("utf-8")
        readme += "\n本交付副本的图层制作工具源快照位于`../inputs/tools/ui-layers/`，需在原归档工作区运行；本目录可直接使用PNG、manifest及组合预览。来源记录中的绝对路径仅用于历史溯源。\n"
        source.ui_files["README.md"] = readme.encode("utf-8")
        for stem in ("suit_heart_native", "rank_2_accepted_native"):
            for suffix in (".png", ".json"):
                relative = "来源原图/" + stem + suffix
                if (folder / relative).is_file():
                    source.ui_files[relative] = source.read(folder / relative)
    for name in ("heart.png", "red_2.png"):
        source.read(source.tarot / "红桃2分层" / name)
    for name in ("layer_io.py", "validate.py", "build_preview.py"):
        source.read(folder / name)
    source.ui_manifest = manifest
    report.update(ready=complete, writesPerformed=False)
    source.ui_files["validation.json"] = json_bytes(report)
    return report


def preflight(source):
    missing = [task_id for task_id in source.tasks if task_id not in source.state["done"]]
    for task_id in source.tasks:
        if task_id not in source.state["done"]:
            continue
        try:
            check_task(source, source.tasks[task_id])
        except (OSError, ValueError, KeyError, TypeError) as error:
            source.errors.append({"taskId": task_id, "error": str(error)})
    group_hashes = defaultdict(set)
    for task_id, info in source.assets.items():
        task = source.tasks[task_id]
        group_hashes[(task["suit"], rect(source.entries[task["resourceKey"]]["atlasEntry"]))].add(info["export"]["rgbaSha256"])
        if task["operation"] == "reuse" and task["reuseOfTaskId"] in source.assets:
            reference = source.assets[task["reuseOfTaskId"]]
            if info["export"]["rgbaSha256"] != reference["export"]["rgbaSha256"]:
                source.errors.append({"taskId": task_id, "error": "Shared-frame reuse pixels differ from source"})
    for (suit, rectangle), hashes in group_hashes.items():
        if len(hashes) > 1:
            source.errors.append({"suit": suit, "rectangle": list(rectangle), "error": "Conflicting shared-frame pixels"})
    try:
        source.ui_report = check_ui_layers(source)
    except (OSError, ValueError, KeyError, TypeError) as error:
        source.ui_report = {"ready": False, "error": str(error)}
        source.errors.append({"scope": "ui-layers", "error": str(error)})
    return {"schemaVersion": 1, "checkedAt": utc(), "checkOnly": True,
            "ready": not missing and not source.errors and source.ui_report["ready"], "expectedTasks": len(source.tasks),
            "committedTasks": len(source.state["done"]), "validatedTasks": len(source.assets),
            "missingCommittedTaskIds": missing, "errors": source.errors, "warnings": source.warnings,
            "scopeCounts": EXPECTED, "uiLayers": source.ui_report, "writesPerformed": False, "integration": "not-implemented"}


def page_groups(source, suit):
    groups = {}
    for task_id, task in source.tasks.items():
        if task["suit"] != suit:
            continue
        rectangle = rect(source.entries[task["resourceKey"]]["atlasEntry"])
        info = source.assets[task_id]["export"]
        group = groups.setdefault(rectangle, {"taskIds": [], "rgbaSha256": info["rgbaSha256"], "asset": info})
        require(group["rgbaSha256"] == info["rgbaSha256"], f"Shared rectangle conflict: {suit}, {rectangle}")
        group["taskIds"].append(task_id)
    return groups


def compose_page(source, groups):
    image = source.original_image.copy()
    for rectangle, group in groups.items():
        path = Path(group["asset"]["path"])
        data = path.read_bytes()
        require(sha(data) == group["asset"]["sha256"], f"Production file changed: {path}")
        with Image.open(BytesIO(data)) as crop:
            crop = crop.convert("RGBA")
            require(crop.size == rectangle[2:], "Production dimensions changed")
            image.paste(crop, rectangle[:2])  # No alpha mask: preserve every replacement RGBA byte.
    return image


def validate_page(original, result, groups, entries, retained_keys):
    require(result.mode == "RGBA" and result.size == original.size, "Output image dimensions/mode differ")
    untouched = Image.new("L", original.size, 255)
    draw = ImageDraw.Draw(untouched)
    for rectangle, group in groups.items():
        x, y, width, height = rectangle
        require(sha(result.crop(box(rectangle)).tobytes()) == group["rgbaSha256"], f"Merged crop differs: {rectangle}")
        draw.rectangle((x, y, x + width - 1, y + height - 1), fill=0)
    # Compare channels independently: RGBA.getbbox() can hide RGB differences under alpha=0.
    for old, new in zip(original.split(), result.split()):
        difference = ImageChops.multiply(ImageChops.difference(old, new), untouched)
        require(difference.getbbox() is None, "An unedited pixel/channel changed, including transparent RGB")
    for key in retained_keys:
        rectangle = rect(entries[key]["atlasEntry"])
        require(result.crop(box(rectangle)).tobytes() == original.crop(box(rectangle)).tobytes(),
                f"Retained resource changed through a shared slot: {key}")
    return {"replacedRectangles": len(groups), "replacementPixelsExact": True,
            "uneditedRgbaExact": True, "transparentRgbPreserved": True,
            "retainedResourceCount": len(retained_keys), "retainedPixelsExact": True}


def make_variant_map(source, build_id):
    resources = {}
    decisions = Counter()
    for key, entry in source.entries.items():
        item = source.items[key]
        variants = {}
        for value, suit in SUITS.items():
            task_id = key + "__" + suit
            task = source.tasks.get(task_id)
            generated = task is not None and item["decision"] == "generate"
            decision = ("reuse" if task["operation"] == "reuse" else "generated") if generated else "original"
            prefix = f"atlas/{suit}" if generated else "original"
            info = source.assets[task_id]["export"] if generated else None
            variants[suit] = {"resourceKey": key, "suitValue": value, "suit": suit, "decision": decision,
                "reason": ("actual-config-suit" if generated else item.get("retainReason") or "no-actual-card-for-this-suit"),
                "taskId": task_id if generated else None, "reuseOfTaskId": task.get("reuseOfTaskId") if generated else None,
                "pageImage": prefix + "/cards.png", "pageAtlas": prefix + "/cards.atlas",
                "frameName": entry["name"], **entry["atlasEntry"],
                "standalonePng": f"cards/{key}/{suit}.png" if generated else "original/" + entry["file"],
                "rgbaSha256": info["rgbaSha256"] if generated else entry["rgbaSha256"],
                "fileSha256": info["sha256"] if generated else None,
                "sharedFrameGroupId": item["sharedFrameGroupId"], "sharedFrameNames": entry["sharedFrameNames"],
                "sourceCardIds": task["sourceCardIds"] if generated else next((row["cardIds"] for row in item["actualSuits"] if row["key"] == suit), []),
                "representativeCardId": task["representativeCardId"] if generated else None,
                "displayName": task["displayName"] if generated else None,
                "badge": task.get("badge") if generated else None,
                "weaponRange": task.get("weaponRange") if generated else None,
                "weaponRangeVariants": task.get("weaponRangeVariants", []) if generated else item.get("weaponRangeVariants", []),
                "rangeMismatchCardIds": task.get("rangeMismatchCardIds", []) if generated else [],
                "rangeOverrideApplied": task.get("rangeOverrideApplied", False) if generated else False,
                "integrationStatus": "assets-only-client-not-integrated"}
            decisions[decision] += 1
        resources[key] = {"originalNames": item["originalNames"], "decision": item["decision"], "variants": variants}
    return {"schemaVersion": 1, "buildId": build_id, "suitMapping": SUITS,
            "counts": dict(decisions), "resources": resources,
            "fallback": {"zeroOrUnknownSuit": "original/cards.png + original frame",
                         "unknownResource": "keep-client-original; do not invent a frame",
                         "selectionKey": ["resourceKey", "displayedSuit"],
                         "neverInferSupportFromAtlasFramePresence": True},
            "cacheBoundary": "All atlases preserve cards/ prefix; use isolated page handles/namespaces in a future adapter."}


def make_card_id_map(source):
    cards = {}
    for key, item in source.items.items():
        for card_id in item["effectiveCardIds"]:
            identifier = str(card_id)
            require(identifier not in cards, f"Entity ID is assigned to multiple resources: {identifier}")
            suit = next((row["key"] for row in item["actualSuits"] if card_id in row["cardIds"]), None)
            task = source.tasks.get(key + "__" + str(suit))
            cards[identifier] = {"resourceKey": key, "suit": suit, "taskId": task["id"] if task else None,
                "decision": "variant-map" if task else "original",
                "note": "configuration snapshot only; runtime display changes must use current UI/model values"}
    return {"schemaVersion": 1, "source": source.scope["sourceConfig"], "cards": cards}


def write_new(root, relative, data):
    path = confined(root, relative)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(data)
    return path


def png_bytes(image):
    buffer = BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def preview_html(source):
    tiles = []
    for task in source.tasks.values():
        title = f"{task['displayName']} · {task['suitName']}"
        path = f"cards/{task['resourceKey']}/{task['suit']}.png"
        tiles.append(f'<a class="card" data-search="{html.escape(title + " " + task["id"], quote=True)}" href="{path}">'
                     f'<img loading="lazy" width="186" height="260" src="{path}"><span>{html.escape(title)}</span></a>')
    return ("<!doctype html><html lang=zh-CN><meta charset=utf-8><title>塔罗牌生产底图</title>"
            "<style>body{background:#202124;color:#eee;font:15px system-ui;margin:24px}main{display:flex;flex-wrap:wrap;gap:16px}"
            ".card{color:inherit;text-decoration:none;display:grid;gap:6px;text-align:center}input{padding:10px;margin-bottom:20px}"
            "[hidden]{display:none!important}</style><h1>塔罗牌生产底图</h1>"
            "<p>197 个实际资源花色映射。底图不含左上点数与功能花色；素材未接入游戏。</p>"
            "<input placeholder='筛选牌名、花色或资源键' aria-label='筛选卡牌'><main>" + "\n".join(tiles) +
            "</main><script>document.querySelector('input').oninput=e=>{const q=e.target.value.toLowerCase();"
            "document.querySelectorAll('.card').forEach(c=>c.hidden=!c.dataset.search.toLowerCase().includes(q));};</script></html>").encode("utf-8")


def copy_ui_layers(source, destination):
    require(source.ui_report["ready"], "All UI layers must pass before packaging")
    for relative, data in source.ui_files.items():
        copied = write_new(destination, "ui-layers/" + relative, data)
        require(sha(copied.read_bytes()) == sha(data), f"UI package copy differs: {relative}")
    ui_map = dict(source.ui_manifest)
    ui_map["layers"] = [{**entry, "file": "ui-layers/" + entry["file"], "record": "ui-layers/" + entry["record"]} for entry in source.ui_manifest["layers"]]
    write_new(destination, "ui-layer-map.json", json_bytes(ui_map))
    for entry in ui_map["layers"]:
        copied = confined(destination, entry["file"])
        require(sha(copied.read_bytes()) == entry["sha256"], f"UI map resolves to changed bytes: {entry['id']}")
        require(confined(destination, entry["record"]).is_file(), "UI package record missing")
        with Image.open(copied) as image:
            require(image.mode == "RGBA" and image.size == (38, 34), "Packaged UI image dimensions changed")
            require(sha(image.tobytes()) == entry["rgbaSha256"], "Packaged UI RGBA differs")
    return {"verifiedExports": len(ui_map["layers"]), "copiedFiles": len(source.ui_files) + 1, "relativePathsVerified": True, "rgbaReadback": "passed"}


def build(source, report, target):
    require(report["ready"], "All 197 card tasks and 17 UI layers must be committed and validated before building")
    target = Path(target).resolve()
    delivery_root = source.tarot / "交付"
    require(target.is_relative_to(delivery_root.resolve()) and target != delivery_root.resolve(), "Output must be a new batch below 塔罗牌卡面/交付")
    require(not target.exists(), f"Refusing to overwrite existing delivery: {target}")
    source.assert_unchanged()
    # Construct before writing: invalid logical maps must not leave a partial package.
    variants = make_variant_map(source, target.name)
    card_ids = make_card_id_map(source)
    require(variants["counts"] == {"original": 247, "generated": 194, "reuse": 3}, "Variant count mismatch")
    retained = {key for key, item in source.items.items() if item["decision"] == "retain-original"}
    temporary = target.with_name("." + target.name + ".building-" + uuid.uuid4().hex)
    temporary.mkdir(parents=True, exist_ok=False)
    started = utc()
    try:
        write_new(temporary, "original/cards.png", source.original_png)
        write_new(temporary, "original/cards.atlas", source.original_atlas)
        ui_copy_report = copy_ui_layers(source, temporary)
        for key, entry in source.entries.items():
            data = png_bytes(source.original_image.crop(box(rect(entry["atlasEntry"]))))
            write_new(temporary, "original/" + entry["file"], data)
            for variant in variants["resources"][key]["variants"].values():
                if variant["decision"] == "original":
                    variant["fileSha256"] = sha(data)
        for task_id, asset in source.assets.items():
            task = source.tasks[task_id]
            data = Path(asset["export"]["path"]).read_bytes()
            require(sha(data) == asset["export"]["sha256"], f"Export changed before copy: {task_id}")
            write_new(temporary, f"cards/{task['resourceKey']}/{task['suit']}.png", data)
            record_path = Path(asset["recordPath"])
            write_new(temporary, f"provenance/records/{task_id}.json", source.blobs[record_path])
            markdown = record_path.with_suffix(".md")
            if markdown.exists():
                write_new(temporary, f"provenance/records/{task_id}.md", source.read(markdown, freeze=True))
        guides = list((source.tarot / "文档").glob("*.md"))
        guides += [source.root / name for name in ("合并交付方案.md", "单卡执行协议.md")]
        for guide in guides:
            if guide.is_file():
                relative = guide.relative_to(source.tarot).as_posix()
                write_new(temporary, "provenance/guides/" + relative, source.read(guide, freeze=True))
        for tool in (Path(__file__).resolve(), REPOSITORY / "tools/card_atlas.py"):
            write_new(temporary, "inputs/tools/" + tool.name, source.read(tool))
        for name in ("layer_io.py", "validate.py", "build_preview.py"):
            write_new(temporary, "inputs/tools/ui-layers/" + name, source.read(source.tarot / "通用图层" / name))
        pages, checks = {}, {}
        for suit in SUITS.values():
            groups = page_groups(source, suit)
            image = compose_page(source, groups)
            png = write_new(temporary, f"atlas/{suit}/cards.png", png_bytes(image))
            atlas = write_new(temporary, f"atlas/{suit}/cards.atlas", source.original_atlas)
            with Image.open(png) as reopened:
                reopened.load()
                checks[suit] = validate_page(source.original_image, reopened, groups, source.entries, retained)
                pixel_hash = sha(reopened.tobytes())
            require(atlas.read_bytes() == source.original_atlas, "Atlas bytes changed")
            shared = []
            for rectangle, group in groups.items():
                aliases = [key for key, entry in source.entries.items() if rect(entry["atlasEntry"]) == rectangle]
                if len(aliases) > 1:
                    shared.append({"frame": list(rectangle), "resourceKeys": aliases, "taskIds": group["taskIds"],
                        "incidentalAliases": [key for key in aliases if key + "__" + suit not in source.tasks],
                        "incidentalPolicy": "shared-slot-incidental; missing logical suits still select original page"})
            pages[suit] = {"file": f"atlas/{suit}/cards.png", "fileSha256": sha(png.read_bytes()),
                          "rgbaSha256": pixel_hash, "atlasUnchanged": True,
                          "resourceSuitMappings": sum(task["suit"] == suit for task in source.tasks.values()),
                          "replacedRectangles": len(groups), "sharedSlots": shared}
        # Verify every logical map against independently reopened outputs, including alias fallbacks.
        page_cache = {}
        for resource in variants["resources"].values():
            for variant in resource["variants"].values():
                page = variant["pageImage"]
                if page not in page_cache:
                    with Image.open(temporary / page) as image:
                        page_cache[page] = image.convert("RGBA")
                rgba = page_cache[page].crop(box(rect(variant))).tobytes()
                require(sha(rgba) == variant["rgbaSha256"], f"Logical map resolves to wrong pixels: {variant['resourceKey']}/{variant['suit']}")
                independent = temporary / variant["standalonePng"]
                require(sha(independent.read_bytes()) == variant["fileSha256"], f"Standalone hash mismatch: {independent}")
        # Freeze exact bytes of the input snapshots, including the authoritative done checkpoint.
        frozen = []
        for path, data in source.blobs.items():
            if path.is_relative_to(source.root / "子任务"):
                continue
            if path.is_relative_to(source.root):
                relative = "inputs/long-task/" + path.relative_to(source.root).as_posix()
            else:
                relative = "inputs/archive/" + path.relative_to(source.archive).as_posix()
            write_new(temporary, relative, data)
            frozen.append({"sourcePath": str(path), "file": relative, "sha256": sha(data)})
        source.assert_unchanged()
        write_new(temporary, "inputs/frozen-inputs.json", json_bytes(frozen))
        write_new(temporary, "inputs/production-source-index.json", json_bytes(source.assets))
        write_new(temporary, "variant-map.json", json_bytes(variants))
        write_new(temporary, "card-id-map.json", json_bytes(card_ids))
        write_new(temporary, "validation.json", json_bytes({"passed": True, "pages": checks,
            "logicalMapEntriesVerified": 444, "standaloneExportsVerified": 197,
            "originalSourceBytesPreserved": True, "allAtlasesByteIdentical": True,
            "uiLayers": source.ui_report, "uiPackage": ui_copy_report,
            "visualReview": "per-card accepted notes, not automatically re-scored",
            "gameIntegration": "not-implemented", "inGameVerification": "not-performed"}))
        build_report = {"schemaVersion": 1, "buildId": target.name, "startedAt": started, "completedAt": utc(),
            "output": str(target), "inputSnapshots": frozen, "counts": EXPECTED, "pages": pages,
            "mapCounts": variants["counts"], "uiLayers": source.ui_report, "uiPackage": ui_copy_report, "warnings": source.warnings,
            "completionAuthority": "runtime/state.json.done", "integration": "not-implemented"}
        write_new(temporary, "build-report.json", json_bytes(build_report))
        write_new(temporary, "preview.html", preview_html(source))
        readme = ("# 塔罗牌离线交付\n\n"
                  "四份花色图集保持原 atlas 的布局；按 variant-map.json 的资源键与显示花色共同选图。"
                  "同名槽位不能在一张 cards.png 中自动显示四个花色，四页同名纹理也不能直接覆盖同一客户端缓存。\n\n"
                  "197 个资源花色映射、194 份唯一视觉、3 项共享复用；24 个原图保留资源。"
                  "111 项×4 花色的 444 条选择中，247 条明确回退 original/。"
                  "水淹七军的黑桃共享槽仅允许其有证据的资源键使用，另一个别名仍回退原图。\n\n"
                  "点数及左上功能花色未烘焙到底图，需原生独立图层。右下范围/属性为静态代表配置，"
                  "赤血刃按用户要求为3；模式范围差异见 variant-map.json。素材未接入游戏，未游戏内验证。\n\n"
                  "另含4花色与13点数共17个38×34透明UI图层；52种组合已校验，按ui-layer-map.json叠加。"
                  "工具源快照保存在inputs/tools/ui-layers，制作工具仍按原归档工作区运行。\n\n"
                  "[卡面预览](preview.html) · [图层组合预览](ui-layers/preview.html) · [校验](validation.json) · [合并报告](build-report.json)\n\n"
                  "inputs/ 保存本批输入与合并工具快照；provenance/records/ 保存完整提示词和验收说明，"
                  "provenance/guides/ 保存相关规范正文副本（其中相对链接仍按原归档目录解释）。"
                  "大图原件仍保留在生产底图/大图，路径与哈希记录于 inputs/production-source-index.json，"
                  "本包仅含实际186×260生产底图，不复制大图原件。\n")
        write_new(temporary, "README.md", readme.encode("utf-8"))
        file_manifest = [{"file": path.relative_to(temporary).as_posix(), "sha256": sha(path.read_bytes()), "bytes": path.stat().st_size}
                         for path in sorted(temporary.rglob("*")) if path.is_file()]
        write_new(temporary, "package-files.json", json_bytes(file_manifest))
        require(not target.exists(), f"Delivery appeared during build; refusing overwrite: {target}")
        # Windows rename does not replace an existing destination; no os.replace here.
        temporary.rename(target)
        return build_report
    except Exception as error:
        # Preserve recovery evidence. Never delete the batch or modify any checkpoint.
        try:
            write_new(temporary, "BUILD-FAILED.json", json_bytes({"at": utc(), "error": str(error),
                       "intendedOutput": str(target), "complete": False}))
        except OSError:
            pass
        raise RuntimeError(f"Build incomplete; staging preserved at {temporary}: {error}") from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true", help="Read-only validation; never writes any output")
    parser.add_argument("--output-dir", type=Path, help="New batch below 塔罗牌卡面/交付; existing targets are never replaced")
    args = parser.parse_args()
    source = load_inputs()
    report = preflight(source)
    if args.check_only or not report["ready"]:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["ready"] else 2
    name = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = args.output_dir or TAROT / "交付" / name
    result = build(source, report, target)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError, RuntimeError) as error:
        print(json.dumps({"error": str(error), "complete": False}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)
