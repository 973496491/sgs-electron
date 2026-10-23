"""Single-card native image I/O. Never generates images or changes the main queue.

prepare ID [--attempt N] -> compact reference JPEG and exact prompt
save ID [--attempt N] [--native-file PNG] -> immutable candidate, awaiting review
inspect ID [--attempt N] -> compact review images
review ID [--attempt N] --note TEXT [--reject] -> explicit review, then promotion
"""

from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone, timedelta
import hashlib
from io import BytesIO
import json
from pathlib import Path
import re
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parent
TAROT = ROOT.parent
SESSIONS = Path("C:/Users/97349/.codex/sessions/2026/10/21")
JPEG_LIMIT = 150_000


def now():
    return datetime.now(timezone.utc).isoformat()


def read_json(file):
    return json.loads(Path(file).read_text(encoding="utf-8-sig"))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def relative(file):
    try:
        return str(Path(file).resolve().relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(Path(file).resolve())


def atomic_text(file, value):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    temp = file.with_name(file.name + ".tmp")
    temp.write_text(value, encoding="utf-8")
    temp.replace(file)


def write_json(file, value):
    atomic_text(file, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def immutable_bytes(file, data):
    """An interrupted attempt can resume, but cannot replace different bytes."""
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    if file.exists():
        if file.read_bytes() != data:
            raise ValueError(f"Refusing to overwrite existing asset: {file}")
        return
    with file.open("xb") as stream:
        stream.write(data)


def task_context(task_id, attempt):
    if not re.fullmatch(r"[A-Za-z0-9_]+", task_id):
        raise ValueError("Invalid task ID")
    if attempt < 1:
        raise ValueError("Attempt must be >= 1")
    queue = read_json(ROOT / "tasks.json")
    matches = [item for item in queue["tasks"] if item["id"] == task_id]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one task: {task_id}")
    return matches[0], read_json(ROOT / "scope.json")


def tag_for(task_id, attempt):
    return f"[TAROT-PROD:{task_id}:v{attempt}]"


def paths_for(task_id, attempt):
    candidate = ROOT / "候选" / task_id
    return {
        "candidate": candidate / f"v{attempt}.png",
        "export": candidate / f"v{attempt}_186x260.png",
        "record": candidate / f"v{attempt}.json",
        "markdown": candidate / f"v{attempt}.md",
        "card_record": ROOT / "子任务" / f"{task_id}.json",
        "card_markdown": ROOT / "子任务" / f"{task_id}.md",
        "production": TAROT / "生产底图" / "大图" / f"{task_id}.png",
        "production_export": TAROT / "生产底图" / "186x260" / f"{task_id}.png",
        "reference": ROOT / "参考图" / f"{task_id}.v{attempt}.jpg",
        "prepared": ROOT / "参考图" / f"{task_id}.v{attempt}.json",
        "inspection": ROOT / "检查图" / f"{task_id}.v{attempt}.jpg",
        "ui_check": ROOT / "检查图" / f"{task_id}.v{attempt}_93x130.png",
    }


def image_info(file):
    file = Path(file)
    data = file.read_bytes()
    with Image.open(BytesIO(data)) as image:
        image.load()
        return {"path": str(file.resolve()), "bytes": len(data), "sha256": sha(data),
                "rgbaSha256": sha(image.convert("RGBA").tobytes()),
                "size": list(image.size), "mode": image.mode, "format": image.format}


def compact_jpeg(source, target, maximum=(465, 650)):
    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail(maximum, Image.Resampling.LANCZOS)
        for quality in (86, 80, 73, 65, 55):
            buffer = BytesIO()
            image.save(buffer, "JPEG", quality=quality, optimize=True)
            if buffer.tell() < JPEG_LIMIT:
                break
        else:
            image.thumbnail((325, 455), Image.Resampling.LANCZOS)
            buffer = BytesIO()
            image.save(buffer, "JPEG", quality=65, optimize=True)
        if buffer.tell() >= JPEG_LIMIT:
            raise ValueError("Reference JPEG still exceeds 150 KB")
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    Path(target).write_bytes(buffer.getvalue())
    return image_info(target)


def image_calls(value):
    if isinstance(value, dict):
        if value.get("type") == "image_generation_call":
            yield value
        else:
            for item in value.values():
                if isinstance(item, (dict, list)):
                    yield from image_calls(item)
    elif isinstance(value, list):
        for item in value:
            yield from image_calls(item)


def native_candidates(tag, include_result=False):
    """Read only matching completed native results; never print their base64."""
    result = {}
    marker = tag.encode("utf-8")
    session_files = set(SESSIONS.glob("*.jsonl"))
    # Preserve the original task session and also support a later resumed day.
    session_root = Path("C:/Users/97349/.codex/sessions")
    for day in (datetime.now(), datetime.now() - timedelta(days=1)):
        session_files.update((session_root / day.strftime("%Y/%m/%d")).glob("*.jsonl"))
    for session in sorted(session_files):
        with session.open("rb") as stream:
            for line_number, line in enumerate(stream, 1):
                if marker not in line or b'"image_generation_call"' not in line:
                    continue
                try:
                    row = json.loads(line)
                except (ValueError, UnicodeDecodeError):
                    continue  # A still-running session can have an unfinished last line.
                for item in image_calls(row.get("payload", row)):
                    prompt = item.get("revised_prompt", "")
                    if item.get("status") != "completed" or tag not in prompt:
                        continue
                    if not isinstance(item.get("result"), str) or not item["result"]:
                        continue
                    found = {"generationId": item.get("id"), "timestamp": row.get("timestamp"),
                             "session": str(session), "line": line_number,
                             "revisedPrompt": prompt}
                    if include_result:
                        found["result"] = item["result"]
                    result[item.get("id") or (str(session), line_number)] = found
    return sorted(result.values(), key=lambda item: (item["timestamp"] or "", item["line"]))


def public_candidate(candidate):
    return {key: value for key, value in candidate.items() if key not in ("result", "revisedPrompt")}


def exact_prompt(task, scope, tag):
    title = task["displayName"]
    if task["layout"] == "center":
        layout = "One large character, optically centered."
    elif task["layout"] == "horizontal":
        layout = f"All {len(title)} characters in one horizontal left-to-right line; center the group without stretching glyphs."
    elif task["layout"] == "2x2-left-to-right-row-major" and len(title) == 4:
        layout = f'Exactly 2 columns by 2 rows: top "{title[:2]}", bottom "{title[2:]}"; read across each row, whole block centered.'
    else:
        raise ValueError(f"Unsupported title layout: {task['layout']}")
    badge = task.get("badge")
    badge_text = (f'Lower-right badge: exactly "{badge}", dark enamel with thin gold rim, clear of foliage/frame; no explanatory text.'
                  if badge else "No lower-right badge. Remove any reference badge and its entire ring, seamlessly restoring the dark ground.")
    reserved = scope.get("reservedUiArea186x260", [8, 8, 38, 64])
    glyph = " Use six-stroke simplified 杀 (U+6740), never 殺; no right-side 殳." if title == "杀" else ""
    return "\n".join([
        tag,
        "Use case: precise-object-edit. Edit the single shown reference into ONE final card, full-bleed portrait 186:260, complete outer frame; no sheet or mockup.",
        f"Preserve the {task['suit']} family: upper-center and upper-right suit ornaments, dark frosted ground, subdued foliage, thin gold frame and pale champagne-gold embossed brush typography. No bright glow.",
        f'Replace the title with exactly "{title}". {layout}{glyph} Keep clear, complete strokes and balanced spacing.',
        badge_text,
        f"Reserve the upper-left (x,y,w,h)={tuple(reserved)} on the 186x260 grid: continuous natural dark ground only, no rank, corner suit, inner gold lines, hanging ornaments, starbursts, bright gold specks or foliage. Keep only the outermost frame there; no visible patch/ellipse/panel.",
        "Only the exact title and specified badge may contain text. No old title, fixed card rank, IDs, watermark or tracking tag. Remain readable at 93x130. Output this card only; no extra background or preview image.",
    ])


def prepare(task, scope, attempt, reference_file=None, correction=None):
    task_id = task["id"]
    paths = paths_for(task_id, attempt)
    tag = tag_for(task_id, attempt)
    existing = []
    for file in sorted((ROOT / "候选" / task_id).glob("v*.json")):
        record = read_json(file)
        existing.append({"record": str(file), "attempt": record.get("attempt"), "status": record.get("status")})
    for file in sorted((ROOT / "候选" / task_id).glob("v*.png")):
        match = re.fullmatch(r"v(\d+)\.png", file.name)
        if match and not file.with_suffix(".json").exists():
            existing.append({"path": str(file), "attempt": int(match.group(1)), "status": "unrecorded-candidate"})
    for key in ("production", "production_export"):
        if paths[key].exists():
            existing.append({"kind": key, **image_info(paths[key])})
    completed = [public_candidate(item) for item in native_candidates(tag)]
    if task.get("operation") == "reuse":
        return {"existingCandidates": existing, "taskId": task_id, "operation": "reuse",
                "reuseOfTaskId": task["reuseOfTaskId"], "shouldGenerate": False}
    if paths["prepared"].exists():
        prior = read_json(paths["prepared"])
        if correction and prior.get("correction") != correction:
            raise ValueError("Correction changed for a prepared attempt; use a new --attempt")
        if reference_file and Path(reference_file).resolve() != Path(prior["referenceSource"]).resolve():
            raise ValueError("Reference changed for a prepared attempt; use a new --attempt")
        info, prompt = prior["reference"], prior["prompt"]
        if not Path(info["path"]).exists() or sha(Path(info["path"]).read_bytes()) != info["sha256"]:
            raise ValueError("Prepared reference is missing or changed")
        return {"existingCandidates": existing, "completedNativeCandidates": completed,
                "taskId": task_id, "attempt": attempt, "tag": tag,
                "shouldGenerate": not (completed or any(item.get("attempt") == attempt or item.get("kind", "").startswith("production") for item in existing)),
                "reference": info, "prompt": prompt, "preparedRecord": str(paths["prepared"]),
                "instruction": "复用此attempt冻结的参考和提示词；有候选先检查，不重复生成。"}
    if reference_file:
        reference = Path(reference_file).resolve()
        if not reference.is_file() or not reference.is_relative_to(TAROT.parent.resolve()):
            raise ValueError("Explicit reference must be an existing file inside 卡牌归档")
    elif task_id == "HanBingJian_png__spade":
        reference = TAROT / "文字排布样板" / "02_寒冰剑_黑桃2_攻击范围2.png"
    else:
        reference = TAROT / "四花色样板" / "大图" / f"{task['suitName']}.png"
        # Prefer a completed same-suit production base with its UI reserve already cleared.
        state_path = ROOT / "runtime" / "state.json"
        done = read_json(state_path).get("done", {}) if state_path.exists() else {}
        clean = []
        for completed_id in done:
            card_path = ROOT / "子任务" / f"{completed_id}.json"
            if not card_path.exists():
                continue
            card = read_json(card_path)
            source_task = card.get("sourceCard", {})
            if source_task.get("suit") != task["suit"] or not card.get("production"):
                continue
            native = card["production"]["native"]["path"]
            if Path(native).exists():
                clean.append((source_task.get("badge") != task.get("badge"), completed_id, Path(native)))
        if clean:
            reference = sorted(clean)[0][2]
    info = compact_jpeg(reference, paths["reference"])
    prompt = exact_prompt(task, scope, tag)
    if correction:
        prompt += "\nTargeted edit: " + correction
    prepared = {"taskId": task_id, "attempt": attempt, "tag": tag, "preparedAt": now(),
                "referenceSource": str(reference), "reference": info, "prompt": prompt,
                "taskSnapshot": task, "scopeSnapshot": scope, "correction": correction}
    write_json(paths["prepared"], prepared)
    return {"existingCandidates": existing, "completedNativeCandidates": completed,
            "taskId": task_id, "attempt": attempt, "tag": tag,
            "shouldGenerate": not (completed or any(item.get("attempt") == attempt or item.get("kind", "").startswith("production") for item in existing)),
            "reference": info, "prompt": prompt, "preparedRecord": str(paths["prepared"]),
            "instruction": "先检查已有候选；如确需生成，view_image载入此小JPEG，然后单次内置图像调用使用完整prompt。"}


def record_markdown(record):
    task = record["sourceCard"]
    lines = [f"# {task['displayName']} · {task['suitName']} · v{record['attempt']}", "",
             f"- 任务：`{record['taskId']}`", f"- 状态：`{record['status']}`",
             f"- 原名：{task['originalName']}；代表ID：{task['representativeCardId']}；代表点数：{task['representativeRank']}（不烘焙到底图）",
             f"- 徽记：{task.get('badge') or '无'}；攻击范围：{task.get('weaponRange') or '非武器'}",
             f"- 原生生成ID：`{record.get('generationId') or '未提供，不能推定'}`",
             f"- 原图SHA-256：`{record['native']['sha256']}`",
             f"- 导出SHA-256：`{record['export']['sha256']}`", "",
             "仅离线素材制作；未修改游戏接入、主任务队列或守护状态。", ""]
    for check in record.get("reviews", []):
        lines += [f"## 离线视觉验收 {check['at']}", "", f"结论：{check['result']}。{check['note']}", ""]
    lines += ["## 完整提交提示词", "", "```text", record["prompt"], "```", ""]
    if record.get("revisedPrompt") and record["revisedPrompt"] != record["prompt"]:
        lines += ["## 原生工具返回提示词", "", "```text", record["revisedPrompt"], "```", ""]
    return "\n".join(lines)


def persist_record(record, paths, update_card=True):
    write_json(paths["record"], record)
    atomic_text(paths["markdown"], record_markdown(record))
    if update_card:
        write_json(paths["card_record"], record)
        atomic_text(paths["card_markdown"], record_markdown(record))


def inspection(paths, detailed=False):
    if not paths["candidate"].exists():
        raise ValueError("Save this attempt before inspecting it")
    if not detailed:
        return {"image": image_info(paths["export"]),
                "note": "精简流程：只实际查看这一份186×260交付PNG；不另生成预览。仅文字等关键信息不明确时再查局部。"}
    jpg = compact_jpeg(paths["candidate"], paths["inspection"])
    with Image.open(paths["candidate"]) as image:
        ui = image.convert("RGBA").resize((93, 130), Image.Resampling.LANCZOS)
        paths["ui_check"].parent.mkdir(parents=True, exist_ok=True)
        ui.save(paths["ui_check"], "PNG")
    return {"jpeg": jpg, "uiCheck": image_info(paths["ui_check"]),
            "note": "请实际查看两张检查图；生成检查文件本身不等于通过视觉验收。"}


def save(task, scope, attempt, native_file=None, generation_id=None):
    task_id = task["id"]
    paths = paths_for(task_id, attempt)
    tag = tag_for(task_id, attempt)
    if task.get("operation") == "reuse":
        raise ValueError("Shared-frame reuse is committed by the parent; no image generation required")
    if paths["record"].exists():
        existing = read_json(paths["record"])
        if paths["candidate"].exists() and paths["export"].exists():
            if sha(paths["candidate"].read_bytes()) != existing["native"]["sha256"]:
                raise ValueError("Existing candidate no longer matches its record")
            if sha(paths["export"].read_bytes()) != existing["export"]["sha256"]:
                raise ValueError("Existing export no longer matches its record")
            if native_file and sha(Path(native_file).read_bytes()) != existing["native"]["sha256"]:
                raise ValueError("This attempt already has a different candidate; use --attempt N+1")
            return {"taskId": task_id, "attempt": attempt, "status": existing["status"],
                    "alreadySaved": True, "record": str(paths["record"]), "inspection": inspection(paths)}
    if paths["prepared"].exists():
        prepared = read_json(paths["prepared"])
    else:
        prepare(task, scope, attempt)
        prepared = read_json(paths["prepared"])
    native = None
    if native_file:
        source = Path(native_file).resolve()
        data = source.read_bytes()
        provenance = {"kind": "explicit-native-file", "path": str(source)}
        generated_at = None
        revised_prompt = None
    else:
        matches = native_candidates(tag, include_result=True)
        if generation_id:
            matches = [item for item in matches if item["generationId"] == generation_id]
        if len(matches) != 1:
            raise ValueError(f"Found {len(matches)} completed native results for this attempt; use --generation-id or --native-file to disambiguate, never regenerate blindly")
        native = matches[0]
        encoded = native["result"]
        if encoded.startswith("data:"):
            encoded = encoded.split(",", 1)[1]
        data = base64.b64decode(encoded, validate=True)
        generation_id = native["generationId"]
        generated_at = native["timestamp"]
        revised_prompt = native["revisedPrompt"]
        provenance = {"kind": "native-session-result", **public_candidate(native)}
    with Image.open(BytesIO(data)) as image:
        image.load()
        if image.format != "PNG":
            raise ValueError("Expected the native PNG; refusing to relabel another format as PNG")
        size = list(image.size)
        mode = image.mode
        exported = image.convert("RGBA").resize((186, 260), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        exported.save(buffer, "PNG")
    immutable_bytes(paths["candidate"], data)
    immutable_bytes(paths["export"], buffer.getvalue())
    record = {"schemaVersion": 1, "taskId": task_id, "attempt": attempt, "tag": tag,
              "status": "awaiting-review", "savedAt": now(), "generatedAt": generated_at,
              "tool": "OpenAI Responses native image_generation", "generationId": generation_id,
              "prompt": prepared["prompt"], "revisedPrompt": revised_prompt,
              "sourceCard": prepared["taskSnapshot"], "scopeSnapshot": prepared["scopeSnapshot"],
              "provenance": provenance, "native": image_info(paths["candidate"]),
              "export": image_info(paths["export"]), "nativeSize": size, "nativeMode": mode,
              "exportMethod": "Pillow RGBA LANCZOS resize to 186x260; no cropping; no generative edits",
              "aspectRatioRelativeDifference": abs((size[0] / size[1]) / (186 / 260) - 1),
              "reviews": [], "production": None,
              "completionBoundary": "Saved candidate only; no visual approval, no main-queue completion, no game integration."}
    previous = read_json(paths["card_record"]) if paths["card_record"].exists() else None
    preserve_accepted = previous and previous.get("status") == "reviewed"
    persist_record(record, paths, update_card=not preserve_accepted)
    return {"taskId": task_id, "attempt": attempt, "status": "awaiting-review",
            "generationId": generation_id, "record": str(paths["record"]),
            "native": record["native"], "export": record["export"],
            "inspection": inspection(paths)}


def review(task, attempt, note, rejected=False):
    if not note.strip():
        raise ValueError("An explicit offline visual review note is required")
    paths = paths_for(task["id"], attempt)
    record = read_json(paths["record"])
    for key, stored in (("candidate", "native"), ("export", "export")):
        if sha(paths[key].read_bytes()) != record[stored]["sha256"]:
            raise ValueError("Candidate changed since save; refusing review/promotion")
    if not rejected:
        for target, source in (("production", "candidate"), ("production_export", "export")):
            if paths[target].exists() and paths[target].read_bytes() != paths[source].read_bytes():
                raise ValueError(f"Refusing to replace an existing promoted asset: {paths[target]}")
        immutable_bytes(paths["production"], paths["candidate"].read_bytes())
        immutable_bytes(paths["production_export"], paths["export"].read_bytes())
        record["production"] = {"native": image_info(paths["production"]),
                                "export": image_info(paths["production_export"])}
    elif record.get("status") == "reviewed":
        raise ValueError("An already promoted card requires parent-managed revision; do not reject in place")
    record["status"] = "rejected" if rejected else "reviewed"
    record["workflowStatus"] = "needs-new-attempt" if rejected else "awaiting-parent-commit"
    record["reviews"].append({"at": now(), "result": "rejected" if rejected else "accepted-offline",
                              "note": note.strip(), "source": "explicit reviewer-supplied note; not automatic vision"})
    record["completionBoundary"] = "Offline review recorded; parent must commit main queue. No game integration verified."
    previous = read_json(paths["card_record"]) if paths["card_record"].exists() else None
    preserve_other = previous and previous.get("status") == "reviewed" and previous.get("attempt") != attempt
    persist_record(record, paths, update_card=not preserve_other)
    return {"taskId": task["id"], "attempt": attempt, "status": record["status"],
            "workflowStatus": record["workflowStatus"], "record": str(paths["card_record"]),
            "attemptRecord": str(paths["record"]), "production": record["production"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("prepare", "save", "inspect", "review"):
        child = commands.add_parser(name)
        child.add_argument("task_id")
        child.add_argument("--attempt", type=int, default=1)
        if name == "prepare":
            child.add_argument("--reference-file", type=Path)
            child.add_argument("--correction")
        if name == "save":
            child.add_argument("--native-file", type=Path)
            child.add_argument("--generation-id")
        if name == "inspect":
            child.add_argument("--detailed", action="store_true")
        if name == "review":
            child.add_argument("--note", required=True)
            child.add_argument("--reject", action="store_true")
    args = parser.parse_args()
    task, scope = task_context(args.task_id, args.attempt)
    if args.command == "prepare":
        result = prepare(task, scope, args.attempt, args.reference_file, args.correction)
    elif args.command == "save":
        result = save(task, scope, args.attempt, args.native_file, args.generation_id)
    elif args.command == "inspect":
        result = inspection(paths_for(args.task_id, args.attempt), args.detailed)
    else:
        result = review(task, args.attempt, args.note, args.reject)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)
