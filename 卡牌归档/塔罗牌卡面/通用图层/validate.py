"""Verify real accepted sprites, byte provenance, alpha, and all available overlays."""
import argparse
import json
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image, ImageChops
import layer_io as io

def verify(complete=False, exercise_writes=True):
    s=io.state();m=io.read_json(io.ROOT/"manifest.json")
    if s["queue"]!=io.QUEUE:raise ValueError("Layer queue changed")
    if len(set(io.QUEUE))!=17:raise ValueError("Expected 17 unique layers")
    done=set(s["done"])
    if complete and done!=set(io.QUEUE):raise ValueError(f"Incomplete layers: {len(done)}/17")
    if m["accepted"]!=len(done):raise ValueError("Manifest count mismatch")
    entries={x["id"]:x for x in m["layers"]}
    for task in done:
        p=io.paths(task,s["done"][task]["attempt"])
        r=io.read_json(p["item"])
        if r["status"]!="accepted" or not r["reviews"] or not r["generationId"] or not r["prompt"]:
            raise ValueError(f"Missing acceptance or provenance: {task}")
        if entries[task]["status"]!="accepted":raise ValueError("Manifest status mismatch")
        for file,record in [(p["final"],r["production"]["export"]),(p["original"],r["production"]["native"]),(p["native"],r["native"]),(p["export"],r["export"])]:
            current=io.alpha_info(file)
            if current["sha256"]!=record["sha256"] or current["rgbaSha256"]!=record["rgbaSha256"]:raise ValueError(f"SHA mismatch: {file}")
            if not current["actualAlpha"] or current["cornerAlpha"]!=[0,0,0,0]:raise ValueError(f"Invalid alpha: {file}")
        final=io.alpha_info(p["final"])
        if final["size"]!=[38,34] or final["mode"]!="RGBA":raise ValueError("Wrong final size/mode")
        if entries[task]["sha256"]!=final["sha256"] or s["done"][task]["sha256"]!=final["sha256"]:raise ValueError("Checkpoint hash mismatch")
        if not p["prompt"].exists() or p["prompt"].read_text(encoding="utf-8")!=r["prompt"]:raise ValueError("Actual prompt missing or changed")
        if task in io.REUSE and p["final"].read_bytes()!=(io.TAROT/"红桃2分层"/io.REUSE[task][0]).read_bytes():raise ValueError("Reuse changed approved bytes")
    combinations=0
    for rank in io.RANKS:
        for suit in io.SUITS:
            ids=[f"rank_{rank}",f"suit_{suit}"]
            if not set(ids).issubset(done):continue
            masks=[]
            for task,pos in zip(ids,[(8,8),(8,38)]):
                with Image.open(io.ROOT/"38x34"/f"{task}.png") as im:
                    mask=Image.new("L",(186,260));mask.paste(im.getchannel("A"),pos);masks.append(mask)
            if ImageChops.multiply(*masks).getbbox():raise ValueError(f"Rank/suit visible alpha overlap: {ids}")
            combinations+=1
    # Local immutable save must be idempotent and must refuse different bytes.
    if exercise_writes:
        with TemporaryDirectory(prefix="tarot-ui-verify-") as temp:
            target=Path(temp)/"sprite.png";source=(io.TAROT/"红桃2分层"/"heart.png").read_bytes()
            io.immutable_bytes(target,source);io.immutable_bytes(target,source)
            try:io.immutable_bytes(target,b"different")
            except ValueError:pass
            else:raise ValueError("Immutable write allowed replacement")
            if target.read_bytes()!=source:raise ValueError("Rejected write mutated file")
    # Normalize the actual approved numeral, without drawing a substitute glyph.
    with Image.open(io.TAROT/"红桃2分层"/"red_2.png") as image:
        encoded,method=io.normalize(image,"rank_2")
    with Image.open(BytesIO(encoded)) as exported:
        if exported.size!=(38,34) or exported.mode!="RGBA" or exported.getchannel("A").getextrema()!=(0,255):raise ValueError("Normalization output invalid")
    return {"verifiedAt":io.now(),"accepted":len(done),"expected":17,"combinedRankSuitAlphaChecks":combinations,"expectedCompleteCombinations":52,"immutableWrites":"idempotence and overwrite rejection passed" if exercise_writes else "not exercised in read-only preflight","approvedReuseBytes":"matched", "fileAndPixelChecks":"passed", "visualBoundary":"Manual reviews are recorded separately; this validation does not infer visual approval", "gameIntegration":"not performed"}

if __name__=="__main__":
    import sys
    if hasattr(sys.stdout,"reconfigure"):sys.stdout.reconfigure(encoding="utf-8")
    parser=argparse.ArgumentParser();parser.add_argument("--complete",action="store_true");args=parser.parse_args()
    try:
        report=verify(args.complete);io.write_json(io.ROOT/"verification.json",report);print(json.dumps(report,ensure_ascii=False,indent=2))
    except (ValueError,OSError,KeyError) as error:
        print(json.dumps({"error":str(error)},ensure_ascii=False),file=sys.stderr);raise SystemExit(2)
