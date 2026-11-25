"""Récupère les prix CS2 sur l'API publique Skinport et écrit site/data/prices.json.

Usage : python3 tools/update_prices.py [DEVISE]      (EUR par défaut)
Dépendance : pip install brotli   (Skinport exige Accept-Encoding: br)

Format de sortie (compact) :
{
  "source": "Skinport", "currency": "EUR", "updated": "2026-11-25T14:00:00Z",
  "fields": ["min", "suggested", "qty", "avg24h", "med7d", "med30d", "med90d", "vol7d"],
  "items": { "AK-47 | Redline (Field-Tested)": [12.3, 13.1, 240, 12.9, 12.7, 12.2, 11.8, 410], ... }
}
Limites Skinport : 8 requêtes / 5 min, réponses mises en cache 5 min côté Skinport.
"""
import json
import pathlib
import sys
import time
import urllib.request

try:
    import brotli
except ImportError:  # l'API répond en br : sans brotli, on ne peut pas décoder
    brotli = None

API = 'https://api.skinport.com/v1'
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'site' / 'data' / 'prices.json'


def get(path, currency):
    url = f'{API}/{path}?app_id=730&currency={currency}&tradable=0'
    req = urllib.request.Request(url, headers={'Accept-Encoding': 'br', 'User-Agent': 'FloatForge-price-updater'})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
        if r.headers.get('Content-Encoding') == 'br':
            if brotli is None:
                sys.exit('Installez brotli : pip install brotli')
            raw = brotli.decompress(raw)
    return json.loads(raw)


def keep(name):
    # Armes et couteaux/gants uniquement (pas d'autocollants, caisses, agents…)
    return '|' in name or name.startswith('★')


def r2(x):
    return None if x is None else round(float(x), 2)


def main():
    cur = (sys.argv[1] if len(sys.argv) > 1 else 'EUR').upper()
    items = get('items', cur)
    time.sleep(2)
    hist = {h['market_hash_name']: h for h in get('sales/history', cur)}
    out = {}
    for it in items:
        n = it['market_hash_name']
        if not keep(n):
            continue
        h = hist.get(n, {})
        g = lambda k, f: (h.get(k) or {}).get(f)
        out[n] = [r2(it.get('min_price')), r2(it.get('suggested_price')), it.get('quantity') or 0,
                  r2(g('last_24_hours', 'avg')), r2(g('last_7_days', 'median')), r2(g('last_30_days', 'median')),
                  r2(g('last_90_days', 'median')), g('last_7_days', 'volume') or 0]
    if len(out) < 1000:
        sys.exit(f'Seulement {len(out)} prix reçus : fichier non remplacé.')
    data = {'source': 'Skinport', 'currency': cur, 'updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'fields': ['min', 'suggested', 'qty', 'avg24h', 'med7d', 'med30d', 'med90d', 'vol7d'], 'items': out}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(out)} prix écrits dans {OUT}')


if __name__ == '__main__':
    main()
