/* Ruckus — the useful half. Things the pet fetches for you. */
(function (global) {
  'use strict';

  var L = global.RKLines;

  function createTools(o) {
    var root = o.root;
    var api = o.api;

    function say(msg, ms) { if (o.pet && o.pet.say) o.pet.say(msg, ms || 2600); }

    async function toClipboardText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // Clipboard API is blocked on plenty of pages; fall back to the old way.
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand('copy');
          ta.remove();
          return ok;
        } catch (__) { return false; }
      }
    }

    // ---- shareable link straight to the selected text --------------------

    // The selection is snapshotted when the menu opens, because focusing a menu
    // button collapses it before the tool ever runs.
    var savedSelection = '';

    function liveSelection() {
      return String(window.getSelection() || '').replace(/\s+/g, ' ').trim();
    }

    function captureSelection() {
      var live = liveSelection();
      if (live) savedSelection = live;
      return savedSelection;
    }

    function selectionText() {
      return liveSelection() || savedSelection;
    }

    function clearSelection() { savedSelection = ''; }

    /** Uses a text fragment, so the link scrolls to and highlights the quote. */
    function linkToSelection() {
      var text = selectionText();
      if (!text) { say(L.get('tools.needSelection')); return; }
      var base = location.origin + location.pathname + location.search;
      var frag;
      if (text.length <= 120) {
        frag = encodeURIComponent(text);
      } else {
        // start,end form keeps the URL short on long passages
        var words = text.split(' ');
        frag = encodeURIComponent(words.slice(0, 6).join(' ')) + ',' +
               encodeURIComponent(words.slice(-6).join(' '));
      }
      var url = base + '#:~:text=' + frag;
      toClipboardText(url).then(function (ok) {
        say(L.get(ok ? 'tools.linkCopied' : 'tools.noClipboard'));
      });
    }

    function quoteSelection() {
      var text = selectionText();
      if (!text) { say(L.get('tools.needQuote')); return; }
      var out = '"' + text + '"\n\u2014 ' + document.title + '\n' + location.href;
      toClipboardText(out).then(function (ok) {
        say(L.get(ok ? 'tools.quoteCopied' : 'tools.noClipboard'));
      });
    }

    function pageFacts() {
      var words = (document.body.innerText || '').trim().split(/\s+/).length;
      var mins = Math.max(1, Math.round(words / 220));
      say(words.toLocaleString() + ' words \u00b7 about ' + mins + ' min read', 4000);
    }

    // ---- reader mode -----------------------------------------------------
    // Not a dimming veil. The old version put one in our own overlay at max
    // z-index, so the "focused" block could never rise above it. This hides
    // the furniture instead and leaves the article exactly as the site styled
    // it: same fonts, same colours, just without the sidebars.

    var reader = null;

    function findArticle() {
      var direct = document.querySelector('article, [role="article"], main, [role="main"]');
      if (direct && (direct.innerText || '').length > 400) return direct;

      var bodyLen = (document.body.innerText || '').length;
      var best = null, bestScore = 0;
      var cands = document.querySelectorAll('article, main, section, div');
      for (var i = 0; i < cands.length && i < 500; i++) {
        var c = cands[i];
        if (c.closest('[data-ruckus]')) continue;
        var text = (c.innerText || '').length;
        if (text < 400) continue;
        if (bodyLen && text > bodyLen * 0.92) continue;   // that's the whole page
        // Favour prose: lots of paragraph text, few links.
        var paras = c.querySelectorAll('p').length;
        var links = c.querySelectorAll('a').length;
        var score = text * (1 + paras * 0.12) / (1 + links * 0.5);
        if (score > bestScore) { best = c; bestScore = score; }
      }
      return best;
    }

    function enterReader() {
      var article = findArticle();
      if (!article) { say(L.get('tools.noArticle')); return false; }

      var stashed = [];
      function stash(el) {
        stashed.push([el, el.getAttribute('style')]);
      }

      // Walk up to <body>, hiding every sibling on the way. Whatever is left
      // is the chain that contains the article, and the article itself.
      var node = article;
      while (node && node.parentElement && node !== document.body) {
        var parent = node.parentElement;
        var kids = parent.children;
        for (var i = 0; i < kids.length; i++) {
          var kid = kids[i];
          if (kid === node) continue;
          if (kid.hasAttribute('data-ruckus')) continue;
          if (kid.tagName === 'SCRIPT' || kid.tagName === 'STYLE' ||
              kid.tagName === 'LINK' || kid.tagName === 'NOSCRIPT') continue;
          stash(kid);
          kid.style.display = 'none';
        }
        // Ancestors often carry grid or flex layouts sized for the sidebars.
        stash(parent);
        parent.style.display = 'block';
        parent.style.maxWidth = 'none';
        parent.style.width = 'auto';
        parent.style.padding = '0';
        parent.style.margin = '0';
        node = parent;
      }

      stash(article);
      article.style.maxWidth = '46rem';
      article.style.margin = '0 auto';
      article.style.padding = '24px 20px 80px';
      article.style.float = 'none';

      stash(document.body);
      document.body.style.overflowX = 'hidden';

      reader = { entries: stashed, scroll: window.scrollY };
      window.scrollTo({ top: 0, behavior: 'auto' });
      say(L.get('tools.readerOn'), 3200);
      if (o.onTool) o.onTool();
      return true;
    }

    function clearReader() {
      if (!reader) return;
      // Restore in reverse, so nested overrides unwind cleanly.
      for (var i = reader.entries.length - 1; i >= 0; i--) {
        var el = reader.entries[i][0];
        var prev = reader.entries[i][1];
        if (prev === null) el.removeAttribute('style');
        else el.setAttribute('style', prev);
      }
      var back = reader.scroll;
      reader = null;
      window.scrollTo({ top: back, behavior: 'auto' });
    }

    function toggleReader() {
      if (reader) { clearReader(); return; }
      enterReader();
    }

    // ---- stash -----------------------------------------------------------
    // The pet buries a page (and whatever you had selected) for later.

    function stashPage() {
      var item = {
        url: location.href,
        title: (document.title || location.hostname).slice(0, 120),
        note: selectionText().slice(0, 240),
        at: Date.now()
      };
      api.runtime.sendMessage({ type: 'RK_ACTION', action: 'stash', payload: { item: item } })
        .then(function (res) {
          if (res && res.ok) {
            say(L.fill(L.get('tools.buried'), { n: (res.state.stash || []).length }), 3000);
            if (o.pet && o.pet.puff) o.pet.puff('dust', 5, 0, 16);
          }
        })
        .catch(function () { say(L.get('tools.buryFailed')); });
      if (o.onTool) o.onTool();
    }

    // ---- clipboard history ------------------------------------------------
    // Anything you copy on a page gets kept so you can find it again later.
    // Local only, never sent anywhere, and switchable off in Settings.

    function watchClipboard() {
      document.addEventListener('copy', function () {
        if (!o.clipboardEnabled || !o.clipboardEnabled()) return;
        var text = liveSelection();
        if (!text || text.length < 2) return;
        api.runtime.sendMessage({
          type: 'RK_ACTION', action: 'clip',
          payload: { text: text, title: document.title, url: location.href }
        }).catch(function () {});
        if (o.pet && o.pet.puff) o.pet.puff('sparkle', 2);
      }, true);
    }

    function copyText(text) {
      return toClipboardText(text);
    }

    // ---- area snip -------------------------------------------------------

    var snipping = false;

    function snipArea() {
      if (snipping) return;
      snipping = true;

      var mask = document.createElement('div');
      mask.className = 'snip-mask';
      var box = document.createElement('div');
      box.className = 'snip-box';
      var hint = document.createElement('div');
      hint.className = 'snip-hint';
      hint.textContent = L.get('tools.snipHint');
      mask.appendChild(box);
      mask.appendChild(hint);
      root.appendChild(mask);

      var start = null;
      var rect = null;

      function update(e) {
        if (!start) return;
        rect = {
          left: Math.min(start.x, e.clientX),
          top: Math.min(start.y, e.clientY),
          width: Math.abs(e.clientX - start.x),
          height: Math.abs(e.clientY - start.y)
        };
        box.style.left = rect.left + 'px';
        box.style.top = rect.top + 'px';
        box.style.width = rect.width + 'px';
        box.style.height = rect.height + 'px';
        box.classList.add('live');
      }

      function cleanup() {
        snipping = false;
        mask.remove();
        window.removeEventListener('keydown', onKey, true);
      }

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
      }

      mask.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        start = { x: e.clientX, y: e.clientY };
        mask.setPointerCapture(e.pointerId);
      });
      mask.addEventListener('pointermove', update);
      mask.addEventListener('pointerup', function (e) {
        update(e);
        var r = rect;
        cleanup();
        if (!r || r.width < 8 || r.height < 8) return;
        capture(r);
      });
      window.addEventListener('keydown', onKey, true);
    }

    function capture(r) {
      // The overlay must not appear in the shot.
      root.classList.add('invisible');
      // Two frames, so the compositor has definitely dropped it.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          api.runtime.sendMessage({ type: 'RK_CAPTURE' })
            .then(function (res) {
              root.classList.remove('invisible');
              if (!res || !res.ok) {
                say("Couldn't grab that. " + ((res && res.error) || ''), 4000);
                return;
              }
              crop(res.dataUrl, r);
            })
            .catch(function (e) {
              root.classList.remove('invisible');
              say('Snip failed: ' + e, 4000);
            });
        });
      });
    }

    function crop(dataUrl, r) {
      var img = new Image();
      img.onload = function () {
        // captureVisibleTab returns device pixels; the rect is in CSS pixels.
        var scale = img.width / window.innerWidth;
        var c = document.createElement('canvas');
        c.width = Math.round(r.width * scale);
        c.height = Math.round(r.height * scale);
        var ctx = c.getContext('2d');
        ctx.drawImage(img,
          Math.round(r.left * scale), Math.round(r.top * scale),
          c.width, c.height, 0, 0, c.width, c.height);

        c.toBlob(function (blob) {
          if (!blob) { say(L.get('tools.snipEncodeFail')); return; }
          var name = 'snip-' + location.hostname.replace(/^www\./, '') + '-' +
            new Date().toISOString().slice(0, 19).replace(/[:T]/g, '') + '.png';
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 8000);

          copyImage(blob).then(function (copied) {
            say(L.get(copied ? 'tools.snipDone' : 'tools.snipSaved'), 3600);
          });
          if (o.onSnip) o.onSnip();
        }, 'image/png');
      };
      img.onerror = function () { say(L.get('tools.snipDecodeFail')); };
      img.src = dataUrl;
    }

    async function copyImage(blob) {
      try {
        if (!navigator.clipboard || !global.ClipboardItem) return false;
        await navigator.clipboard.write([
          new global.ClipboardItem({ 'image/png': blob })
        ]);
        return true;
      } catch (_) { return false; }
    }

    watchClipboard();

    return {
      captureSelection: captureSelection,
      copyText: copyText,
      toggleReader: toggleReader,
      clearReader: clearReader,
      isReading: function () { return !!reader; },
      stashPage: stashPage,
      clearSelection: clearSelection,
      snipArea: snipArea,
      linkToSelection: linkToSelection,
      quoteSelection: quoteSelection,
      pageFacts: pageFacts,
      hasSelection: function () { return !!selectionText(); }
    };
  }

  global.RKTools = { create: createTools };
})(typeof globalThis !== 'undefined' ? globalThis : window);
