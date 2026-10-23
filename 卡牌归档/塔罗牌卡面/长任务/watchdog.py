"""Passive heartbeat monitor: preserve outputs and request an explicit recovery."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.dont_write_bytecode = True
from controller import atomic_json, process_lock, read_json, runtime_dir, utc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-dir")
    parser.add_argument("--timeout", type=float, default=900)
    parser.add_argument("--interval", type=float, default=15)
    args = parser.parse_args()
    if args.timeout <= 0 or args.interval <= 0:
        parser.error("Timeout and interval must be positive")
    directory = runtime_dir(args.runtime_dir)
    with process_lock(directory / "watchdog.pid", wait_seconds=0):
        started_at = utc()
        alarm_active = False
        while True:
            try:
                state = read_json(directory / "state.json", {})
                age = max(0, time.time() - state.get("heartbeatEpoch", 0))
                mode = state.get("status", "missing-state")
                stalled = mode not in ("stopped",) and (age > args.timeout or mode == "needs-recovery")
                current = state.get("currentTask")
                report = {"pid": os.getpid(), "startedAt": started_at, "checkedAt": utc(),
                          "mode": "stopped" if mode == "stopped" else "alarm" if stalled else "watching",
                          "timeoutSeconds": args.timeout, "intervalSeconds": args.interval,
                          "heartbeatAgeSeconds": round(age, 2), "taskStatus": mode,
                          "currentCardId": (current or {}).get("cardId"), "revision": state.get("revision")}
                atomic_json(directory / "watchdog.status.json", report)
                if mode == "stopped":
                    previous = read_json(directory / "recovery-needed.json", {})
                    if previous.get("active"):
                        previous.update({"active": False, "resolvedAt": utc(), "resolution": "controller-stopped"})
                        atomic_json(directory / "recovery-needed.json", previous)
                    break
                if stalled and not alarm_active:
                    alarm = {"active": True, "detectedAt": utc(), "reason": "task-failed" if mode == "needs-recovery" else "heartbeat-timeout",
                             "cardId": (current or {}).get("cardId"), "lastHeartbeatAt": state.get("heartbeatAt"),
                             "artifactCandidates": (current or {}).get("artifactCandidates", []),
                             "instruction": "先核对原会话是否仍在生成；读取主任务、scope、state 和单卡记录，核对已有产物。确认接管后执行 controller.py recover。不得重复覆盖 done；守护不会调用生成工具或自动重启会话。"}
                    atomic_json(directory / "recovery-needed.json", alarm)
                    with (directory / "watchdog.events.jsonl").open("a", encoding="utf-8") as handle:
                        handle.write(json.dumps(alarm, ensure_ascii=False) + "\n")
                elif not stalled:
                    previous = read_json(directory / "recovery-needed.json", {})
                    if previous.get("active"):
                        previous.update({"active": False, "resolvedAt": utc(), "resolution": "heartbeat-resumed"})
                        atomic_json(directory / "recovery-needed.json", previous)
                alarm_active = stalled
            except (OSError, ValueError) as error:
                # Reading/writing errors must not terminate monitoring silently.
                with (directory / "watchdog.errors.log").open("a", encoding="utf-8") as handle:
                    handle.write(f"{utc()} {type(error).__name__}: {error}\n")
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
