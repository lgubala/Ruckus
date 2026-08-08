/* Ruckus — mischief kit. Shared helpers every trick plugin uses.
   Trick files call RKRegistry.trick({ id, plan: function (kit) { ... } }).
   A plan returns { rect, line, take() } or null if there is nothing to use. */
(function (global) {
  'use strict';

  var SKIP = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEXTAREA:1, INPUT:1, SELECT:1,
               OPTION:1, TITLE:1, HEAD:1, IFRAME:1, CANVAS:1 };

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function inView(r) {
    return r.width > 0 && r.height > 0 &&
      r.top > 40 && r.bottom < window.innerHeight - 40 &&
      r.left > 0 && r.right < window.innerWidth;
  }

  function usable(el) {
    if (!el || el.closest('[data-ruckus]')) return false;
    if (el.isContentEditable) return false;
    if (el.closest('input,textarea,select,[contenteditable="true"]')) return false;
    var cs;
    try { cs = getComputedStyle(el); } catch (_) { return false; }
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  }

  /** Build the kit a trick plugin receives. */
  function makeKit(o) {
    var kit = {
      pet: o.pet,
      root: o.root,
      sound: o.sound,
      lines: global.RKLines,
      held: o.held,
      taken: o.taken,
      pick: pick,
      inView: inView,
      usable: usable,
      say: function (path, vars) {
        var L = global.RKLines;
        var text = L ? L.fill(L.get(path), vars) : '';
        if (text && o.pet.say) o.pet.say(text, 2400);
      },

      /** Somewhere with real prose, and a word inside it. */
      findWord: function () {
        var blocks = [];
        var all = document.body
          ? document.body.querySelectorAll('p,li,h1,h2,h3,h4,blockquote,td,figcaption') : [];
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (SKIP[el.tagName] || !usable(el)) continue;
          if ((el.textContent || '').trim().length < 25) continue;
          if (!inView(el.getBoundingClientRect())) continue;
          blocks.push(el);
          if (blocks.length > 60) break;
        }
        if (!blocks.length) return null;

        for (var attempt = 0; attempt < 8; attempt++) {
          var block = pick(blocks);
          var nodes = [];
          var w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
              var pe = n.parentElement;
              if (!pe || SKIP[pe.tagName]) return NodeFilter.FILTER_REJECT;
              if (o.taken.has(n)) return NodeFilter.FILTER_REJECT;
              if (pe.closest('[data-rk-loot]')) return NodeFilter.FILTER_REJECT;
              return /\S{4,}/.test(n.nodeValue || '')
                ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
          });
          var n;
          while ((n = w.nextNode())) nodes.push(n);
          if (!nodes.length) continue;

          var node = pick(nodes);
          var v = node.nodeValue;
          var words = [], re = /\S{4,}/g, m;
          while ((m = re.exec(v)) !== null) words.push([m.index, m.index + m[0].length]);
          if (!words.length) continue;

          var span = pick(words);
          var range = document.createRange();
          try {
            range.setStart(node, span[0]);
            range.setEnd(node, span[1]);
          } catch (_) { continue; }
          var rect = range.getBoundingClientRect();
          if (!inView(rect) || rect.width < 12) continue;
          return { range: range, rect: rect, text: v.slice(span[0], span[1]) };
        }
        return null;
      },

      findImage: function () {
        var imgs = document.images ? Array.prototype.slice.call(document.images) : [];
        var ok = imgs.filter(function (img) {
          if (o.taken.has(img) || !usable(img)) return false;
          var r = img.getBoundingClientRect();
          return r.width >= 60 && r.height >= 60 && inView(r);
        });
        return ok.length ? pick(ok) : null;
      },

      /** Chunky things worth meddling with. */
      targets: function () {
        var out = [];
        var all = document.querySelectorAll('img, h1, h2, h3, figure, blockquote, video, picture');
        for (var i = 0; i < all.length && i < 200; i++) {
          var el = all[i];
          if (o.taken.has(el) || !usable(el)) continue;
          var r = el.getBoundingClientRect();
          if (r.width < 60 || r.height < 24 || !inView(r)) continue;
          out.push(el);
        }
        return out;
      },

      headings: function () {
        var out = [];
        var all = document.querySelectorAll('h1, h2, h3');
        for (var i = 0; i < all.length && i < 40; i++) {
          var el = all[i];
          if (o.taken.has(el) || !usable(el)) continue;
          var r = el.getBoundingClientRect();
          if (r.width < 80 || !inView(r)) continue;
          if ((el.textContent || '').trim().length < 6) continue;
          out.push(el);
        }
        return out;
      },

      /** A visual for something being carried. */
      loot: o.makeLoot,

      /** Make an element inside the overlay. Plugins use this for their own
       *  scenery, so nothing needs a shared effects module. */
      el: function (cls, tag) {
        var n = document.createElement(tag || 'div');
        n.className = cls;
        o.root.appendChild(n);
        return n;
      },

      /** Change an element's inline style, reversibly. */
      styleTrick: function (id, apply, linePath) {
        var opts = kit.targets();
        if (!opts.length) return null;
        var el = pick(opts);
        return {
          rect: el.getBoundingClientRect(),
          line: linePath,
          take: function () {
            if (o.taken.has(el)) return null;
            o.taken.add(el);
            var prev = el.getAttribute('style');
            apply(el);
            var entry = {
              kind: id, loot: null, at: Date.now(),
              restore: function () {
                o.taken.delete(el);
                if (prev === null) el.removeAttribute('style');
                else el.setAttribute('style', prev);
              }
            };
            o.held.push(entry);
            return entry;
          }
        };
      }
    };
    return kit;
  }

  global.RKMischiefKit = { make: makeKit, pick: pick, inView: inView, usable: usable };
})(typeof globalThis !== 'undefined' ? globalThis : window);
