(function () {
  'use strict';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- theme toggle ---------------- */
  var toggle = document.getElementById('theme-toggle');
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    });
  }

  /* ---------------- reveal on scroll ---------------- */
  var revealEls = document.querySelectorAll('.fade, .reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }
  // Safety net: never leave content hidden (e.g. print, very tall viewports).
  window.addEventListener('beforeprint', function () { revealEls.forEach(function (el) { el.classList.add('in'); }); });

  /* ---------------- nav: scrolled state + active section ---------------- */
  var nav = document.getElementById('nav');
  function onScroll() { if (nav) nav.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window) {
    var visible = {};
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var activeId = null;
      for (var i = 0; i < sections.length; i++) { if (visible[sections[i].id]) { activeId = sections[i].id; break; } }
      links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + activeId); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { navIO.observe(s); });
  }

  /* ---------------- tooltip ---------------- */
  var tip = document.getElementById('tip');
  var tipTargets = document.querySelectorAll('[data-tip]');
  function showTip(el, x, y) {
    var title = el.getAttribute('data-tip-title');
    tip.innerHTML = (title ? '<strong></strong>' : '') + '<span></span>';
    if (title) tip.querySelector('strong').textContent = title;
    tip.querySelector('span').textContent = el.getAttribute('data-tip');
    tip.classList.add('show');
    positionTip(x, y);
  }
  function positionTip(x, y) {
    var r = tip.getBoundingClientRect();
    var left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    var top = y - r.height - 14;
    if (top < 8) top = y + 18;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.classList.remove('show'); }
  tipTargets.forEach(function (el) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('mouseenter', function (e) { showTip(el, e.clientX, e.clientY); });
    el.addEventListener('mousemove', function (e) { positionTip(e.clientX, e.clientY); });
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('focus', function () {
      var r = el.getBoundingClientRect();
      showTip(el, r.left + r.width / 2, r.top);
    });
    el.addEventListener('blur', hideTip);
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ---------------- diagnosis widget ---------------- */
  var dx = document.getElementById('dx-widget');
  if (dx) {
    var ICON_YES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    var ICON_NO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
    var buttons = dx.querySelectorAll('.seg-ctrl button');
    var prompt = document.getElementById('sys-prompt');
    var rows = dx.querySelectorAll('.dx');
    var mode = 'off';

    function render(animate) {
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)); });
      prompt.classList.toggle('off', mode === 'off');
      rows.forEach(function (row) {
        var v = row.getAttribute('data-' + mode);
        var other = row.getAttribute('data-' + (mode === 'on' ? 'off' : 'on'));
        var pill = row.querySelector('.verdict');
        var changed = v !== other;
        pill.className = 'verdict ' + (v === 'yes' ? 'yes' : 'no');
        pill.innerHTML = v === 'yes' ? ICON_YES + 'Correct' : ICON_NO + 'Incorrect';
        if (animate && changed) { void pill.offsetWidth; pill.classList.add('flip'); }
        var tag = row.querySelector('.flip-tag');
        if (!tag) { tag = document.createElement('span'); tag.className = 'flip-tag'; pill.parentNode.appendChild(tag); }
        tag.textContent = changed ? 'flipped' : 'unchanged';
        tag.classList.toggle('muted', !changed);
        tag.classList.toggle('show', mode === 'on');
      });
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.getAttribute('data-mode');
        if (m === mode) return;
        mode = m; render(true);
      });
    });
    render(false);
  }

  /* ---------------- cost calculator ---------------- */
  var calc = document.getElementById('calc');
  if (calc) {
    var inN = document.getElementById('in-n'), inK = document.getElementById('in-k'),
        inM = document.getElementById('in-m'), inE = document.getElementById('in-e');
    var fmt = function (x) { return Math.round(x).toLocaleString('en-US'); };
    function setFill(input) {
      var p = (input.value - input.min) / (input.max - input.min) * 100;
      input.style.setProperty('--p', p + '%');
    }
    function update() {
      var N = +inN.value, k = +inK.value, e = +inE.value / 100;
      if (+inM.value > N) inM.value = N;
      var m = +inM.value;
      var full = N * k;
      var cal = m * k;
      var esc = e * (N - m) * k;
      var hybrid = cal + esc;
      var saved = (N - m) * (1 - e) * k;

      document.getElementById('out-n').textContent = fmt(N);
      document.getElementById('out-k').textContent = k;
      document.getElementById('out-m').textContent = fmt(m);
      document.getElementById('out-e').textContent = Math.round(e * 100) + '%';
      document.getElementById('res-hybrid').innerHTML = fmt(hybrid) + '<small>of ' + fmt(full) + '</small>';
      document.getElementById('res-saved').innerHTML = fmt(saved) + '<small>' + (full ? (saved / full * 100).toFixed(1) : '0') + '%</small>';
      document.getElementById('bar-cal').style.width = (cal / full * 100) + '%';
      document.getElementById('bar-esc').style.width = (esc / full * 100) + '%';
      document.getElementById('num-full').innerHTML = '<strong>' + fmt(full) + '</strong> ratings';
      document.getElementById('num-hybrid').innerHTML = '<strong>' + fmt(hybrid) + '</strong> ratings = ' + fmt(cal) + ' calibration + ' + fmt(esc) + ' escalation';
      [inN, inK, inM, inE].forEach(setFill);
    }
    [inN, inK, inM, inE].forEach(function (i) { i.addEventListener('input', update); });
    update();
  }

  /* ---------------- copy BibTeX ---------------- */
  var copyBtn = document.getElementById('copy-bib');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = document.getElementById('bibtex').textContent;
      var label = copyBtn.querySelector('span');
      function done(ok) {
        label.textContent = ok ? 'Copied' : 'Press ⌘C';
        setTimeout(function () { label.textContent = 'Copy'; }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        try {
          var range = document.createRange();
          range.selectNodeContents(document.getElementById('bibtex'));
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
          done(document.execCommand('copy'));
        } catch (e) { done(false); }
      }
    });
  }

  /* ---------------- figure lightbox ---------------- */
  var fig = document.getElementById('protocol-figure');
  var lb = document.getElementById('lightbox');
  if (fig && lb) {
    var lastFocus = null;
    function open() { lastFocus = document.activeElement; lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); lb.querySelector('button').focus(); document.body.style.overflow = 'hidden'; }
    function close() { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
    fig.addEventListener('click', open);
    fig.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    lb.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lb.classList.contains('open')) close(); });
  }
})();
