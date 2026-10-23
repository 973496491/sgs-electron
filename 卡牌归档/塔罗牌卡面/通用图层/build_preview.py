"""Build an offline HTML/composite preview from accepted PNG layers only."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
import layer_io as io

ROOT=Path(__file__).resolve().parent

def build():
    manifest=io.manifest()
    accepted=[r for r in manifest["layers"] if r["status"]=="accepted"]
    data=json.dumps(accepted,ensure_ascii=False).replace("</","<\\/")
    template='''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>通用图层 · 四花色与十三点数</title>
<style>
:root{color-scheme:dark;font:15px/1.6 system-ui,"Microsoft YaHei",sans-serif;background:#17191e;color:#e5dfd4}body{max-width:1100px;margin:28px auto;padding:0 20px 50px}h1{font-size:25px}h2{font-size:19px;margin-top:32px}a{color:#dbc08d}p{color:#b9b5ae}label{display:inline-flex;align-items:center;gap:8px;margin:0 18px 12px 0}select{padding:5px 9px}button{padding:5px 12px}.flex{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}.sample{position:relative;width:186px;height:260px;background:#24232a;border:1px solid #685c46;border-radius:8px;overflow:hidden;flex:none}.sample img{position:absolute;pointer-events:none}.sample .base{inset:0;width:186px;height:260px}.sample .rank{left:8px;top:8px;width:38px;height:34px}.sample .suit{left:8px;top:38px;width:38px;height:34px}.ui{width:93px;height:130px;border-radius:4px}.ui .base{width:93px;height:130px}.ui .rank{left:4px;top:4px;width:19px;height:17px}.ui .suit{left:4px;top:19px;width:19px;height:17px}.caption{margin-top:7px;color:#aba79e}.gallery{display:flex;gap:12px;flex-wrap:wrap}.tile{width:144px;border:1px solid #46413a;padding:10px;border-radius:5px}.tile strong{display:block;margin-bottom:8px}.pair{display:flex;gap:8px}.swatch{display:flex;align-items:center;gap:7px;width:70px;height:45px;background:#25262a}.swatch.light{background:#efede6}.asset{width:38px;height:34px}.tiny{width:19px;height:17px}.pending{color:#af8678}.meta{max-width:650px}code{background:#24262c;padding:1px 4px}.links{display:flex;gap:18px;flex-wrap:wrap}
</style>
<h1>通用图层 · 四花色与十三点数</h1>
<p id="progress"></p><p>点数四花色共用一套香槟金衬线字。PNG 为 38×34，界面显示为 19×17；透明背景来自素材 Alpha。</p>
<div class="controls"><label>花色 <select id="suitSelect"></select></label><label>点数 <select id="rankSelect"></select></label><label>检查背景 <select id="background"><option value="dark">深色底</option><option value="light">浅色底</option><option value="card">红桃无中生有底图</option></select></label><label><input id="showRank" type="checkbox" checked>点数</label><label><input id="showSuit" type="checkbox" checked>花色</label></div>
<div class="flex"><div><div id="large" class="sample"><img class="base" alt="已生成的红桃无中生有底图" hidden><img class="rank" alt="点数"><img class="suit" alt="花色"></div><div class="caption">186×260 物理像素</div></div><div><div id="small" class="sample ui"><img class="base" alt="已生成的红桃无中生有底图" hidden><img class="rank" alt="点数"><img class="suit" alt="花色"></div><div class="caption">93×130 UI 实际尺寸</div></div><div class="meta"><p>点数位置：物理 (8,8)，UI (4,4)。花色位置：物理 (8,38)，UI (4,19)。透明留边隔开可见图案；点数保持原先向左、向上的视觉校准。</p><p>纯色底用于核对任意 4×13 组合。可选卡面固定为已完成的红桃无中生有，仅演示叠层位置，不代表任意组合均为真实实体牌。此页面没有接入游戏。</p><div class="links"><a href="manifest.json">图层映射</a><a href="state.json">独立检查点</a><a href="README.md">验收与恢复</a><a href="../preview.html">返回素材预览</a></div></div></div>
<h2>四花色</h2><div id="suits" class="gallery"></div><h2>十三点数</h2><div id="ranks" class="gallery"></div>
<h2>52种组合总览</h2><p>每格为实际UI尺寸左上角裁切，左深底、右浅底；只叠加已验收的PNG图层。</p><a href="52种组合.png"><img src="52种组合.png" alt="四花色与十三点数的52种组合" style="max-width:100%;height:auto"></a>
<script>
const layers=__DATA__;
const byId=new Map(layers.map(x=>[x.id,x]));
const suits=[['heart','红桃'],['diamond','方块'],['spade','黑桃'],['club','梅花']];
const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
document.querySelector('#progress').textContent=`已验收 ${layers.length}/17 项，未完成项明确显示为待制作。`;
function options(id,items,kind){const select=document.getElementById(id);for(const [value,label] of items){const opt=document.createElement('option');opt.value=value;opt.textContent=label;opt.disabled=!byId.has(`${kind}_${value}`);select.append(opt)}const valid=[...select.options].find(x=>!x.disabled);if(valid)select.value=valid.value;}
options('suitSelect',suits,'suit');options('rankSelect',ranks.map(x=>[x,x]),'rank');
function gallery(target,items,kind){for(const [value,label] of items){const tile=document.createElement('div');tile.className='tile';const title=document.createElement('strong');title.textContent=label;tile.append(title);const record=byId.get(`${kind}_${value}`);if(record){for(const bg of ['','light']){const row=document.createElement('div');row.className=`swatch ${bg}`;for(const size of ['asset','tiny']){const img=document.createElement('img');img.src=record.file;img.alt=label;img.className=size;row.append(img)}tile.append(row)}}else{const pending=document.createElement('span');pending.className='pending';pending.textContent='待制作';tile.append(pending)}document.getElementById(target).append(tile)}}
gallery('suits',suits,'suit');gallery('ranks',ranks.map(x=>[x,x]),'rank');
function update(){for(const stage of document.querySelectorAll('.sample')){const bg=document.getElementById('background').value;stage.style.background=bg==='light'?'#efede6':'#24232a';const base=stage.querySelector('.base');base.hidden=bg!=='card';if(bg==='card')base.src='../生产底图/186x260/WuZhongShengYou_png__heart.png';for(const kind of ['rank','suit']){const record=byId.get(`${kind}_${document.getElementById(`${kind}Select`).value}`);const img=stage.querySelector(`.${kind}`);img.hidden=!record||!document.getElementById(kind==='rank'?'showRank':'showSuit').checked;if(record)img.src=record.file;}}}
for(const id of ['suitSelect','rankSelect','background','showRank','showSuit'])document.getElementById(id).addEventListener('change',update);update();
</script></html>'''
    io.atomic_text(ROOT/"preview.html",template.replace('__DATA__',data))
    sheet=Image.new("RGB",(760,80+len(accepted)*66),(80,82,86));draw=ImageDraw.Draw(sheet)
    draw.text((14,12),"Accepted UI sprites | dark + light | 38x34 and 19x17",fill="white")
    for i,item in enumerate(accepted):
        y=50+i*66;draw.text((12,y+18),item['id'],fill="white")
        with Image.open(ROOT/item['file']) as sprite:
            sprite=sprite.convert("RGBA")
            for x,bg in [(160,(27,28,31,255)),(440,(239,237,230,255))]:
                panel=Image.new("RGBA",(260,60),bg)
                panel.alpha_composite(sprite,(12,12));panel.alpha_composite(sprite.resize((19,17),Image.Resampling.LANCZOS),(65,21));panel.alpha_composite(sprite.resize((57,51),Image.Resampling.NEAREST),(120,4))
                sheet.paste(panel.convert("RGB"),(x,y))
    sheet.save(ROOT/"图层总览.png","PNG")
    # Compose existing sprites only; labels and solid inspection backgrounds are
    # outside the delivered assets. Keep each corner at its real 1x UI size.
    combinations=Image.new("RGB",(992,378),(80,82,86));label=ImageDraw.Draw(combinations)
    label.text((12,10),"52 rank/suit corners | actual UI size | dark + light",fill="white")
    by_id={item["id"]:item for item in accepted};count=0
    for row,suit in enumerate(io.SUITS):
        y=50+row*82;label.text((10,y+28),suit,fill="white")
        for col,rank in enumerate(io.RANKS):
            x=82+col*70;label.text((x+27,y),rank,fill="white")
            ids=(f"rank_{rank}",f"suit_{suit}")
            if not all(task in by_id for task in ids):
                label.text((x+10,y+30),"pending",fill=(190,160,150));continue
            for offset,bg in [(0,(27,28,31,255)),(33,(239,237,230,255))]:
                corner=Image.new("RGBA",(30,44),bg)
                for task,pos in zip(ids,[(4,4),(4,19)]):
                    with Image.open(ROOT/by_id[task]["file"]) as sprite:
                        ui=sprite.convert("RGBA").resize((19,17),Image.Resampling.LANCZOS)
                    corner.alpha_composite(ui,pos)
                combinations.paste(corner.convert("RGB"),(x+offset,y+18))
            count+=1
    combinations.save(ROOT/"52种组合.png","PNG")
    return {"accepted":len(accepted),"html":str(ROOT/"preview.html"),"sheet":str(ROOT/"图层总览.png"),"combinedCorners":count,"combinations":str(ROOT/"52种组合.png")}

if __name__=="__main__":
    import sys
    if hasattr(sys.stdout,"reconfigure"):sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(build(),ensure_ascii=False,indent=2))
