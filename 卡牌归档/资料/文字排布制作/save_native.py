import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image

folder = Path(__file__).resolve().parent
tarot = folder.parents[1] / '塔罗牌卡面'
key = sys.argv[1]
definitions = {
    'jiedao': ('01_借刀_梅花Q', '[TITLE-STUDY-JIEDAO-2]', '借刀', '梅花', 'Q', 77, '借刀杀人', '横排一行，左到右'),
    'hanbing': ('02_寒冰箭_黑桃2', '[TITLE-STUDY-HANBING-3]', '寒冰箭', '黑桃', '2', 108, '寒冰剑', '横排一行，左到右'),
    'hanbing_range': ('02_寒冰剑_黑桃2_攻击范围2', '[TITLE-STUDY-HANBING-RANGE-2]', '寒冰剑', '黑桃', '2', 108, '寒冰剑', '三字横排，右下攻击范围徽记2'),
    'wuxie': ('03_无懈可击_梅花K', '[TITLE-STUDY-WUXIE-4]', '无懈可击', '梅花', 'K', 65, '无懈可击', '2×2，上行无懈，下行可击'),
}
name, prefix, label, suit, rank, card_id, original, layout = definitions[key]
matches = []
session_dir = Path('C:/Users/97349/.codex/sessions/2026/10/21')
for session in session_dir.glob('*.jsonl'):
    for line in session.open(encoding='utf-8'):
        if '"image_generation_call"' not in line or prefix not in line:
            continue
        row = json.loads(line)
        payload = row.get('payload', {})
        if payload.get('type') == 'image_generation_call' and payload.get('status') == 'completed' and payload.get('revised_prompt', '').startswith(prefix):
            matches.append((row.get('timestamp', ''), payload))
if not matches:
    raise SystemExit('Expected single-card native result not found')
timestamp, payload = sorted(matches, key=lambda item: item[0])[-1]
output = tarot / '文字排布样板'
prompts = tarot / '提示词/文字排布'
output.mkdir(exist_ok=True)
prompts.mkdir(exist_ok=True)
file = output / f'{name}.png'
if file.exists():
    raise SystemExit('Refusing to overwrite an existing sample')
file.write_bytes(base64.b64decode(payload['result']))
prompt_file = prompts / f'{name}.txt'
prompt_file.write_text(payload['revised_prompt']+'\n', encoding='utf-8')
with Image.open(file) as image:
    native_size = image.size
    native_mode = image.mode
    inspection = image.convert('RGB')
    inspection.thumbnail((465,650), Image.Resampling.LANCZOS)
    inspection.save(folder / f'{key}-review.jpg', quality=85)
    # Local inspection thumbnail only; do not create an extra delivered card set.
    image.convert('RGBA').resize((93,130), Image.Resampling.LANCZOS).save(folder / f'{key}-ui-check.png')
record = {'label':label, 'displayText':label, 'originalName':original, 'cardId':card_id, 'suit':suit, 'rank':rank,
          'layout':layout, 'generationId':payload['id'], 'generatedAt':timestamp,
          'tool':'OpenAI Responses native image_generation', 'file':f'{name}.png',
          'promptFile':f'../提示词/文字排布/{name}.txt', 'nativeSize':native_size, 'nativeMode':native_mode,
          'sha256':hashlib.sha256(file.read_bytes()).hexdigest(), 'status':'saved-awaiting-visual-review',
          'scope':'Single flattened typography preview; not new separated UI layers or game integration.'}
record_file = output/'generation-record.json'
records = json.loads(record_file.read_text(encoding='utf-8')) if record_file.exists() else {'generatedOneAtATime':True,'variants':[]}
records['variants'].append(record)
record_file.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,ensure_ascii=False))
