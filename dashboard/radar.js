// Launch Radar (radar-5): renders window.RADAR into the board, the detail view, the audit
// tabs and the model panel. No network, no framework: the data script beside the page is the
// whole dataset, and every number on the page comes from it.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) return;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }
  function dollars(n) {
    if (n === null || n === undefined) return '—';
    var sign = n < 0 ? '−$' : '$';
    return sign + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function verdictPill(v) { return '<span class="v ' + v + '">' + v + '</span>'; }

  /* ---------- The proof strip: the fit and its tests, above the fold. ---------- */
  $('asof').textContent = R.as_of;
  var curve = R.curve;
  var val = R.validation;
  $('k-comps').innerHTML = curve.comparables + '<small>traded tokens</small>';
  $('k-slope').innerHTML = curve.slope.toFixed(3) + '<small>log-log slope, R² ' + curve.r_squared.toFixed(3) + '</small>';
  $('k-loo').innerHTML = '×' + val.loo.median_miss_x.toFixed(2) + '<small>median miss, n=' + val.loo.tested + '</small>';
  $('k-b25').innerHTML = '×' + val.blind2025.median_miss_x.toFixed(2) + '<small>blind, ' + val.blind2025.tested + ' tokens since 2025</small>';
  $('k-b24').innerHTML = '×' + val.blind2024.median_miss_x.toFixed(2) + '<small>blind, ' + val.blind2024.tested + ' tokens since 2024</small>';
  $('k-cv').innerHTML = '×' + val.cv_median_miss_x.toFixed(2) + '<small>20 repeats of 5-fold</small>';

  // The dropped variants, in two sentences with their numbers; the quadratic's
  // leave-one-out edge is named honestly and settled by its cross-validation score.
  var dropped = val.dropped;
  var quad = dropped.find(function (d) { return d.name === 'Quadratic curve'; });
  var cat = dropped.find(function (d) { return d.name === 'Category offsets'; });
  var rest = dropped.filter(function (d) { return d !== quad && d !== cat; });
  var restBits = rest.map(function (d) {
    var label = d.name.replace('Fitted ', '').replace('All three fitted together', 'all three together');
    return label + ' ×' + d.loo_median_miss_x.toFixed(2);
  });
  var quadBit = quad.loo_median_miss_x < val.loo.median_miss_x
    ? 'The quadratic edges the pooled line on leave-one-out (×' + quad.loo_median_miss_x.toFixed(2) + ') but misses worse on repeated 5-fold (×' + quad.cv_median_miss_x.toFixed(2) + ')'
    : 'quadratic ×' + quad.loo_median_miss_x.toFixed(2);
  var catBit = (cat.loo_median_miss_x > val.loo.median_miss_x && cat.cv_median_miss_x > val.cv_median_miss_x)
    ? 'category offsets miss worse on both tests (×' + cat.loo_median_miss_x.toFixed(2) + ' / ×' + cat.cv_median_miss_x.toFixed(2) + ')'
    : 'category offsets ×' + cat.loo_median_miss_x.toFixed(2);
  $('proof-dropped').innerHTML = '<b>Six richer fits were tried and dropped</b> — every one misses worse out of sample than the pooled line: ' +
    restBits.join('; ') + '. ' + quadBit + '; ' + catBit + '. Nothing richer beats the straight line, so the model stays simple and says so.';
  $('audit').innerHTML = '<b>' + R.snapshot_size + ' protocols</b> in the snapshot — <b>' + R.board_size + ' ranked</b> below (the whole ' +
    R.watchlist_size + '-protocol watchlist plus ' + R.early_size + ' early finds), <b>' + R.aside_size + ' set aside</b> with a reason each, ' +
    '<b>' + R.traded_size + ' already trading</b>. Verdicts per $1,000: <b>' + R.verdict_counts.FARM + ' FARM</b>, ' +
    R.verdict_counts.THIN + ' THIN, ' + R.verdict_counts.SKIP + ' SKIP.';

  /* ---------- The board: filters, sorts, and the value-band bar. ---------- */
  var logMin = Infinity, logMax = -Infinity;
  R.rows.forEach(function (r) {
    logMin = Math.min(logMin, Math.log10(Math.max(1, r.band_low_usd)));
    logMax = Math.max(logMax, Math.log10(Math.max(1, r.band_high_usd)));
  });
  function bandBar(r) {
    var lo = ((Math.log10(Math.max(1, r.band_low_usd)) - logMin) / (logMax - logMin)) * 100;
    var hi = ((Math.log10(Math.max(1, r.band_high_usd)) - logMin) / (logMax - logMin)) * 100;
    var at = ((Math.log10(Math.max(1, r.implied_value_usd)) - logMin) / (logMax - logMin)) * 100;
    return '<div class="bar"><span class="band" style="left:' + lo.toFixed(1) + '%;width:' + Math.max(hi - lo, 1).toFixed(1) + '%"></span>' +
      '<span class="mark" style="left:' + at.toFixed(1) + '%"></span></div>' +
      '<span class="band-label">' + money(r.band_low_usd) + ' – ' + money(r.band_high_usd) + '</span>';
  }
  function chainsText(chains) { return chains.length ? esc(chains.join(', ')) : '—'; }
  // Short chain list for wide tables and the detail kicker: first n, then "+N more".
  function chainsShort(chains, n) {
    if (!chains.length) return '—';
    if (chains.length <= n) return esc(chains.join(', '));
    return esc(chains.slice(0, n).join(', ')) + ' +' + (chains.length - n) + ' more';
  }

  var SORTS = {
    implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
    net1k: function (a, b) { return b.net_per_1000_usd - a.net_per_1000_usd; },
    perhour: function (a, b) { return b.net_per_hour_usd - a.net_per_hour_usd; },
    slice: function (a, b) { return b.slice_usd - a.slice_usd; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    growth: function (a, b) { return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d); },
    age: function (a, b) { return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days); },
    name: function (a, b) { return a.name.localeCompare(b.name); },
  };

  function fillSelect(sel, values) {
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }
  var cats = Array.from(new Set(R.rows.map(function (r) { return r.category; }).filter(Boolean))).sort();
  var chs = Array.from(new Set(R.rows.reduce(function (acc, r) { return acc.concat(r.chains); }, []))).sort();
  fillSelect($('category'), cats);
  fillSelect($('chain'), chs);

  var selectedSlug = null;
  function visibleRows() {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('category').value, ch = $('chain').value, ver = $('verdict').value;
    var wl = $('watchonly').checked;
    var rows = R.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (cat !== 'all' && r.category !== cat) return false;
      if (ch !== 'all' && r.chains.indexOf(ch) < 0) return false;
      if (ver !== 'all' && r.verdict !== ver) return false;
      if (wl && !r.watchlist) return false;
      return true;
    });
    rows.sort(SORTS[$('sort').value] || SORTS.implied);
    return rows;
  }

  function renderBoard() {
    var rows = visibleRows();
    $('row-count').textContent = '— ' + rows.length + ' of ' + R.rows.length + ' rows';
    $('empty').hidden = rows.length > 0;
    var html = rows.map(function (r) {
      var g = r.change_7d === null ? '—' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(r.change_7d) + '</span>';
      var net = '<span class="' + (r.net_per_1000_usd >= 0 ? 'pos' : 'neg') + '">' + dollars(r.net_per_1000_usd) + '</span>';
      var ph = '<span class="' + (r.net_per_hour_usd >= 0 ? 'pos' : 'neg') + '">' + dollars(r.net_per_hour_usd) + '</span>';
      return '<tr data-slug="' + esc(r.slug) + '"' + (r.slug === selectedSlug ? ' class="sel"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><span class="sub">' + esc(r.slug) + (r.watchlist ? ' · <span class="wl">watchlist</span>' : '') + '</span></td>' +
        '<td>' + verdictPill(r.verdict) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>' +
        '<td class="bandcol">' + bandBar(r) + '</td>' +
        '<td class="num">' + dollars(r.slice_usd) + '</td>' +
        '<td class="num">' + net + '</td>' +
        '<td class="num">' + ph + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + g + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td></tr>';
    }).join('');
    $('board-body').innerHTML = html;
  }
  ['q', 'category', 'chain', 'verdict', 'sort'].forEach(function (id) {
    $(id).addEventListener('input', renderBoard);
  });
  $('watchonly').addEventListener('change', renderBoard);
  $('clear').addEventListener('click', function () {
    $('q').value = ''; $('category').value = 'all'; $('chain').value = 'all';
    $('verdict').value = 'all'; $('watchonly').checked = false; $('sort').value = 'implied';
    renderBoard();
  });
  $('board-body').addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });

  /* ---------- Tabs: the board, the set-aside audit, the traded set. ---------- */
  $('tab-board-n').textContent = '(' + R.board_size + ')';
  $('tab-aside-n').textContent = '(' + R.aside_size + ')';
  $('tab-traded-n').textContent = '(' + R.traded_size + ')';
  $('tabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (!btn) return;
    var tab = btn.getAttribute('data-tab');
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('on', t === btn); });
    ['board', 'aside', 'traded'].forEach(function (t) { $('pane-' + t).hidden = t !== tab; });
  });

  $('aside-n').textContent = R.aside_size;
  var reasonCounts = {};
  R.aside.forEach(function (r) { reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1; });
  $('aside-reasons').textContent = Object.keys(reasonCounts).sort(function (a, b) { return reasonCounts[b] - reasonCounts[a]; })
    .map(function (k) { return k + ': ' + reasonCounts[k]; }).join(' · ');
  $('aside-body').innerHTML = R.aside.map(function (r) {
    return '<tr><td><span class="name">' + esc(r.name) + '</span><span class="sub">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td><td>' + chainsShort(r.chains, 2) + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + ageText(r.age_days) + '</td><td class="wrap">' + esc(r.reason) + '</td></tr>';
  }).join('');

  $('traded-n').textContent = R.traded_size;
  $('comp-n').textContent = R.curve.comparables;
  $('traded-body').innerHTML = R.traded.map(function (r) {
    return '<tr><td><span class="name">' + esc(r.name) + '</span><span class="sub">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td><td>' + chainsShort(r.chains, 2) + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + money(r.mcap_usd) + '</td>' +
      '<td class="num">' + pct(r.change_7d) + '</td></tr>';
  }).join('');

  /* ---------- Detail view: one protocol's working, economics and plan. ---------- */
  function kv(label, value) { return '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>'; }
  function miniRow(label, value) { return '<tr><th>' + label + '</th><td class="num">' + value + '</td></tr>'; }
  function showDetail(slug) {
    var r = R.rows.find(function (x) { return x.slug === slug; });
    if (!r) return;
    selectedSlug = slug;
    document.querySelectorAll('#board-body tr').forEach(function (tr) {
      tr.classList.toggle('sel', tr.getAttribute('data-slug') === slug);
    });
    $('d-rank').textContent = r.rank;
    $('d-cat').innerHTML = esc(r.category || 'no category') + ' · ' + chainsShort(r.chains, 3);
    $('d-name').textContent = r.name + (r.watchlist ? ' ★ watchlist' : '');
    $('d-stats').innerHTML =
      kv('Implied value', money(r.implied_value_usd)) +
      kv('Value band', money(r.band_low_usd) + ' – ' + money(r.band_high_usd)) +
      kv('TVL', money(r.tvl_usd)) +
      kv('7-day growth', pct(r.change_7d)) +
      kv('Age, no token', ageText(r.age_days)) +
      kv('Verdict', verdictPill(r.verdict) + ' ' + dollars(r.net_per_1000_usd)) +
      kv('$1K slice', dollars(r.slice_usd)) +
      kv('Net per hour', dollars(r.net_per_hour_usd)) +
      kv('Hold', r.hold_days + ' days') +
      kv('Hands-on time', r.hands_on_hours + ' h');
    $('d-model').innerHTML =
      miniRow('Curve base: 10^(' + curve.intercept.toFixed(3) + ' + ' + curve.slope.toFixed(3) + ' · log10 TVL)', money(r.base_value_usd)) +
      miniRow('Growth ×' + r.growth_multiplier.toFixed(3) + ' (7d ' + pct(r.change_7d) + ', clamped, half weight)', '×' + r.growth_multiplier.toFixed(3)) +
      miniRow('Maturity ×' + r.maturity_multiplier.toFixed(3) + ' (' + ageText(r.age_days) + ' with no token)', '×' + r.maturity_multiplier.toFixed(3)) +
      miniRow('Chains ×' + r.chain_multiplier.toFixed(3) + ' (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')', '×' + r.chain_multiplier.toFixed(3)) +
      miniRow('Implied value', '<b>' + money(r.implied_value_usd) + '</b>') +
      miniRow('Band (÷ and × ' + R.band_median_miss_x.toFixed(2) + ', the LOO median miss)', money(r.band_low_usd) + ' – ' + money(r.band_high_usd));
    var e = R.model.economics;
    $('d-econ').innerHTML =
      miniRow('Slice: 10% of implied, pro-rata by TVL, on $1,000', dollars(r.slice_usd)) +
      miniRow('Cost: $' + e.setup_gas_usd + ' setup + $' + e.weekly_gas_usd + '/week gas + 4% forgone yield', dollars(r.farm_cost_usd)) +
      miniRow('Net per $1,000', '<b>' + dollars(r.net_per_1000_usd) + '</b>') +
      miniRow('Net per hands-on hour (' + r.hands_on_hours + ' h over ' + r.hold_days + ' days)', dollars(r.net_per_hour_usd)) +
      miniRow('Verdict: FARM at $10+, THIN at $0+, SKIP below $0', verdictPill(r.verdict));
    $('d-steps').innerHTML = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    $('detail').hidden = false;
  }
  $('d-close').addEventListener('click', function () {
    $('detail').hidden = true;
    selectedSlug = null;
    document.querySelectorAll('#board-body tr.sel').forEach(function (tr) { tr.classList.remove('sel'); });
  });

  /* ---------- The model panel: fit table, dropped variants, scatter. ---------- */
  $('fit-line').textContent = 'log10(mcap) = ' + curve.intercept.toFixed(3) + ' + ' + curve.slope.toFixed(3) + ' × log10(TVL), R² ' +
    curve.r_squared.toFixed(3) + ' over ' + curve.comparables + ' traded tokens';
  $('fit-table').innerHTML =
    miniRow('Comparables', curve.comparables + ' traded tokens with market cap above zero') +
    miniRow('Curve', 'log10(mcap) = ' + curve.intercept.toFixed(3) + ' + ' + curve.slope.toFixed(3) + ' × log10(TVL)') +
    miniRow('R²', curve.r_squared.toFixed(3)) +
    miniRow('Leave-one-out median miss', '×' + val.loo.median_miss_x.toFixed(2) + ' — within 2× on ' + Math.round(val.loo.within_2x * 100) + '% of tokens, within 3× on ' + Math.round(val.loo.within_3x * 100) + '%') +
    miniRow('Blind 2025', '×' + val.blind2025.median_miss_x.toFixed(2) + ' on ' + val.blind2025.tested + ' tokens listed after 2025') +
    miniRow('Blind 2024', '×' + val.blind2024.median_miss_x.toFixed(2) + ' on ' + val.blind2024.tested + ' tokens listed after 2024') +
    miniRow('Repeated 5-fold CV', '×' + val.cv_median_miss_x.toFixed(2) + ', mean of 20 repeats') +
    miniRow('Value band', 'implied ÷ and × ' + R.band_median_miss_x.toFixed(2) + ' — the leave-one-out median miss');
  $('drop-table').innerHTML = '<tr><th>Variant tried</th><th class="num">Leave-one-out</th><th class="num">5-fold CV</th><th>Why it lost</th></tr>' +
    val.dropped.map(function (d) {
      return '<tr><td>' + esc(d.name) + '</td><td class="num">×' + d.loo_median_miss_x.toFixed(2) + '</td><td class="num">×' + d.cv_median_miss_x.toFixed(2) + '</td><td>' + esc(d.note) + '</td></tr>';
    }).join('');
  $('best-hour').textContent = 'Best net per hands-on hour: ' + R.best_per_hour.name + ' at ' + dollars(R.best_per_hour.net_per_hour_usd) +
    '/h; best on the watchlist: ' + R.best_per_hour_watchlist.name + ' at ' + dollars(R.best_per_hour_watchlist.net_per_hour_usd) + '/h.';

  var econ = R.model.economics;
  $('econ-notes').innerHTML = [
    'Airdrop pool: ' + Math.round(econ.airdrop_share * 100) + '% of the implied value, shared pro-rata by TVL among depositors.',
    'Position: $' + econ.position_usd.toLocaleString('en-US') + ' of capital; setup gas $' + econ.setup_gas_usd + ', weekly gas $' + econ.weekly_gas_usd + '.',
    'Forgone yield: ' + Math.round(econ.tbill_annual_rate * 100) + '% a year on the position while it sits in the farm.',
    'Hands-on time: ' + econ.setup_minutes + ' min setup, ' + econ.weekly_minutes + ' min a week, ' + econ.claim_minutes + ' min to claim.',
    'Verdict: FARM at $' + econ.farm_at_net_usd + ' net or more, THIN at $' + econ.thin_at_net_usd + ' or more, SKIP below $0.',
  ].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

  /* The scatter: traded tokens against the fitted curve, with the backtest band. */
  (function scatter() {
    var W = 560, H = 340, padL = 46, padB = 34, padT = 10, padR = 10;
    var xs = R.comps.map(function (c) { return c[0]; });
    var ys = R.comps.map(function (c) { return c[1]; });
    var x0 = Math.floor(Math.min.apply(null, xs)), x1 = Math.ceil(Math.max.apply(null, xs));
    var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
    var X = function (x) { return padL + ((x - x0) / (x1 - x0)) * (W - padL - padR); };
    var Y = function (y) { return H - padB - ((y - y0) / (y1 - y0)) * (H - padT - padB); };
    var band = Math.log10(R.band_median_miss_x);
    var parts = [];
    parts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img">');
    for (var gx = x0; gx <= x1; gx++) {
      parts.push('<line x1="' + X(gx).toFixed(1) + '" y1="' + padT + '" x2="' + X(gx).toFixed(1) + '" y2="' + (H - padB) + '" stroke="#e9e5d8" stroke-width="1"/>');
      parts.push('<text x="' + X(gx).toFixed(1) + '" y="' + (H - 10) + '" font-size="10" fill="#8a8f98" text-anchor="middle">10^' + gx + '</text>');
    }
    for (var gy = y0; gy <= y1; gy++) {
      parts.push('<line x1="' + padL + '" y1="' + Y(gy).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(gy).toFixed(1) + '" stroke="#e9e5d8" stroke-width="1"/>');
      parts.push('<text x="' + (padL - 6) + '" y="' + (Y(gy) + 3).toFixed(1) + '" font-size="10" fill="#8a8f98" text-anchor="end">10^' + gy + '</text>');
    }
    var curveTop = [], curveBot = [];
    for (var i = 0; i <= 20; i++) {
      var x = x0 + ((x1 - x0) * i) / 20;
      var y = curve.intercept + curve.slope * x;
      curveTop.push(X(x).toFixed(1) + ',' + Y(y + band).toFixed(1));
      curveBot.push(X(x).toFixed(1) + ',' + Y(y - band).toFixed(1));
    }
    parts.push('<polygon points="' + curveTop.join(' ') + ' ' + curveBot.reverse().join(' ') + '" fill="rgba(11,110,91,0.12)"/>');
    parts.push('<polyline points="' + curveTop.map(function (pt, k) {
      var x = x0 + ((x1 - x0) * k) / 20;
      return X(x).toFixed(1) + ',' + Y(curve.intercept + curve.slope * x).toFixed(1);
    }).join(' ') + '" fill="none" stroke="#0b6e5b" stroke-width="2" stroke-dasharray="6,4"/>');
    R.comps.forEach(function (c) {
      parts.push('<circle cx="' + X(c[0]).toFixed(1) + '" cy="' + Y(c[1]).toFixed(1) + '" r="3" fill="#0b6e5b" fill-opacity="0.55"/>');
    });
    parts.push('<text x="' + ((W + padL - padR) / 2) + '" y="' + (H - 22) + '" font-size="10" fill="#5b6470" text-anchor="middle">log10 TVL (USD)</text>');
    parts.push('<text x="12" y="' + ((H - padB + padT) / 2) + '" font-size="10" fill="#5b6470" text-anchor="middle" transform="rotate(-90 12 ' + ((H - padB + padT) / 2) + ')">log10 market cap (USD)</text>');
    parts.push('</svg>');
    $('scatter').innerHTML = parts.join('');
  })();

  renderBoard();
})();
