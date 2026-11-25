// Tests du moteur : node tests/test_engine.js
const FF = require('../site/engine.js');
const data = FF.index(require('../site/data/cs2.json'));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'ÉCHEC ') + m); if (!c) fails++; };
const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
const idx = n => data.skins.findIndex(s => s.n === n);
const price = () => 1;

// 1. Moyenne normalisée (exemple ZAP : 3× P90 Asiimov 0.25, 2× M4A1-S Cyrex 0.12 → 0.2590)
{
  const asi = data.skins[idx('P90 | Asiimov')], cy = data.skins[idx('M4A1-S | Cyrex')];
  const nA = (0.25 - asi.mn) / (asi.mx - asi.mn), nC = (0.12 - cy.mn) / (cy.mx - cy.mn);
  ok(near((3 * nA + 2 * nC) / 5, 0.2590, 5e-4), 'moyenne normalisée exemple ZAP = ' + ((3 * nA + 2 * nC) / 5).toFixed(4));
}
// 2. Probabilités : 10 entrées d'une collection → somme des probas = 1, uniformes
{
  const s = data.skins.findIndex(s => s.r === 3 && s.c.length && FF.outputsOf(data, s.c[0], 3, false).length);
  const r = FF.evaluate(data, [{ s, f: data.skins[s].mn + 0.01, q: 10, price: 1 }], { rar: 3, st: false, formula: 'new', fee: 0, priceOf: price });
  const sum = r.outcomes.reduce((a, o) => a + o.p, 0);
  ok(r.errors.length === 0, 'contrat mono-collection valide');
  ok(near(sum, 1), 'somme des probabilités = 1');
  ok(r.outcomes.every(o => near(o.p, 1 / r.outcomes.length)), 'issues équiprobables (' + r.outcomes.length + ')');
}
// 3. Mélange 7/3 : P = q/N/nb_sorties
{
  const cols = data.collections.map((c, i) => i).filter(c => data.outs[c][3].length && data.outs[c][4].length);
  const a = data.outs[cols[0]][3][0], b = data.outs[cols[1]][3][0];
  const r = FF.evaluate(data, [{ s: a, f: 0.2, q: 7, price: 1 }, { s: b, f: 0.2, q: 3, price: 1 }], { rar: 3, st: false, formula: 'new', fee: 0, priceOf: price });
  const na = data.outs[cols[0]][4].length, nb = data.outs[cols[1]][4].length;
  const oa = r.outcomes.find(o => data.skins[o.s].c.includes(cols[0]));
  ok(near(oa.p, 0.7 / na), 'proba collection A = 0.7/' + na);
  ok(near(r.outcomes.reduce((x, o) => x + o.p, 0), 1), 'somme = 1 sur mélange');
}
// 4. Float de sortie = min + moyenne × (max − min)
{
  const s = data.skins.findIndex(s => s.r === 4 && s.c.length && FF.outputsOf(data, s.c[0], 4, false).length);
  const sk = data.skins[s], f = sk.mn + 0.3 * (sk.mx - sk.mn);
  const r = FF.evaluate(data, [{ s, f, q: 10, price: 1 }], { rar: 4, st: false, formula: 'new', fee: 0, priceOf: price });
  ok(r.outcomes.every(o => { const x = data.skins[o.s]; return near(o.f, x.mn + 0.3 * (x.mx - x.mn)); }), 'float de sortie normalisé');
}
// 5. Covert → couteaux : 5 entrées, pool de la caisse
{
  const s = data.skins.findIndex(s => s.r === 5 && s.c.length && data.collections[s.c[0]].pool);
  const r = FF.evaluate(data, [{ s, f: 0.1, q: 5, price: 10 }], { rar: 5, st: false, formula: 'new', fee: 0, priceOf: price });
  ok(r.errors.length === 0 && r.outcomes.every(o => data.skins[o.s].r === 6), 'Covert ×5 → uniquement couteaux/gants (' + r.outcomes.length + ' issues)');
  const rst = FF.evaluate(data, [{ s, f: 0.1, q: 5, price: 10 }], { rar: 5, st: true, formula: 'new', fee: 0, priceOf: price });
  ok(rst.outcomes.every(o => !data.skins[o.s].g), 'StatTrak → jamais de gants');
  const bad = FF.evaluate(data, [{ s, f: 0.1, q: 4, price: 10 }], { rar: 5, st: false, formula: 'new', fee: 0, priceOf: price });
  ok(bad.errors.length > 0, '4 entrées Covert refusées');
}
// 6. Stats : médiane / pire / meilleur
{
  const st = FF.stats([{ p: .5, net: 1 }, { p: .3, net: 5 }, { p: .2, net: 20 }], 4);
  ok(near(st.ev, 6.0) && st.median === 1 && st.worst === 1 && st.best === 20 && near(st.pProfit, .5), 'stats EV=6, médiane=1, P(profit)=50 %');
}
// 7. Noms de marché
{
  const k = data.skins[idx('★ Karambit | Fade')];
  ok(FF.marketName(k, 0, true) === '★ StatTrak™ Karambit | Fade (Factory New)', 'nom StatTrak couteau');
  ok(FF.marketName(data.skins[idx('AK-47 | Redline')], 2, false) === 'AK-47 | Redline (Field-Tested)', 'nom AK Redline FT');
}
// 8. Générateur : tourne et donne des résultats cohérents
{
  let n = 0, t = Date.now(), best = null;
  const demo = (s, w) => 1 + ((s * 7 + w * 3) % 11);
  for (const { r } of FF.generate(data, { rar: 3, st: false, formula: 'new', fee: 0, priceOf: demo, pos: 0.5, maxCols: 2 })) {
    n++; if (!best || r.stats.roi > best.stats.roi) best = r;
  }
  ok(n > 1000, 'générateur : ' + n + ' contrats en ' + (Date.now() - t) + ' ms, meilleur ROI ' + (best.stats.roi * 100).toFixed(0) + ' %');
  ok(best.parts.reduce((a, p) => a + p.q, 0) === 10, 'générateur : 10 entrées');
}
console.log(fails ? fails + ' échec(s)' : 'Tous les tests passent');
process.exit(fails ? 1 : 0);
