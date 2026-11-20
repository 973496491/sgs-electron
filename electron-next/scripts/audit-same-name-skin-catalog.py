"""Independent exact-name coverage check against source tables and the emitted catalog."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'tmp/ten-year-userscript-audit-20261120/decoded'
sources = [ROOT / 'tmp/ol-lamp/character.json', DATA / 'GeneralCards.json', DATA / 'GameGeneralConfig.json', DATA / 'GeneralSkinInfoConfig.json']
ol = json.loads(sources[0].read_bytes())['GameCharacters']['character']
tc = {r['CharacterId']: r for r in json.loads(sources[1].read_bytes())['Character']}
gc = {r['GeneralID']: r for r in json.loads(sources[2].read_bytes())['GeneralConf']}
skins = json.loads(sources[3].read_bytes())['SkinConf']
aliases = json.loads(Path(__file__).with_name('ten-year-skin-family-rules.json').read_bytes())['familyAliases']


def text(value):
    return value.replace('&', '').strip() if isinstance(value, str) else ''


targets = [[r['a'], aliases.get(text(r['b']), text(r['b'])), text(r.get('ai')) + text(r['b'])]
           for r in ol if isinstance(r.get('a'), int) and r['a'] > 0 and text(r.get('b'))]
name_map = {r[2]: r[1] for r in targets}
name_map.update({r[1]: r[1] for r in targets})
expected_roles = {}
for gid in set(tc) | set(gc):
    raw = text(tc.get(gid, {}).get('Name'))
    display = text(tc.get(gid, {}).get('ai')) + raw if raw else text(gc.get(gid, {}).get('GeneralName'))
    body = text(gc.get(gid, {}).get('GeneralName'))
    family = name_map.get(display) or name_map.get(aliases.get(body, body))
    if family and display:
        expected_roles[gid] = (family, display)
expected = set()
for row in skins:
    if row['SkinGradeType'] in [7, 8, 10] or not row.get('Resource'):
        continue
    for gid in row.get('RelationGeneralID', []):
        if gid in expected_roles:
            expected.add((row['SkinID'], *expected_roles[gid]))
catalog_path = ROOT / 'electron-next/src/features/ten-year-static-catalog.js'
catalog = json.loads(subprocess.check_output(['node', '-e', 'process.stdout.write(JSON.stringify(require(process.argv[1])()))', str(catalog_path)], encoding='utf-8'))
actual = {(r[0], *p) for r in catalog['skins'] for p in r[8]}
missing = sorted(expected - actual)
target_missing = sorted({r[0] for r in targets} - {r[0] for r in catalog['generals']})
result = {'sourceSha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
          'namedOLIDs': sorted(r[0] for r in targets), 'expectedExactAssociations': sorted(expected),
          'missingAssociations': missing, 'missingNamedOLIDs': target_missing}
audit = ROOT / 'tmp/ten-year-userscript-audit-20261120/same-name-coverage-verification.json'
audit.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
assert not missing and not target_missing, 'same-name candidates missing: ' + repr((missing[:10], target_missing[:10]))
if '--update-fixture' in sys.argv:
    fixture = ROOT / 'electron-next/tests/fixtures/same-name-skin-coverage-20261121.json'
    fixture.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'namedOL': len(targets), 'exactNameRoles': len(expected_roles), 'exactSkinPageAssociations': len(expected),
                  'missing': len(missing), 'missingTargets': len(target_missing)}))
