"""Assemble dist/index.html (engine.js inliné) + dist/data/cs2.json pour une publication en un seul HTML.
Usage : python3 -I tools/build_dist.py"""
import pathlib
import shutil

root = pathlib.Path(__file__).resolve().parent.parent
site, dist = root / 'site', root / 'dist'
(dist / 'data').mkdir(parents=True, exist_ok=True)
html = (site / 'index.html').read_text(encoding='utf-8')
eng = (site / 'engine.js').read_text(encoding='utf-8')
html = html.replace('<script src="engine.js"></script>', '<script>\n' + eng + '\n</script>')
(dist / 'index.html').write_text(html, encoding='utf-8')
shutil.copy(site / 'data' / 'cs2.json', dist / 'data' / 'cs2.json')
print('dist prêt :', (dist / 'index.html').stat().st_size // 1024, 'KB')
