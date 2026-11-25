"""Construit site/data/cs2.json à partir des JSON de ByMykel/CSGO-API.
Usage : python3 -I build_data.py <dossier_json_bruts> <sortie.json>
Fichiers attendus dans le dossier : skins.json, crates.json (API /public/api/en/)."""
import json, sys, os
src, out = sys.argv[1], sys.argv[2]
skins = json.load(open(os.path.join(src, 'skins2.json' if os.path.exists(os.path.join(src,'skins2.json')) else 'skins.json')))
crates = json.load(open(os.path.join(src, 'crates.json')))
RAR = {'Consumer Grade':0,'Industrial Grade':1,'Mil-Spec Grade':2,'Restricted':3,'Classified':4,'Covert':5}
cols, colidx, out_sk, skidx = [], {}, [], {}
def col(c):
    if c['id'] not in colidx:
        colidx[c['id']] = len(cols)
        cols.append({'id': c['id'], 'n': c['name'], 'img': c.get('image'), 'crates': [], 'pool': None})
    return colidx[c['id']]
crate_names, crate_idx = [], {}
def crate(cr):
    if cr['name'] not in crate_idx:
        crate_idx[cr['name']] = len(crate_names); crate_names.append(cr['name'])
    return crate_idx[cr['name']]
seen_names = set()
for s in skins:
    cat = (s.get('category') or {}).get('name')
    special = cat in ('Knives', 'Gloves')
    rn = s['rarity']['name']
    if not special and rn not in RAR: continue
    if s['name'] in seen_names: continue
    seen_names.add(s['name'])
    e = {'n': s['name'], 'r': 6 if special else RAR[rn],
         'mn': s.get('min_float'), 'mx': s.get('max_float'),
         'st': bool(s.get('stattrak')), 'sv': bool(s.get('souvenir')),
         'img': s.get('image'), 'c': [col(c) for c in (s.get('collections') or [])] if not special else [],
         'w': (s.get('weapon') or {}).get('name'), 'k': cat, 'cr': [crate(x) for x in (s.get('crates') or [])]}
    if (s.get('pattern') or {}).get('name'): e['pt'] = s['pattern']['name']
    if s.get('team') and s['team'].get('id') in ('terrorists', 'counter-terrorists'): e['tm'] = 'T' if s['team']['id'] == 'terrorists' else 'CT'
    if special: e['g'] = cat == 'Gloves'
    if e['mn'] is None: e['mn'] = 0
    if e['mx'] is None: e['mx'] = 1
    skidx[s['id']] = len(out_sk); out_sk.append(e)
# pools couteaux/gants par caisse
name2idx = {e['n']: i for i, e in enumerate(out_sk)}
miss = set()
for cr in crates:
    if cr.get('type') != 'Case' or not cr.get('contains_rare'): continue
    pool = []
    for it in cr['contains_rare']:
        i = skidx.get(it['id'], name2idx.get(it['name']))
        if i is None:
            # vanilla : pas dans skins.json → on l'ajoute
            nm = it['name']
            if nm in name2idx: i = name2idx[nm]
            else:
                i = len(out_sk); name2idx[nm] = i
                out_sk.append({'n': nm, 'r': 6, 'mn': 0, 'mx': 1, 'st': True, 'sv': False, 'img': it.get('image'), 'c': [], 'g': 'Gloves' in nm or 'Wraps' in nm, 'v': True})
        if i not in pool: pool.append(i)
    # quelles collections contiennent ce que contient la caisse ?
    cnames = set()
    for it in cr.get('contains', []):
        j = skidx.get(it['id'])
        if j is not None: cnames.update(out_sk[j]['c'])
    for ci in cnames:
        c = cols[ci]; c['crates'].append(cr['name']); c.setdefault('date', cr.get('first_sale_date'))
        c['pool'] = sorted(set((c['pool'] or []) + pool))
for c in cols:
    if not c['crates']: c.pop('crates')
json.dump({'v': 1, 'source': 'ByMykel/CSGO-API', 'collections': cols, 'crates': crate_names, 'skins': out_sk}, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(cols), 'collections', len(out_sk), 'skins', sum(1 for c in cols if c['pool']), 'avec pool', os.path.getsize(out)//1024, 'KB')
