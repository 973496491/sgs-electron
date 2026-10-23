"""Offline UI-layer records and PNG I/O; never generates or changes the card queue."""
from __future__ import annotations
import argparse
import base64
import json
import sys
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
TAROT = ROOT.parent
sys.path.insert(0, str(TAROT / "长任务"))
from production_io import (atomic_text, write_json, read_json, immutable_bytes,
                           native_candidates, public_candidate, image_info, sha, now)

SUITS = {"heart": "红桃", "diamond": "方块", "spade": "黑桃", "club": "梅花"}
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
QUEUE = [f"suit_{s}" for s in SUITS] + [f"rank_{r}" for r in RANKS]
REUSE = {"suit_heart": ("heart.png", "f97a96f4552b679f5eea134794cfce9ff71fe9cfd0efb8a0b8a0d7905da3fcef", "ig_0e03e1afb090f834016ad7a156721487d0a0ab6170c5f610d8", "03_红桃提取.txt"),
         "rank_2": ("red_2.png", "55c61d02d25d2fc4db1b15d24bc61e42552c6e476a6f16952322bb1d798ea058", "ig_051fea5d232504cf016ad7a385f62c87d0a9a01c99583b917b", "04_点数位置微调.txt")}

def paths(task, attempt):
    if task not in QUEUE or attempt < 1:
        raise ValueError("Unknown layer or invalid attempt")
    prefix = ROOT / "候选" / task / f"v{attempt}"
    return {"native": prefix.with_suffix(".png"), "export": prefix.with_name(prefix.name + "_38x34.png"),
            "record": prefix.with_suffix(".json"), "markdown": prefix.with_suffix(".md"),
            "prepared": ROOT / "参考图" / f"{task}.v{attempt}.json",
            "reference": ROOT / "参考图" / f"{task}.v{attempt}.jpg",
            "prompt": ROOT / "提示词" / f"{task}.v{attempt}.txt",
            "check": ROOT / "检查图" / f"{task}.v{attempt}.png",
            "final": ROOT / "38x34" / f"{task}.png", "original": ROOT / "原图" / f"{task}.png",
            "item": ROOT / "逐项记录" / f"{task}.json", "item_md": ROOT / "逐项记录" / f"{task}.md"}

def alpha_info(file):
    info = image_info(file)
    with Image.open(file) as im:
        if im.mode != "RGBA":
            info.update(actualAlpha=False, alphaRange=None)
            return info
        a = im.getchannel("A")
        corners = [a.getpixel(p) for p in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]]
        info.update(actualAlpha=a.getextrema()==(0,255), alphaRange=list(a.getextrema()),
                    cornerAlpha=corners, visibleBoundsAlphaAbove8=a.point(lambda x: 255 if x>8 else 0).getbbox())
    return info

def state():
    p = ROOT / "state.json"
    return read_json(p) if p.exists() else {"schemaVersion":1,"scope":"4 suits + 13 shared ranks; separate from 197 card tasks", "queue":QUEUE,"done":{},"current":None,"createdAt":now()}

def update_state(task=None, attempt=None, stage=None, accepted=None):
    s = state()
    if accepted:
        s["done"][task] = {"attempt":attempt,"record":str(paths(task,attempt)["item"]),"sha256":accepted["production"]["export"]["sha256"],"acceptedAt":now()}
        s["current"] = None
    elif task:
        s["current"] = {"taskId":task,"attempt":attempt,"stage":stage}
    s["updatedAt"] = now()
    write_json(ROOT / "state.json",s)
    manifest()
    return {"done":len(s["done"]),"total":17,"current":s["current"]}

def manifest():
    s=state()
    records=[]
    for task in QUEUE:
        f=ROOT/"逐项记录"/f"{task}.json"
        if task in s["done"]:
            r=read_json(f)
            records.append({"id":task,"kind":task.split("_")[0],"value":task.split("_")[1],"status":"accepted", "file":f"38x34/{task}.png","source":r["source"],"generationId":r["generationId"],"sha256":r["production"]["export"]["sha256"],"rgbaSha256":r["production"]["export"]["rgbaSha256"],"record":f"逐项记录/{task}.json"})
        else:
            records.append({"id":task,"status":"pending"})
    m={"schemaVersion":1,"updatedAt":now(),"total":17,"accepted":len(s["done"]),"pixelSize":[38,34],"uiSize":[19,17],"positionsPx":{"rank":[8,8],"suit":[8,38]},"positionsUi":{"rank":[4,4],"suit":[4,19]},"rankPolicy":"One shared champagne-gold set A,2..10,J,Q,K for all suits", "integrationStatus":"offline assets only; not integrated into game", "layers":records}
    write_json(ROOT/"manifest.json",m)
    return m

def prompt(task, tag):
    kind,value=task.split("_")
    common=[tag,"Use case: stylized-concept. Output exactly ONE standalone functional game UI sprite as a PNG with genuinely transparent alpha background.",
            "The one small reference image is a MATERIAL AND STYLE reference only; its dark preview matte must NOT appear in the output.",
            "Transparent outside the contour and inside all holes. Clean antialiased alpha, no baked checkerboard, no white/gray/black background, no card fragment or rectangular panel.",
            "Landscape canvas aspect 19:17. Leave generous clear padding, keep the complete subject inside the canvas. Legible when downscaled to 19x17 UI units."]
    if kind=="rank":
        common += [f'Text (verbatim): "{value}". This exact rank is the ONLY visible content. Replace the reference numeral 2 with {value}.',
                   "Match the approved numeral 2: upright classical serif, warm ivory/champagne-gold solid face, fine satin texture, restrained bevel, subtle brown edge. Similar stroke weight and serif proportions. No script, no italic, no blackletter or ornamental flourishes.",
                   "Full glyph approximately 82% of canvas height. Keep natural width; visual center around x=42% of canvas, baseline around y=88%; a little less padding above and left than below and right.",
                   "For rank 10, show two clear digits 1 followed by 0, naturally spaced as one rank, complete and proportionate, with neither compression nor clipping."]
    else:
        shapes={"diamond":"a single symmetric DIAMOND suit, straight four-sided elongated rhombus, sharp upper/lower and side corners", "spade":"a single SPade suit, sharp upward tip, two rounded lower lobes and a short centered flared stem", "club":"a single CLUB suit, three round connected lobes (one top and two sides) with a short centered flared stem"}
        material="rich dark ruby-red enamel/crystal" if value=="diamond" else "deep black obsidian / black enamel with restrained cool gray reflections"
        common += [f"Subject: {shapes.get(value,'one HEART suit')}. Only this one standard playing-card suit silhouette.",
                   f"Material: {material}, a very fine champagne-gold beveled contour matching the reference heart. Keep reflections subtle and the body solid and readily recognized at tiny size.",
                   "Center naturally on the canvas, visible height around 76% of canvas; preserve the normal suit's natural width and silhouette, generous transparent border on every side."]
    common += ["No outer ring, medallion, plaque, rays, stars, glow, cast shadow, leaves, text other than the requested rank, extra symbols, watermark, contact sheet or mockup.", "The first bracketed tag is metadata only; never draw it."]
    return "\n".join(common)

def prepare(task,attempt,reference=None,correction=None):
    p=paths(task,attempt)
    tag=f"[TAROT-UI:{task}:v{attempt}]"
    completed=[public_candidate(c) for c in native_candidates(tag)]
    if p["prepared"].exists():
        data=read_json(p["prepared"])
        if sha(Path(data["reference"]["path"]).read_bytes()) != data["reference"]["sha256"]:
            raise ValueError("Frozen reference changed")
    else:
        source=Path(reference).resolve() if reference else TAROT/"红桃2分层"/("red_2.png" if task.startswith("rank_") else "heart.png")
        with Image.open(source) as im:
            im=im.convert("RGBA")
            im.thumbnail((228,204),Image.Resampling.LANCZOS)
            if max(im.size)<100:
                im=im.resize((im.width*6,im.height*6),Image.Resampling.LANCZOS)
            matte=Image.new("RGBA",im.size,(35,34,37,255)); matte.alpha_composite(im)
            buff=BytesIO();matte.convert("RGB").save(buff,"JPEG",quality=88,optimize=True)
        immutable_bytes(p["reference"],buff.getvalue())
        text=prompt(task,tag)
        if correction:
            text += "\nTargeted correction: "+correction
        immutable_bytes(p["prompt"],text.encode("utf-8"))
        data={"taskId":task,"attempt":attempt,"tag":tag,"preparedAt":now(),"referenceSource":str(source),"reference":image_info(p["reference"]),"prompt":text}
        write_json(p["prepared"],data)
    status=update_state(task,attempt,"prepared")
    return {**data,"shouldGenerate":not(completed or p["native"].exists() or task in state()["done"]),"completedNativeCandidates":completed,"state":status}

def normalize(image, task):
    image=image.convert("RGBA")
    # Native PNGs can contain alpha=1..8 specks far outside the visible glyph.
    # Use the same visible-content threshold as the approved layout, retaining
    # a small native-pixel fringe for the antialiased silhouette.
    visible=image.getchannel("A").point(lambda x:255 if x>8 else 0).getbbox()
    bbox=(max(0,visible[0]-4),max(0,visible[1]-4),min(image.width,visible[2]+4),min(image.height,visible[3]+4)) if visible else None
    if not bbox:raise ValueError("Empty alpha")
    crop=image.crop(bbox)
    kind=task.split("_")[0]
    maxw,maxh=(30,28) if kind=="rank" else (28,26)
    scale=min(maxw/crop.width,maxh/crop.height)
    size=(max(1,round(crop.width*scale)),max(1,round(crop.height*scale)))
    resized=crop.resize(size,Image.Resampling.LANCZOS)
    center=16 if kind=="rank" else 19
    x=round(center-size[0]/2); y=30-size[1] if kind=="rank" else round(17-size[1]/2)
    out=Image.new("RGBA",(38,34),(0,0,0,0));out.paste(resized,(x,y))
    buff=BytesIO();out.save(buff,"PNG")
    return buff.getvalue(),{"method":"Crop visible alpha>8 bounds plus 4 native pixels; isotropic LANCZOS resize; transparent padding/translation only", "sourceAlphaBounds":bbox,"sourceVisibleAlphaBounds":visible,"resizedSize":size,"positionPx":[x,y],"targetSize":[38,34],"noProgrammaticGlyphDrawing":True}

def inspection(task,attempt):
    p=paths(task,attempt)
    native=Image.open(p["native"]).convert("RGBA")
    native.thumbnail((300,270),Image.Resampling.LANCZOS)
    sprite=Image.open(p["export"]).convert("RGBA") if p["export"].exists() else None
    canvas=Image.new("RGB",(760,390),(84,87,92)); draw=ImageDraw.Draw(canvas)
    draw.text((10,6),f"{task} v{attempt} | raw style + alpha; 38x34 + 19x17; nearest enlargement",fill="white")
    for x,bg in [(10,(28,29,32,255)),(385,(238,235,227,255))]:
        panel=Image.new("RGBA",(365,350),bg)
        panel.alpha_composite(native,(round((365-native.width)/2),8))
        if sprite:
            panel.alpha_composite(sprite,(16,292));ui=sprite.resize((19,17),Image.Resampling.LANCZOS);panel.alpha_composite(ui,(65,300))
            panel.alpha_composite(sprite.resize((152,136),Image.Resampling.NEAREST),(195,206))
        canvas.paste(panel.convert("RGB"),(x,30))
    p["check"].parent.mkdir(parents=True,exist_ok=True);canvas.save(p["check"],"PNG")
    return str(p["check"])

def persist(r,p):
    write_json(p["record"],r)
    lines=[f"# {r['taskId']} · v{r['attempt']}","",f"状态：{r['status']}",f"来源：{r['source']}",f"生成ID：`{r['generationId']}`",f"原图SHA：`{r['native']['sha256']}`",f"成品SHA：`{(r.get('export') or {}).get('sha256','未导出')}`","", "## 离线验收",""]
    for rev in r["reviews"]:lines += [f"{rev['result']}：{rev['note']}",""]
    lines += ["## 实际提示词","","```text",r["prompt"],"```",""]
    if r.get("revisedPrompt") and r["revisedPrompt"]!=r["prompt"]:lines += ["## 原生返回提示词","","```text",r["revisedPrompt"],"```",""]
    atomic_text(p["markdown"],"\n".join(lines))
    previous=read_json(p["item"]) if p["item"].exists() else None
    if not previous or previous["status"]!="accepted" or previous["attempt"]==r["attempt"]:
        write_json(p["item"],r);atomic_text(p["item_md"],"\n".join(lines))

def save(task,attempt,generation_id=None):
    p=paths(task,attempt)
    if p["record"].exists():
        r=read_json(p["record"])
        if sha(p["native"].read_bytes())!=r["native"]["sha256"]:raise ValueError("Saved native changed")
        return {"alreadySaved":True,"record":str(p["record"]),"status":r["status"],"inspection":inspection(task,attempt)}
    prepared=read_json(p["prepared"])
    matches=native_candidates(prepared["tag"],include_result=True)
    if generation_id:matches=[c for c in matches if c["generationId"]==generation_id]
    if len(matches)!=1:raise ValueError(f"Expected one completed native result, found {len(matches)}; never blindly regenerate")
    c=matches[0];encoded=c["result"]
    if encoded.startswith("data:"):encoded=encoded.split(",",1)[1]
    data=base64.b64decode(encoded,validate=True)
    with Image.open(BytesIO(data)) as im:
        if im.format!="PNG":raise ValueError("Expected native PNG")
    immutable_bytes(p["native"],data)
    info=alpha_info(p["native"])
    export=None;method=None
    if info["actualAlpha"] and info["cornerAlpha"]==[0,0,0,0]:
        with Image.open(BytesIO(data)) as im:out,method=normalize(im,task)
        immutable_bytes(p["export"],out);export=alpha_info(p["export"])
    r={"schemaVersion":1,"taskId":task,"attempt":attempt,"status":"awaiting-review" if export else "alpha-failed", "savedAt":now(),"source":"generated-native", "tool":"OpenAI Responses native image_generation", "generationId":c["generationId"],"generatedAt":c["timestamp"],"prompt":prepared["prompt"],"revisedPrompt":c["revisedPrompt"],"provenance":public_candidate(c),"native":info,"export":export,"normalization":method,"reviews":[],"production":None}
    persist(r,p);inspection(task,attempt);update_state(task,attempt,"saved")
    return {"taskId":task,"status":r["status"],"generationId":r["generationId"],"record":str(p["record"]),"native":info,"export":export,"inspection":str(p["check"])}

def reexport(task,attempt,new_attempt):
    """New immutable candidate revision from an existing native PNG; no AI call."""
    if new_attempt<=attempt or task in state()["done"]:
        raise ValueError("Re-export needs a higher unused revision of an unaccepted item")
    old=paths(task,attempt);p=paths(task,new_attempt)
    if any(p[k].exists() for k in ("native","export","record","prepared","prompt")):
        raise ValueError("Re-export target revision already exists")
    r=read_json(old["record"])
    data=old["native"].read_bytes()
    if sha(data)!=r["native"]["sha256"] or not alpha_info(old["native"])["actualAlpha"]:
        raise ValueError("Source native hash or alpha invalid")
    with Image.open(BytesIO(data)) as im:encoded,method=normalize(im,task)
    immutable_bytes(p["native"],data);immutable_bytes(p["export"],encoded)
    immutable_bytes(p["prompt"],r["prompt"].encode("utf-8"))
    if old["prepared"].exists():
        prepared=read_json(old["prepared"])
        prepared.update(attempt=new_attempt,sourceRevision=attempt,reexportOnly=True)
        write_json(p["prepared"],prepared)
    r.update(attempt=new_attempt,status="awaiting-review",savedAt=now(),
             native=alpha_info(p["native"]),export=alpha_info(p["export"]),
             normalization=method,reviews=[],production=None,
             derivation={"sourceRevision":attempt,"sourceRecord":str(old["record"]),"newGeneration":False,"reason":"Re-normalize the unchanged native PNG into a new immutable candidate revision"})
    persist(r,p);inspection(task,new_attempt);update_state(task,new_attempt,"reexported-awaiting-review")
    return {"taskId":task,"attempt":new_attempt,"generationId":r["generationId"],"newGeneration":False,"export":r["export"],"inspection":str(p["check"])}


def reuse(task):
    if task not in REUSE:raise ValueError("Not an authorized reuse")
    p=paths(task,1);name,expected,gid,promptname=REUSE[task];source=TAROT/"红桃2分层"/name
    data=source.read_bytes()
    if sha(data)!=expected:raise ValueError("Approved source SHA mismatch")
    info=alpha_info(source)
    if not info["actualAlpha"] or info["cornerAlpha"]!=[0,0,0,0] or info["size"]!=[38,34]:raise ValueError("Invalid approved source")
    if p["record"].exists():return {"record":str(p["record"]),"inspection":inspection(task,1),"alreadySaved":True}
    immutable_bytes(p["native"],data);immutable_bytes(p["export"],data)
    text=(TAROT/"提示词"/"分层"/promptname).read_text(encoding="utf-8-sig");immutable_bytes(p["prompt"],text.encode("utf-8"))
    r={"schemaVersion":1,"taskId":task,"attempt":1,"status":"awaiting-review","savedAt":now(),"source":"approved-byte-reuse","sourceFile":str(source),"sourceSha256":expected,"generationId":gid,"prompt":text,"revisedPrompt":None,"native":alpha_info(p["native"]),"export":alpha_info(p["export"]),"normalization":{"method":"Original accepted 38x34 PNG bytes reused without modification; recovered full-resolution historic sources are separately retained under 来源原图 for style reference and provenance"},"reviews":[],"production":None}
    persist(r,p);update_state(task,1,"reused-awaiting-review")
    return {"taskId":task,"record":str(p["record"]),"inspection":inspection(task,1)}

def review(task,attempt,note,reject=False):
    if not note.strip():raise ValueError("Explicit visual note required")
    p=paths(task,attempt);r=read_json(p["record"])
    if r["status"]=="accepted":raise ValueError("Accepted item immutable; review already committed")
    if sha(p["native"].read_bytes())!=r["native"]["sha256"]:raise ValueError("Native changed")
    if not reject:
        if not r["export"]:raise ValueError("Missing alpha-valid export")
        info=alpha_info(p["export"])
        if info["sha256"]!=r["export"]["sha256"] or info["size"]!=[38,34] or not info["actualAlpha"] or info["cornerAlpha"]!=[0,0,0,0]:raise ValueError("Invalid final alpha/size/hash")
    r["status"]="rejected" if reject else "reviewed"
    r["reviews"].append({"at":now(),"result":r["status"],"note":note,"source":"actual visual inspection; manual statement"})
    persist(r,p);update_state(task,attempt,r["status"])
    return {"taskId":task,"status":r["status"],"record":str(p["record"])}

def accept(task,attempt):
    p=paths(task,attempt);r=read_json(p["record"])
    if r["status"] not in ("reviewed","accepted"):raise ValueError("Review required before parent acceptance")
    for key in ("native","export"):
        if sha(p[key].read_bytes())!=r[key]["sha256"]:raise ValueError("Candidate changed")
    immutable_bytes(p["original"],p["native"].read_bytes());immutable_bytes(p["final"],p["export"].read_bytes())
    r["status"]="accepted";r["acceptedAt"]=now();r["production"]={"native":alpha_info(p["original"]),"export":alpha_info(p["final"])}
    persist(r,p);summary=update_state(task,attempt,accepted=r)
    return {"taskId":task,"status":"accepted","production":r["production"],"state":summary}

def main():
    parser=argparse.ArgumentParser(description=__doc__); sub=parser.add_subparsers(dest="command",required=True)
    for command in ("prepare","save","reexport","reuse","inspect","review","accept"):
        p=sub.add_parser(command);p.add_argument("task");p.add_argument("--attempt",type=int,default=1)
        if command=="prepare":p.add_argument("--reference");p.add_argument("--correction")
        if command=="save":p.add_argument("--generation-id")
        if command=="reexport":p.add_argument("--new-attempt",type=int,required=True)
        if command=="review":p.add_argument("--note",required=True);p.add_argument("--reject",action="store_true")
    sub.add_parser("status");args=parser.parse_args()
    if args.command=="status":result={"state":state(),"manifest":manifest()}
    elif args.command=="prepare":result=prepare(args.task,args.attempt,args.reference,args.correction)
    elif args.command=="save":result=save(args.task,args.attempt,args.generation_id)
    elif args.command=="reexport":result=reexport(args.task,args.attempt,args.new_attempt)
    elif args.command=="reuse":result=reuse(args.task)
    elif args.command=="inspect":result={"inspection":inspection(args.task,args.attempt)}
    elif args.command=="review":result=review(args.task,args.attempt,args.note,args.reject)
    else:result=accept(args.task,args.attempt)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=="__main__":
    if hasattr(sys.stdout,"reconfigure"):sys.stdout.reconfigure(encoding="utf-8")
    try:main()
    except (ValueError,OSError,KeyError) as exc:
        print(json.dumps({"error":str(exc)},ensure_ascii=False),file=sys.stderr);raise SystemExit(2)
