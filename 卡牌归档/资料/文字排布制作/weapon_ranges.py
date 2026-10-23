from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

folder = Path(__file__).resolve().parent
archive = folder.parents[1]
config_path = archive / '卡牌拆分/source/junzheng-check/sys_playcard.json'
config = json.loads(config_path.read_text(encoding='utf-8-sig'))
source = json.loads((config_path.parent / 'source.json').read_text(encoding='utf-8-sig'))
short = {row['Long']:row['Short'] for row in config['abbreviation'] if 'Long' in row and 'Short' in row}
assert short['attRange'] == 'h'
cards = config['GamePlayCards']['card']
rows = []
for card in cards:
    if 1 <= card['a'] <= 161 and card.get('c') == 3 and card.get('d') == 1:
        rows.append({'cardId':card['a'], 'name':card['b'], 'number':card['f'], 'color':card['g'],
                     'attackRange':card['h'], 'res':card.get('p')})
hanbing = next(row for row in rows if row['cardId'] == 108)
book = next(row for row in config['CardsBook'] if row.get('Model') == 1 and row.get('ModelTab') == 2 and row.get('cardid') == 108)
assert hanbing['attackRange'] == 2 and book['dese'].startswith('攻击范围：2')
report = {'verifiedAt':datetime.now(timezone.utc).isoformat(), 'configFile':'../../../卡牌拆分/source/junzheng-check/sys_playcard.json',
          'configSha256':hashlib.sha256(config_path.read_bytes()).hexdigest(), 'officialSource':source,
          'mapping':{'h':'attRange','i':'attDistance','j':'defDistance'}, 'scope':'军争牌ID1～161中的装备武器(type=3,subType=1)',
          'weapons':rows, 'hanbingBookEntry':book,
          'crossModeExample':next(card for card in cards if card['a']==2035),
          'note':'Range is distinct from rank and attack/defence distance; same-name cards in other modes may have a different attRange.'}
out = archive / '塔罗牌卡面/文字排布样板/weapon-range-source.json'
report['configFile'] = '../../卡牌拆分/source/junzheng-check/sys_playcard.json'
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'hanbing':hanbing,'weaponRows':len(rows),'weaponTextures':len({r['res'] for r in rows}),'saved':str(out)},ensure_ascii=False))
