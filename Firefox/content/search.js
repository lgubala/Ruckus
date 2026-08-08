/* Ruckus — find on page. Uses the CSS Custom Highlight API where it
   exists (no DOM mutation, much safer on complex pages) and falls back to
   wrapping matches in <mark> elsewhere. */
(function (global) {
  'use strict';

  var MAX_MATCHES = 2000;
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1, HEAD: 1, IFRAME: 1, SVG: 1 };

  var supportsHighlightAPI =
    typeof global.Highlight === 'function' &&
    typeof CSS !== 'undefined' && CSS.highlights;

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ---- document-level styles for ::highlight ---------------------------

  function installHighlightStyles() {
    if (!supportsHighlightAPI) return;
    if (document.getElementById('rk-highlight-style')) return;
    var st = document.createElement('style');
    st.id = 'rk-highlight-style';
    st.textContent =
      '::highlight(rk-match){background-color:rgba(111,242,184,.42);color:inherit;' +
      'text-decoration:underline;text-decoration-color:rgba(60,157,120,.9);' +
      'text-decoration-thickness:2px;text-underline-offset:2px}' +
      '::highlight(rk-current){background-color:#ff9f45;color:#17122a;' +
      'text-decoration:none;font-weight:600}';
    (document.head || document.documentElement).appendChild(st);
  }

  function installFallbackStyles() {
    if (document.getElementById('rk-mark-style')) return;
    var st = document.createElement('style');
    st.id = 'rk-mark-style';
    st.textContent =
      'mark.rk-hl{background:rgba(111,242,184,.42)!important;color:inherit!important;' +
      'padding:0!important;border-radius:0!important;box-shadow:inset 0 -2px 0 rgba(60,157,120,.9)}' +
      'mark.rk-hl.rk-cur{background:#ff9f45!important;color:#17122a!important;font-weight:600}';
    (document.head || document.documentElement).appendChild(st);
  }

  // ---- text harvesting --------------------------------------------------

  function isRendered(el, cache) {
    if (cache.rendered.has(el)) return cache.rendered.get(el);
    var ok = true;
    var cs = null;
    try { cs = getComputedStyle(el); } catch (_) {}
    if (cs) {
      cache.disp.set(el, cs.display);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') ok = false;
      if (ok && el.offsetParent === null && cs.position !== 'fixed' && el !== document.body) {
        // Cheap catch for collapsed or detached subtrees.
        if (!el.getClientRects().length) ok = false;
      }
    }
    cache.rendered.set(el, ok);
    return ok;
  }

  var MAX_CHARS = 3000000;

  function displayOf(el, cache) {
    var key = el;
    if (cache.disp.has(key)) return cache.disp.get(key);
    var d = 'block';
    try { d = getComputedStyle(el).display; } catch (_) {}
    cache.disp.set(key, d);
    return d;
  }

  /** The nearest ancestor that starts a new line box. Text in two different
   *  block containers must not be treated as one continuous string. */
  function blockAncestor(el, cache) {
    if (cache.block.has(el)) return cache.block.get(el);
    var n = el;
    var found = document.body;
    while (n && n !== document.body) {
      var d = displayOf(n, cache);
      // Plain `inline` and `contents` keep the text flowing; everything else
      // (block, inline-block, flex, grid, table-cell, list-item) breaks it.
      if (d !== 'inline' && d !== 'contents' && d !== 'ruby' && d !== 'ruby-text') {
        found = n;
        break;
      }
      n = n.parentElement;
    }
    cache.block.set(el, found);
    return found;
  }

  /**
   * Flatten the page into one searchable string.
   * Whitespace runs collapse to a single space (so a phrase still matches when
   * the HTML source wrapped it across lines) and every emitted character keeps
   * a back-reference to its text node and offset.
   */
  function harvest() {
    var body = document.body;
    var empty = { text: '', nodes: [], segOf: [], offOf: [] };
    if (!body) return empty;

    var cache = { rendered: new Map(), disp: new Map(), block: new Map() };
    var nodes = [];
    var chars = [];
    var segOf = [];
    var offOf = [];
    var prevBlock = null;
    var lastWasSpace = true;

    function pushBreak() {
      if (!chars.length) return;
      chars.push('\n');
      segOf.push(-1);
      offOf.push(-1);
      lastWasSpace = true;
    }

    var walker = document.createTreeWalker(
      body,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: function (node) {
          if (node.nodeType === 1) {
            if (SKIP_TAGS[String(node.tagName).toUpperCase()]) return NodeFilter.FILTER_REJECT;
            if (node.hasAttribute && node.hasAttribute('data-ruckus')) {
              return NodeFilter.FILTER_REJECT;
            }
            if (!isRendered(node, cache)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
          return node.nodeValue && node.nodeValue.length
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 1) {
        if (n.tagName === 'BR') pushBreak();
        continue;
      }
      var parent = n.parentElement;
      if (!parent) continue;

      var blk = blockAncestor(parent, cache);
      if (prevBlock && blk !== prevBlock) pushBreak();
      prevBlock = blk;

      var v = n.nodeValue;
      var segIndex = nodes.length;
      var used = false;

      for (var i = 0; i < v.length; i++) {
        var ch = v.charCodeAt(i);
        var isSpace = ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 12 || ch === 160;
        if (isSpace) {
          if (lastWasSpace) continue;
          chars.push(' ');
          lastWasSpace = true;
        } else {
          chars.push(v[i]);
          lastWasSpace = false;
        }
        segOf.push(segIndex);
        offOf.push(i);
        used = true;
        if (chars.length >= MAX_CHARS) break;
      }

      if (used) nodes.push(n);
      if (chars.length >= MAX_CHARS) break;
    }

    return { text: chars.join(''), nodes: nodes, segOf: segOf, offOf: offOf };
  }

  /** Turn a [start,end) span of the flattened text into DOM sub-ranges,
   *  one per text node the match crosses. */
  function spanToRanges(doc, start, end) {
    var out = [];
    var i = start;
    while (i < end) {
      var seg = doc.segOf[i];
      if (seg < 0) { i++; continue; }
      var j = i;
      while (j + 1 < end && doc.segOf[j + 1] === seg) j++;
      var r = document.createRange();
      try {
        r.setStart(doc.nodes[seg], doc.offOf[i]);
        r.setEnd(doc.nodes[seg], doc.offOf[j] + 1);
        out.push(r);
      } catch (_) {}
      i = j + 1;
    }
    return out;
  }

  // ---- the finder --------------------------------------------------------

  function createFinder(o) {
    var root = o.root;

    function h(tag, attrs, kids) {
      var n = document.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
      (kids || []).forEach(function (c) { n.appendChild(c); });
      return n;
    }

    function toolBtn(act, label, title) {
      return h('button', {
        'class': 'btn', 'data-act': act, 'aria-pressed': 'false',
        title: title, text: label, type: 'button'
      });
    }

    var input = h('input', {
      type: 'text', spellcheck: 'false', autocomplete: 'off',
      placeholder: "type and I'll sniff", 'aria-label': 'Find on page'
    });
    var countEl = h('span', { 'class': 'count', text: '0 / 0' });
    var whoEl = h('span', { 'class': 'who' });
    var faceScale = 2;
    var faceCanvas = h('canvas', {
      width: String(global.RKSprites.CANVAS * faceScale),
      height: String(global.RKSprites.CANVAS * faceScale),
      'aria-hidden': 'true'
    });

    var wrap = h('div', { 'class': 'finder', role: 'search' }, [
      h('div', { 'class': 'lip' }, [h('span', { text: 'Find on page' }), whoEl]),
      h('div', { 'class': 'screen' }, [faceCanvas, input, countEl]),
      h('div', { 'class': 'controls' }, [
        h('button', { 'class': 'btn nav', 'data-act': 'prev', title: 'Previous (Shift+Enter)', text: '\u2191', type: 'button' }),
        h('button', { 'class': 'btn nav', 'data-act': 'next', title: 'Next (Enter)', text: '\u2193', type: 'button' }),
        toolBtn('case', 'Aa', 'Match case'),
        toolBtn('word', 'Ab|', 'Whole words'),
        toolBtn('regex', '.*', 'Regular expression'),
        h('button', { 'class': 'btn close', 'data-act': 'close', title: 'Close (Esc)', text: 'Esc', type: 'button' })
      ])
    ]);

    var ribbon = document.createElement('div');
    ribbon.className = 'ribbon';
    ribbon.setAttribute('aria-hidden', 'true');

    root.appendChild(wrap);
    root.appendChild(ribbon);

    var faceCtx = faceCanvas.getContext('2d');
    faceCtx.imageSmoothingEnabled = false;

    var state = {
      open: false,
      matches: [],     // [{ start, end, ranges }]
      index: 0,
      matchCase: false,
      wholeWord: false,
      regex: false,
      marks: [],
      faceFrame: 0
    };

    var debounce = null;
    var faceTimer = null;

    installHighlightStyles();
    if (!supportsHighlightAPI) installFallbackStyles();

    // ---- little face in the search bar -----------------------------------

    function drawFace() {
      var S = global.RKSprites;
      S.drawFrame(faceCtx, 0, state.matches.length ? 'sniff' : 'idle',
        state.faceFrame, { scale: faceScale, color: state.color, species: state.species });
    }

    function startFace() {
      stopFace();
      faceTimer = setInterval(function () {
        state.faceFrame++;
        drawFace();
      }, 180);
    }
    function stopFace() {
      if (faceTimer) clearInterval(faceTimer);
      faceTimer = null;
    }

    // ---- highlighting -----------------------------------------------------

    function clearHighlights() {
      if (supportsHighlightAPI) {
        CSS.highlights.delete('rk-match');
        CSS.highlights.delete('rk-current');
      }
      if (state.marks.length) {
        state.marks.forEach(function (m) {
          var parent = m.parentNode;
          if (!parent) return;
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          parent.removeChild(m);
          parent.normalize();
        });
        state.marks = [];
      }
    }

    function makeHighlight(ranges) {
      return new (Function.prototype.bind.apply(global.Highlight, [null].concat(ranges)))();
    }

    function paint() {
      if (supportsHighlightAPI) {
        var all = [];
        state.matches.forEach(function (m, i) {
          if (i !== state.index) all = all.concat(m.ranges);
        });
        if (all.length) CSS.highlights.set('rk-match', makeHighlight(all));
        else CSS.highlights.delete('rk-match');

        var cur = state.matches[state.index];
        if (cur && cur.ranges.length) {
          var h = makeHighlight(cur.ranges);
          h.priority = 1;
          CSS.highlights.set('rk-current', h);
        } else {
          CSS.highlights.delete('rk-current');
        }
      } else {
        state.marks.forEach(function (m, i) {
          m.classList.toggle('rk-cur', m.dataset.ppIndex === String(state.index));
        });
      }
      paintRibbon();
    }

    function wrapAll() {
      // Fallback path: wrap from the end backwards so offsets stay valid.
      var flat = [];
      state.matches.forEach(function (m, mi) {
        m.ranges.forEach(function (r) { flat.push({ r: r, mi: mi }); });
      });
      for (var i = flat.length - 1; i >= 0; i--) {
        try {
          var mark = document.createElement('mark');
          mark.className = 'rk-hl';
          mark.dataset.ppIndex = String(flat[i].mi);
          flat[i].r.surroundContents(mark);
          state.marks.unshift(mark);
        } catch (_) {}
      }
    }

    // ---- ribbon ------------------------------------------------------------

    function paintRibbon() {
      ribbon.textContent = '';
      if (!state.matches.length) {
        ribbon.classList.remove('open');
        return;
      }
      ribbon.classList.add('open');
      var docH = Math.max(document.documentElement.scrollHeight, 1);
      var frag = document.createDocumentFragment();
      var seen = {};
      state.matches.forEach(function (m, i) {
        var r = m.ranges[0];
        if (!r) return;
        var rect = r.getBoundingClientRect();
        var absY = rect.top + window.scrollY;
        var pct = Math.max(0, Math.min(100, (absY / docH) * 100));
        var bucket = Math.round(pct * 4);
        if (seen[bucket] && i !== state.index) return;
        seen[bucket] = true;
        var tick = document.createElement('div');
        tick.className = 'tick' + (i === state.index ? ' current' : '');
        tick.style.top = pct.toFixed(2) + '%';
        tick.title = 'Match ' + (i + 1);
        tick.addEventListener('click', function () { go(i); });
        frag.appendChild(tick);
      });
      ribbon.appendChild(frag);
    }

    // ---- searching ----------------------------------------------------------

    function buildRegex(q) {
      var flags = 'g' + (state.matchCase ? '' : 'i');
      var src = state.regex ? q : escapeRe(q);
      if (state.wholeWord && !state.regex) src = '\\b' + src + '\\b';
      return new RegExp(src, flags);
    }

    function run(q) {
      clearHighlights();
      state.matches = [];
      state.index = 0;

      if (!q || (!state.regex && q.length < 2)) {
        countEl.textContent = '0 / 0';
        countEl.className = 'count';
        paintRibbon();
        drawFace();
        return 0;
      }

      var re;
      try {
        re = buildRegex(q);
      } catch (_) {
        countEl.textContent = 'bad pattern';
        countEl.className = 'count miss';
        return 0;
      }

      var doc = harvest();
      var m;
      var guard = 0;
      while ((m = re.exec(doc.text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        var ranges = spanToRanges(doc, m.index, m.index + m[0].length);
        if (ranges.length) state.matches.push({ ranges: ranges });
        if (state.matches.length >= MAX_MATCHES) break;
        if (++guard > 200000) break;
      }

      if (!supportsHighlightAPI) wrapAll();

      countEl.className = 'count ' + (state.matches.length ? 'hit' : 'miss');
      updateCount();
      paint();
      drawFace();

      if (state.matches.length) go(0, true);
      else if (o.onEmpty) o.onEmpty(q);

      if (o.onSearch) o.onSearch(q, state.matches.length);
      return state.matches.length;
    }

    function updateCount() {
      countEl.textContent = state.matches.length
        ? (state.index + 1) + ' / ' + state.matches.length
        : 'no scent';
    }

    function go(i, initial) {
      if (!state.matches.length) return;
      state.index = ((i % state.matches.length) + state.matches.length) % state.matches.length;
      updateCount();
      paint();

      var r = state.matches[state.index].ranges[0];
      if (!r) return;
      var rect = r.getBoundingClientRect();
      var margin = 120;
      if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
        window.scrollTo({
          top: window.scrollY + rect.top - window.innerHeight * 0.38,
          behavior: initial ? 'auto' : 'smooth'
        });
      }
      var settled = false;
      function handoff() {
        if (settled) return;
        settled = true;
        window.removeEventListener('scrollend', handoff);
        var fresh = r.getBoundingClientRect();
        if (o.onFocusMatch) o.onFocusMatch(fresh, state.index, state.matches.length);
        paintRibbon();
      }
      if ('onscrollend' in window) window.addEventListener('scrollend', handoff, { once: true });
      setTimeout(handoff, initial ? 60 : 420);
    }

    // ---- events --------------------------------------------------------------

    input.addEventListener('input', function () {
      clearTimeout(debounce);
      var q = input.value;
      debounce = setTimeout(function () { run(q); }, 140);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        go(state.index + (e.shiftKey ? -1 : 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      e.stopPropagation();
    });

    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'next') go(state.index + 1);
      else if (act === 'prev') go(state.index - 1);
      else if (act === 'close') close();
      else {
        var key = act === 'case' ? 'matchCase' : act === 'word' ? 'wholeWord' : 'regex';
        state[key] = !state[key];
        btn.setAttribute('aria-pressed', String(state[key]));
        run(input.value);
        input.focus();
      }
    });

    var reflow = null;
    window.addEventListener('scroll', function () {
      if (!state.open || !state.matches.length) return;
      clearTimeout(reflow);
      reflow = setTimeout(paintRibbon, 120);
    }, { passive: true });

    // ---- public --------------------------------------------------------------

    function open(seed) {
      state.open = true;
      if (o.onOpen) o.onOpen();
      wrap.classList.add('open');
      startFace();
      drawFace();
      if (seed) input.value = seed;
      input.focus();
      input.select();
      if (input.value) run(input.value);
    }

    function close() {
      state.open = false;
      wrap.classList.remove('open');
      ribbon.classList.remove('open');
      clearHighlights();
      state.matches = [];
      stopFace();
      if (o.onClose) o.onClose();
    }

    function toggle(seed) {
      if (state.open) close(); else open(seed);
    }

    return {
      open: open,
      close: close,
      toggle: toggle,
      isOpen: function () { return state.open; },
      next: function () { go(state.index + 1); },
      prev: function () { go(state.index - 1); },
      setPet: function (view) {
        state.color = view.settings.color || null;
        state.species = view.settings.species || 'ruckus';
        whoEl.textContent = view.name + ' \u00b7 lv' + view.level;
        drawFace();
      }
    };
  }

  global.RKFinder = { create: createFinder, supportsHighlightAPI: supportsHighlightAPI };
})(typeof globalThis !== 'undefined' ? globalThis : window);
