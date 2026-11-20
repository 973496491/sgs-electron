"""Build all same-name static candidates and a coverage audit; no network or version edits."""
from pathlib import Path
from collections import Counter
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'tmp/ten-year-userscript-audit-20261120/decoded'
ol_path = ROOT / 'tmp/ol-lamp/character.json'
ten_path = DATA / 'GeneralCards.json'
general_path = DATA / 'GameGeneralConfig.json'
skin_path = DATA / 'GeneralSkinInfoConfig.json'
version_path = ROOT / 'tmp/sgs10-skins-20261118/version.json'
family_rules_path = Path(__file__).with_name('ten-year-skin-family-rules.json')
verified_path = Path(__file__).with_name('ten-year-static-verified.json')
paths = [ol_path, ten_path, general_path, skin_path, version_path, family_rules_path, verified_path]
ol = json.loads(ol_path.read_bytes())['GameCharacters']['character']
ten = json.loads(ten_path.read_bytes())['Character']
general_by_id = {r['GeneralID']: r for r in json.loads(general_path.read_bytes())['GeneralConf']}
skins = json.loads(skin_path.read_bytes())['SkinConf']
versions = json.loads(version_path.read_bytes())
family_aliases = json.loads(family_rules_path.read_bytes())['familyAliases']
verified = json.loads(verified_path.read_bytes())['pairs']


def name(value):
    return value.replace('&', '').strip() if isinstance(value, str) else ''


named_ol = [r for r in ol if isinstance(r.get('a'), int) and r['a'] > 0 and name(r.get('b'))]
# A mode/ID/type is not an admission whitelist for local display candidates.
generals = [[r['a'], family_aliases.get(name(r['b']), name(r['b'])), name(r.get('ai')) + name(r['b'])] for r in named_ol]
families = {r[1] for r in generals}
label_family = {r[2]: r[1] for r in generals}


def direct_family(label):
    canonical = family_aliases.get(label, label)
    return label_family.get(label) or (canonical if canonical in families else None)


# Learn version tokens from explicit OL prefix fields and corroborated official
# display/base pairs. This does not gate same-name records by type.
prefix_sources = {}
for r in named_ol:
    prefix = name(r.get('ai'))
    if prefix and r.get('e', 0) > 0:
        prefix_sources.setdefault(prefix, []).append(['OL-prefix', r['a']])
for r in ten:
    display = name(r.get('ai')) + name(r.get('Name'))
    general = general_by_id.get(r['CharacterId'], {})
    base = name(general.get('GeneralName'))
    if (base and direct_family(base) and r.get('exType', 0) > 0
            and r.get('exType') == general.get('ExType') and display.endswith(base) and len(display) > len(base)):
        prefix_sources.setdefault(display[:-len(base)], []).append(['official-display-base', r['CharacterId']])
prefixes = sorted(prefix_sources, key=lambda token: (-len(token), token))


def match_family(label):
    exact = direct_family(label)
    if exact:
        return exact, 'same-name'
    for prefix in prefixes:
        if label.startswith(prefix):
            family = direct_family(label[len(prefix):])
            if family:
                return family, 'learned-version:' + prefix
    return None, 'no-same-name'


character_by_id = {r['CharacterId']: r for r in ten}
mapped = {}
unmapped = []
exact_missing = []
for gid in sorted(set(character_by_id) | set(general_by_id)):
    if not isinstance(gid, int) or gid <= 0:
        continue
    r = character_by_id.get(gid, {})
    g = general_by_id.get(gid, {})
    raw = name(r.get('Name'))
    display = name(r.get('ai')) + raw if raw else name(g.get('GeneralName'))
    if not display:
        unmapped.append({'id': gid, 'reason': 'missing-name'})
        continue
    family, reason = match_family(display)
    if not family:
        family, reason = match_family(name(g.get('GeneralName')) or raw)
        if family:
            reason = 'official-base/' + reason
    parent = g.get('BaseGeneralID')
    visited = {gid}
    while not family and parent and parent not in visited:
        visited.add(parent)
        p = general_by_id.get(parent, {})
        if parent in mapped:
            family, reason = mapped[parent]['family'], 'resolved-parent'
        else:
            for parent_name in [name(p.get('GeneralName')), name(character_by_id.get(parent, {}).get('Name'))]:
                family, reason = match_family(parent_name)
                if family:
                    break
        if family:
            reason = 'official-parent/' + reason
        parent = p.get('BaseGeneralID')
    if family:
        mapped[gid] = {'id': gid, 'family': family, 'label': display, 'reason': reason}
    else:
        unmapped.append({'id': gid, 'label': display, 'officialName': g.get('GeneralName'), 'reason': 'no-OL-name-match'})
for gid in set(character_by_id) | set(general_by_id):
    r, g = character_by_id.get(gid, {}), general_by_id.get(gid, {})
    raw = name(r.get('Name'))
    display = name(r.get('ai')) + raw if raw else name(g.get('GeneralName'))
    if (direct_family(display) or direct_family(name(g.get('GeneralName')))) and gid not in mapped:
        exact_missing.append(gid)
assert not exact_missing, 'same-name roles were omitted: ' + repr(exact_missing)

rows = []
asset_counts = Counter()
asset_audit = []
skipped = []
for r in skins:
    if r['SkinGradeType'] in [7, 8, 10]:
        skipped.append({'id': r['SkinID'], 'reason': 'dynamic-only-scope'})
        continue
    pages = {(mapped[i]['family'], mapped[i]['label']) for i in r.get('RelationGeneralID', []) if i in mapped}
    if not pages:
        hint = name(r.get('ItemName', '')).split('*')[-1]
        family, _ = match_family(hint)
        if family:
            pages.add((family, hint))
    if not pages:
        skipped.append({'id': r['SkinID'], 'name': r.get('ItemName'), 'reason': 'no-same-name-role'})
        continue
    resource = str(r.get('Resource') or '').strip()
    if not resource:
        skipped.append({'id': r['SkinID'], 'name': r.get('ItemName'), 'reason': 'missing-resource'})
        continue
    big = 'res/assets/runtime/general/big/static/' + resource + '.png'
    seat = 'res/assets/runtime/general/seat/static/' + resource + '.png'
    evidence = verified.get(resource, {})
    confirmed = all(evidence.get(kind, {}).get('status') == 200 and evidence[kind].get('pngDimensions')
                    and evidence[kind].get('sha256') and evidence[kind].get('url', '').split('?')[0] ==
                    'https://web.sanguosha.com/10/pc/' + uri for kind, uri in [('big', big), ('seat', seat)])
    state = 'manifest-pair' if big in versions and seat in versions else 'verified-pair' if confirmed else 'check-on-selection'
    asset_counts[state] += 1
    asset_audit.append({'id': r['SkinID'], 'resource': resource, 'state': state, 'pages': sorted(pages)})
    rows.append([r['SkinID'], resource, r['ItemName'].split('*')[0], r['SkinGradeType'], r.get('Painter', ''),
                 int(bool(r.get('IsBanner'))), versions.get(big, ''), versions.get(seat, ''), sorted(pages)])
rows.sort(key=lambda r: r[0])
hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
role_versions = {(r['family'], r['label']) for r in mapped.values()}
roles_with_static = {tuple(p) for row in rows for p in row[8]}
named_versions = sorted(role_versions | roles_with_static)
result = {'generals': generals, 'skins': rows, 'versions': named_versions, 'familyAliases': family_aliases}
output = ROOT / 'electron-next/src/features/ten-year-static-catalog.js'
output.write_text('// Generated by scripts/build-ten-year-static-catalog.py; all same-name static candidates.\n'
                  '// Source SHA256: ' + json.dumps(hashes, ensure_ascii=False) + '\n'
                  'module.exports = function getTenYearStaticCatalog() { return '
                  + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '; };\n', encoding='utf-8')
audit = {'sourceSha256': hashes, 'summary': {'namedOL': len(generals), 'matchedTenRoles': len(mapped),
         'staticCandidates': len(rows), 'pagesWithStatic': len(roles_with_static), 'roleVersions': len(role_versions), 'namedVersions': len(named_versions), 'sameNameMissing': exact_missing,
         'assetStates': dict(asset_counts)}, 'learnedPrefixes': prefix_sources,
         'matchedRoles': list(mapped.values()), 'noStaticRoles': [r for r in mapped.values() if (r['family'], r['label']) not in roles_with_static],
         'unmatchedRoles': unmapped, 'skippedSkins': skipped, 'assets': asset_audit}
audit_path = ROOT / 'tmp/ten-year-userscript-audit-20261120/full-name-catalog-audit.json'
audit_path.parent.mkdir(parents=True, exist_ok=True)
audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(audit['summary'], ensure_ascii=False))
