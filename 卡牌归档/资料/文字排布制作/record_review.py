from pathlib import Path
import json
import sys

folder = Path(__file__).resolve().parent
record_file = folder.parents[1] / '塔罗牌卡面/文字排布样板/generation-record.json'
record = json.loads(record_file.read_text(encoding='utf-8'))
prefix = {'jiedao':'01_', 'hanbing':'02_', 'wuxie':'03_'}[sys.argv[1]]
variant = next(item for item in record['variants'] if item['file'].startswith(prefix))
variant['status'] = 'visually-reviewed-offline; awaiting user design feedback'
variant['visualReview'] = {'nativeImage':True, 'ui93x130':True, 'inGame':False,
                         'checks':['exact requested title','requested reading order','suit/rank','separation from upper emblem']}
record_file.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(variant['file'], variant['status'])
