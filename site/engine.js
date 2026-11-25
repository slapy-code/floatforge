/* FloatForge — moteur de calcul des contrats d'échange CS2 (aucune dépendance au DOM).
   Utilisable dans le navigateur (global FF) et dans Node (require). */
(function (root) {
  'use strict';

  // Tranches d'usure (float) : FN, MW, FT, WW, BS
  const WEAR_BOUNDS = [0, 0.07, 0.15, 0.38, 0.45, 1];
  const WEAR_EN = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
  const WEAR_SHORT = ['FN', 'MW', 'FT', 'WW', 'BS'];
  const WEAR_FR = ['Neuve', 'Peu usée', 'Testée sur le terrain', 'Usée', 'Marquée par les combats'];
  const RARITY_FR = ['Qualité consommateur', 'Qualité industrielle', 'Qualité militaire', 'Restreint', 'Classifié', 'Secret', '★ Couteau / gants'];
  const RARITY_EN = ['Consumer Grade', 'Industrial Grade', 'Mil-Spec', 'Restricted', 'Classified', 'Covert', '★ Knife / Gloves'];
  const RARITY_COLOR = ['#b0c3d9', '#5e98d9', '#4b69ff', '#8847ff', '#d32ce6', '#eb4b4b', '#e4ae39'];

  function wearOf(f) {
    if (f == null) return -1; // vanilla : pas d'usure
    for (let w = 0; w < 5; w++) if (f < WEAR_BOUNDS[w + 1]) return w;
    return 4;
  }

  // Nom de marché Steam (market_hash_name) d'un skin pour une usure donnée
  function marketName(skin, wear, st) {
    let n = skin.n;
    if (st) n = n.startsWith('★ ') ? '★ StatTrak™ ' + n.slice(2) : 'StatTrak™ ' + n;
    if (skin.v || wear < 0) return n;
    return n + ' (' + WEAR_EN[wear] + ')';
  }

  function inputsNeeded(rar) { return rar === 5 ? 5 : 10; }

  /* Prépare les index : sorties par collection et rareté. */
  function index(data) {
    const outs = data.collections.map(() => [[], [], [], [], [], [], []]);
    data.skins.forEach((s, i) => {
      if (s.r < 6) s.c.forEach(c => outs[c][s.r].push(i));
    });
    data.outs = outs;
    data.poolKnifeOnly = data.collections.map(c => (c.pool || []).filter(i => !data.skins[i].g));
    return data;
  }

  /* Sorties possibles d'une collection pour des entrées de rareté rar. */
  function outputsOf(data, c, rar, st) {
    if (rar === 5) return st ? data.poolKnifeOnly[c] : (data.collections[c].pool || []);
    if (rar > 5) return [];
    return data.outs[c][rar + 1];
  }

  /* Peut-on utiliser ce skin comme entrée ? Renvoie null si oui, sinon la raison. */
  function inputProblem(data, si, rar, st) {
    const s = data.skins[si];
    if (!s) return 'Skin inconnu';
    if (s.r !== rar) return 'Rareté différente de celle du contrat';
    if (st && !s.st) return "Ce skin n'existe pas en StatTrak™";
    if (!s.c.length) return "Ce skin n'appartient à aucune collection";
    if (!outputsOf(data, s.c[0], rar, st).length)
      return rar === 5 ? "Sa collection n'a pas de couteaux/gants (collection de carte ou Armory)" : "Sa collection n'a pas de rareté supérieure";
    return null;
  }

  /* Cœur du calcul : à partir du nombre d'entrées par collection et des moyennes de float,
     renvoie la liste des issues {s, p, f, w}. */
  function outcomes(data, colCounts, N, rar, st, avgNorm, avgRaw, formula) {
    const m = new Map();
    const avg = formula === 'old' ? avgRaw : avgNorm;
    for (const [c, q] of colCounts) {
      const outs = outputsOf(data, c, rar, st);
      if (!outs.length) continue;
      const p = q / N / outs.length;
      for (const o of outs) {
        const prev = m.get(o);
        if (prev) { prev.p += p; continue; }
        const s = data.skins[o];
        const f = s.v ? null : s.mn + avg * (s.mx - s.mn);
        m.set(o, { s: o, p, f, w: wearOf(f) });
      }
    }
    return [...m.values()];
  }

  /* Statistiques à partir des issues valorisées {p, net} et du coût. */
  function stats(list, cost) {
    const sorted = [...list].sort((a, b) => a.net - b.net);
    let ev = 0, pProfit = 0, pBreak = 0, pHalfLoss = 0, unknown = 0;
    for (const o of list) {
      ev += o.p * o.net;
      if (o.net > cost) pProfit += o.p;
      if (o.net >= cost) pBreak += o.p;
      if (o.net < cost / 2) pHalfLoss += o.p;
      if (o.price == null) unknown += o.p;
    }
    let varc = 0;
    for (const o of list) varc += o.p * (o.net - ev) ** 2;
    let acc = 0, median = sorted.length ? sorted[sorted.length - 1].net : 0;
    for (const o of sorted) { acc += o.p; if (acc >= 0.5 - 1e-9) { median = o.net; break; } }
    const worst = sorted.length ? sorted[0].net : 0;
    const best = sorted.length ? sorted[sorted.length - 1].net : 0;
    return {
      cost, ev, profit: ev - cost, roi: cost > 0 ? (ev - cost) / cost : 0,
      pProfit, pBreak, pHalfLoss, unknown,
      worst, best, median, std: Math.sqrt(varc),
      worstRatio: cost > 0 ? worst / cost : 0, bestRatio: cost > 0 ? best / cost : 0,
      n: list.length
    };
  }

  /* Évalue un contrat complet.
     lines : [{s: indexSkin, f: float, q: quantité, price: prix unitaire ou null}]
     opts  : {rar, st, formula: 'new'|'old', fee: 0..1, priceOf(skinIdx, wear, st)} */
  function evaluate(data, lines, opts) {
    const rar = opts.rar, st = !!opts.st, N = inputsNeeded(rar);
    const errors = [], warnings = [];
    let count = 0, cost = 0, sumN = 0, sumRaw = 0, missingInputPrice = 0;
    const colCounts = new Map();
    for (const l of lines) {
      const q = Math.max(0, Math.floor(l.q || 0));
      if (!q) continue;
      const s = data.skins[l.s];
      const pb = inputProblem(data, l.s, rar, st);
      if (pb) { errors.push((s ? s.n : '?') + ' : ' + pb); continue; }
      let f = +l.f;
      if (!(f >= s.mn && f <= s.mx)) errors.push(s.n + ' : float ' + l.f + ' hors de la plage ' + s.mn + '–' + s.mx);
      f = Math.min(s.mx, Math.max(s.mn, isFinite(f) ? f : s.mn));
      const norm = s.mx > s.mn ? (f - s.mn) / (s.mx - s.mn) : 0;
      count += q; sumN += norm * q; sumRaw += f * q;
      const price = l.price != null && l.price !== '' ? +l.price : null;
      if (price == null || !isFinite(price)) missingInputPrice += q; else cost += price * q;
      const c = s.c[0];
      colCounts.set(c, (colCounts.get(c) || 0) + q);
    }
    if (count !== N) errors.push('Il faut exactement ' + N + ' entrées (actuellement ' + count + ').');
    if (missingInputPrice) warnings.push(missingInputPrice + " entrée(s) sans prix : comptées à 0 dans le coût.");
    const avgNorm = count ? sumN / count : 0, avgRaw = count ? sumRaw / count : 0;
    const fee = opts.fee || 0;
    const list = outcomes(data, colCounts, count || 1, rar, st, avgNorm, avgRaw, opts.formula).map(o => {
      const price = opts.priceOf(o.s, o.w, st);
      return Object.assign(o, { price, net: (price || 0) * (1 - fee) });
    });
    if (list.some(o => o.price == null)) warnings.push("Certaines issues n'ont pas de prix : comptées à 0.");
    return { N, count, avgNorm, avgRaw, colCounts, outcomes: list, stats: stats(list, cost), errors, warnings };
  }

  /* Pour chaque issue : moyenne normalisée maximale pour atteindre chaque usure meilleure. */
  function wearTargets(data, so) {
    const s = data.skins[so];
    if (s.v) return [];
    const res = [];
    for (let w = 0; w < 5; w++) {
      const hi = WEAR_BOUNDS[w + 1];
      if (hi <= s.mn || WEAR_BOUNDS[w] >= s.mx) continue;
      const t = Math.min(1, (hi - s.mn) / (s.mx - s.mn));
      res.push({ w, maxAvg: t });
    }
    return res;
  }

  /* ---------- Générateur ---------- */
  /* Candidats d'entrée par collection (front de Pareto prix / float normalisé). */
  function candidates(data, rar, st, pos, priceOf, opts) {
    opts = opts || {};
    const res = new Map();
    data.collections.forEach((col, c) => {
      if (!outputsOf(data, c, rar, st).length) return;
      const list = [];
      data.skins.forEach((s, si) => {
        if (s.r !== rar || s.c[0] !== c || (st && !s.st)) return;
        for (let w = 0; w < 5; w++) {
          if (opts.wears && !opts.wears[w]) continue;
          const lo = Math.max(WEAR_BOUNDS[w], s.mn), hi = Math.min(WEAR_BOUNDS[w + 1], s.mx);
          if (hi - lo <= 1e-6) continue;
          const f = Math.min(hi - 1e-4, lo + pos * (hi - lo));
          const price = priceOf(si, w, st);
          if (!price || price <= 0) continue;
          list.push({ s: si, c, w, f, price, n: (f - s.mn) / (s.mx - s.mn) });
        }
      });
      list.sort((a, b) => a.price - b.price || a.n - b.n);
      const front = [];
      let bestN = Infinity;
      for (const k of list) if (k.n < bestN - 1e-9) { front.push(k); bestN = k.n; }
      if (front.length) res.set(c, front.slice(0, opts.maxPerCol || 8));
    });
    return res;
  }

  /* Énumère les contrats à 1 ou 2 collections. Appelle onResult(result) pour chacun.
     Renvoie un itérateur pour pouvoir découper le travail (progression). */
  function* generate(data, cfg) {
    const { rar, st, formula, fee, priceOf, pos, maxCols } = cfg;
    const N = inputsNeeded(rar);
    const cands = candidates(data, rar, st, pos, priceOf, cfg);
    const all = [];
    for (const arr of cands.values()) all.push(...arr);
    const priceCache = new Map();
    const pOf = (s, w) => { const k = s * 8 + w + 1; if (!priceCache.has(k)) priceCache.set(k, priceOf(s, w, st)); return priceCache.get(k); };
    const evalMix = (parts) => {
      const colCounts = new Map();
      let cost = 0, sn = 0, sr = 0;
      for (const p of parts) {
        colCounts.set(p.k.c, (colCounts.get(p.k.c) || 0) + p.q);
        cost += p.k.price * p.q; sn += p.k.n * p.q; sr += p.k.f * p.q;
      }
      const list = outcomes(data, colCounts, N, rar, st, sn / N, sr / N, formula).map(o => {
        const price = pOf(o.s, o.w);
        return Object.assign(o, { price, net: (price || 0) * (1 - fee) });
      });
      return { parts, cost, avgNorm: sn / N, avgRaw: sr / N, outcomes: list, stats: stats(list, cost), cols: colCounts.size };
    };
    const total = all.length + (maxCols > 1 ? all.length * (all.length - 1) / 2 : 0);
    let done = 0;
    for (const a of all) { yield { r: evalMix([{ k: a, q: N }]), done: ++done, total }; }
    if (maxCols > 1) {
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j];
          done++;
          if (a.c === b.c && a.s === b.s) continue;
          for (let q = 1; q < N; q++) yield { r: evalMix([{ k: a, q }, { k: b, q: N - q }]), done, total };
        }
      }
    }
  }

  const FF = { WEAR_BOUNDS, WEAR_EN, WEAR_SHORT, WEAR_FR, RARITY_FR, RARITY_EN, RARITY_COLOR,
    wearOf, marketName, inputsNeeded, index, outputsOf, inputProblem, outcomes, stats, evaluate, wearTargets, candidates, generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF; else root.FF = FF;
})(typeof self !== 'undefined' ? self : this);
