"""Récupère les prix CS2 sur plusieurs marchés et écrit site/data/prices.json.

Usage : python3 tools/update_prices.py [DEVISE]      (EUR par défaut)
Dépendance : pip install brotli   (Skinport exige Accept-Encoding: br)

Sources (toutes publiques, sans clé) :
  - Skinport (API officielle) : prix le plus bas, quantité, ventes 7/30 jours.
  - Market.CSGO (API officielle) : prix le plus bas.
  - prices.csgotrader.app (agrégateur gratuit de l'extension CSGO Trader) : Buff163, YouPin, CSFloat,
    CS.MONEY, BitSkins, Loot.Farm, CSGOEmpire, Swap.gg, Steam… en USD, convertis avec ses taux de change.
Chaque source est facultative : si l'une échoue, les autres sont gardées.

Prix de référence = médiane des marchés « cash » (hors Steam et hors sites d'échange), après retrait
des valeurs aberrantes (moins d'un tiers ou plus du triple de la médiane).

Format de sortie :
{
  "v": 2, "currency": "EUR", "updated": "...Z",
  "markets": ["buff163", ...],                         # ordre des prix par marché
  "fields": ["ref", "low", "med7", "med30", "vol7", "qty", "markets"],
  "items": { "AK-47 | Redline (Field-Tested)": [ref, low, med7, med30, vol7, qty, [p_buff163, ...]] }
}
"""
import gzip
import json
import pathlib
import statistics
import sys
import time
import urllib.request

try:
    import brotli
except ImportError:
    brotli = None

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'site' / 'data' / 'prices.json'

# id, utilisé dans la référence ?
MARKETS = [
    ('buff163', True), ('youpin', True), ('csfloat', True), ('skinport', True), ('marketcsgo', True),
    ('csmoney', True), ('bitskins', True), ('lootfarm', False), ('csgoempire', False), ('swapgg', False),
    ('steam', False),
]
MID = [m for m, _ in MARKETS]
REF = {m for m, r in MARKETS if r}
# clés de l'agrégateur csgotrader → nos identifiants
CSGOTRADER_KEYS = {'buff163': 'buff163', 'youpin': 'youpin', 'csfloat': 'csfloat', 'csmoney': 'csmoney',
                   'bitskins': 'bitskins', 'lootfarm': 'lootfarm', 'csgoempire': 'csgoempire', 'swapgg': 'swapgg',
                   'steam': 'steam', 'skinport': 'skinport', 'csgotm': 'marketcsgo'}


def fetch(url):
    req = urllib.request.Request(url, headers={'Accept-Encoding': 'br, gzip', 'User-Agent': 'FloatForge-price-updater'})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
        enc = r.headers.get('Content-Encoding')
        if enc == 'br':
            if brotli is None:
                raise RuntimeError('brotli manquant : pip install brotli')
            raw = brotli.decompress(raw)
        elif enc == 'gzip':
            raw = gzip.decompress(raw)
    return json.loads(raw)


def keep(name):
    return ('|' in name or name.startswith('★')) and not name.startswith('Sticker') and not name.startswith('Patch')


def num(v):
    """Extrait un prix d'une valeur de l'agrégateur (nombre, texte ou objet)."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v) if v > 0 else None
    if isinstance(v, str):
        try:
            x = float(v)
            return x if x > 0 else None
        except ValueError:
            return None
    if isinstance(v, dict):
        for k in ('starting_at', 'price', 'last_24h', 'last_7d', 'last_30d', 'last_90d', 'suggested_price', 'instant_sale_price'):
            if k in v:
                x = num(v[k])
                if x:
                    return x
    return None


def main():
    cur = (sys.argv[1] if len(sys.argv) > 1 else 'EUR').upper()
    prices = {}   # nom → {marché: prix}
    extra = {}    # nom → [med7, med30, vol7, qty]
    report = {}

    def put(name, market, p):
        if p and p > 0 and keep(name):
            prices.setdefault(name, {})[market] = round(p, 2)

    # 1. Agrégateur csgotrader (USD → devise)
    try:
        fx = fetch('https://prices.csgotrader.app/latest/exchange_rates.json')
        rate = float(fx.get(cur, 1.0)) / float(fx.get('USD', 1.0))
        agg = fetch('https://prices.csgotrader.app/latest/prices_v6.json')
        counts = {}
        for name, entry in agg.items():
            if not isinstance(entry, dict) or not keep(name):
                continue
            for k, mid in CSGOTRADER_KEYS.items():
                p = num(entry.get(k))
                if p:
                    put(name, mid, p * rate)
                    counts[mid] = counts.get(mid, 0) + 1
        report['csgotrader'] = counts
    except Exception as e:  # noqa: BLE001
        report['csgotrader'] = f'échec : {e}'

    # 2. Skinport (officiel, prioritaire sur l'agrégateur pour Skinport)
    try:
        items = fetch(f'https://api.skinport.com/v1/items?app_id=730&currency={cur}&tradable=0')
        n = 0
        for it in items:
            name = it['market_hash_name']
            if keep(name) and it.get('min_price'):
                put(name, 'skinport', it['min_price'])
                extra.setdefault(name, [None, None, 0, 0])[3] = it.get('quantity') or 0
                n += 1
        report['skinport'] = n
        time.sleep(2)
        try:
            for h in fetch(f'https://api.skinport.com/v1/sales/history?app_id=730&currency={cur}'):
                name = h['market_hash_name']
                if not keep(name):
                    continue
                e = extra.setdefault(name, [None, None, 0, 0])
                e[0] = (h.get('last_7_days') or {}).get('median')
                e[1] = (h.get('last_30_days') or {}).get('median')
                e[2] = (h.get('last_7_days') or {}).get('volume') or 0
            report['skinport_history'] = 'ok'
        except Exception as e:  # noqa: BLE001
            report['skinport_history'] = f'échec : {e}'
    except Exception as e:  # noqa: BLE001
        report['skinport'] = f'échec : {e}'

    # 3. Market.CSGO (officiel)
    try:
        j = fetch(f'https://market.csgo.com/api/v2/prices/{cur}.json')
        n = 0
        for it in j.get('items', []):
            p = num(it.get('price'))
            if p:
                put(it['market_hash_name'], 'marketcsgo', p)
                n += 1
        report['marketcsgo'] = n
    except Exception as e:  # noqa: BLE001
        report['marketcsgo'] = f'échec : {e}'

    out = {}
    for name, mk in prices.items():
        cash = [p for m, p in mk.items() if m in REF]
        ref = low = None
        if cash:
            med = statistics.median(cash)
            good = [p for p in cash if med / 3 <= p <= med * 3] or cash
            ref, low = round(statistics.median(good), 2), round(min(good), 2)
        elif 'steam' in mk:  # dernier recours : Steam seul
            ref = low = mk['steam']
        e = extra.get(name, [None, None, 0, 0])
        out[name] = [ref, low, e[0], e[1], e[2], e[3], [mk.get(m) for m in MID]]

    print(json.dumps(report, ensure_ascii=False, indent=1))
    if len(out) < 1000:
        sys.exit(f'Seulement {len(out)} prix : fichier non remplacé.')
    data = {'v': 2, 'currency': cur, 'updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'markets': MID, 'ref_markets': sorted(REF),
            'fields': ['ref', 'low', 'med7', 'med30', 'vol7', 'qty', 'markets'], 'items': out}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(out)} articles écrits dans {OUT}')


if __name__ == '__main__':
    main()
