"""Durable single-card checkpoints. This program never generates or edits images."""
from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent
ARCHIVE = BASE.parent.parent
RUNTIME = BASE / "runtime"


def utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def pid_alive(pid):
    if not isinstance(pid, int) or pid <= 0:
        return False
    if os.name == "nt":
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
        kernel.OpenProcess.restype = ctypes.c_void_p
        kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        handle = kernel.OpenProcess(0x00100000, False, pid)
        if not handle:
            return ctypes.get_last_error() == 5
        try:
            return kernel.WaitForSingleObject(handle, 0) == 258
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def read_json(path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return default


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def runtime_dir(value=None):
    target = Path(value).resolve() if value else RUNTIME
    if not target.is_relative_to(RUNTIME):
        raise ValueError("Runtime directory must remain inside this task's runtime directory")
    target.mkdir(parents=True, exist_ok=True)
    return target


@contextmanager
def process_lock(path, wait_seconds=5):
    deadline = time.monotonic() + wait_seconds
    token = uuid.uuid4().hex
    owner = {"pid": os.getpid(), "token": token, "createdAt": utc()}
    while True:
        try:
            with path.open("x", encoding="utf-8") as handle:
                json.dump(owner, handle)
            break
        except FileExistsError:
            try:
                previous = read_json(path, {})
                # The file can be briefly empty while its owner creates it.
                stale = not pid_alive(previous.get("pid"))
            except (json.JSONDecodeError, OSError):
                stale = path.exists() and time.time() - path.stat().st_mtime > 30
            if stale:
                path.unlink(missing_ok=True)
                continue
            if time.monotonic() >= deadline:
                raise RuntimeError(f"Another process owns {path.name}: {previous if 'previous' in locals() else 'starting'}")
            time.sleep(0.1)
    try:
        yield owner
    finally:
        if read_json(path, {}).get("token") == token:
            path.unlink(missing_ok=True)


def artifact_path(value):
    path = Path(value)
    if not path.is_absolute():
        path = BASE / path
    path = path.resolve()
    if not path.is_relative_to(ARCHIVE):
        raise ValueError("Artifact paths must remain inside the card archive")
    return path


def artifact_record(value, required=False):
    path = artifact_path(value)
    result = {"path": str(path), "exists": path.is_file()}
    if not result["exists"]:
        if required:
            raise ValueError(f"Missing artifact: {path}")
        return result
    result["bytes"] = path.stat().st_size
    if required and result["bytes"] == 0:
        raise ValueError(f"Empty artifact: {path}")
    with path.open("rb") as handle:
        result["sha256"] = hashlib.file_digest(handle, "sha256").hexdigest()
    return result


def initial_state():
    return {"schemaVersion": 1, "createdAt": utc(), "status": "running", "revision": 0,
            "currentTask": None, "done": {}, "failures": []}


def save_state(directory, state, action):
    state["revision"] += 1
    state["updatedAt"] = state["heartbeatAt"] = utc()
    state["heartbeatEpoch"] = time.time()
    state["lastAction"] = action
    atomic_json(directory / "state.json", state)
    atomic_json(directory / "heartbeat.json", {key: state[key] for key in
        ("revision", "heartbeatAt", "heartbeatEpoch", "status", "lastAction")})
    with (directory / "controller.events.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"at": utc(), "action": action, "revision": state["revision"],
            "cardId": (state["currentTask"] or {}).get("cardId")}, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-dir", help="Optional test directory, constrained beneath runtime/")
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("start", "recover", "status", "stop"):
        sub.add_parser(command)
    touch = sub.add_parser("touch")
    touch.add_argument("--stage")
    for command in ("begin", "artifact", "commit", "fail"):
        item = sub.add_parser(command)
        item.add_argument("card_id")
        if command == "begin":
            item.add_argument("--artifact", action="append", default=[])
        elif command in ("artifact", "commit"):
            item.add_argument("artifacts", nargs="+")
        else:
            item.add_argument("--message", required=True)
    args = parser.parse_args()
    directory = runtime_dir(args.runtime_dir)
    with process_lock(directory / "controller.lock"):
        state = read_json(directory / "state.json")
        if state is None:
            if args.command != "start":
                raise ValueError("Run start once before using this controller")
            state = initial_state()
        current = state.get("currentTask")
        if args.command == "status":
            result = {"state": state, "watchdog": read_json(directory / "watchdog.status.json"),
                      "recovery": read_json(directory / "recovery-needed.json")}
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return
        if args.command in ("start", "recover"):
            state["status"] = "running"
            if current:
                current["candidateCheck"] = [artifact_record(value) for value in current["artifactCandidates"]]
                current["recoveredAt"] = utc()
        elif args.command == "stop":
            state["status"] = "stopped"
        elif args.command == "touch":
            if state["status"] == "stopped":
                raise ValueError("Stopped; use start or recover first")
            if args.stage and current:
                current["stage"] = args.stage
        else:
            card_id = args.card_id
            if card_id in state["done"]:
                if args.command == "commit":
                    requested = [artifact_record(value, required=True) for value in args.artifacts]
                    if requested == state["done"][card_id]["artifacts"]:
                        print(json.dumps({"alreadyCommitted": card_id}, ensure_ascii=False))
                        return
                raise ValueError(f"Already completed, refusing to overwrite checkpoint: {card_id}")
            if state["status"] == "stopped":
                raise ValueError("Stopped; use start or recover first")
            if args.command == "begin":
                if current and current["cardId"] != card_id:
                    raise ValueError(f"Current task must be resolved first: {current['cardId']}")
                if not current:
                    current = {"cardId": card_id, "beganAt": utc(), "stage": "generating", "artifactCandidates": []}
                    state["currentTask"] = current
                for value in args.artifact:
                    path = str(artifact_path(value))
                    if path not in current["artifactCandidates"]:
                        current["artifactCandidates"].append(path)
                state["status"] = "running"
            else:
                if not current or current["cardId"] != card_id:
                    raise ValueError("Command card ID must equal the active task ID")
                if args.command == "artifact":
                    records = [artifact_record(value, required=True) for value in args.artifacts]
                    for record in records:
                        if record["path"] not in current["artifactCandidates"]:
                            current["artifactCandidates"].append(record["path"])
                    current["savedArtifacts"] = records
                    current["stage"] = "saved-awaiting-review"
                elif args.command == "commit":
                    records = [artifact_record(value, required=True) for value in args.artifacts]
                    state["done"][card_id] = {"committedAt": utc(), "artifacts": records}
                    state["currentTask"] = None
                    state["status"] = "running"
                else:
                    state["failures"].append({"cardId": card_id, "at": utc(), "message": args.message})
                    current["stage"] = "failed-awaiting-recovery"
                    current["lastError"] = args.message
                    state["status"] = "needs-recovery"
        save_state(directory, state, args.command)
        print(json.dumps({"status": state["status"], "revision": state["revision"],
            "currentTask": state["currentTask"], "doneCount": len(state["done"])}, ensure_ascii=False))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
