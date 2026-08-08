/* Ruckus — the brain.
 *
 * A small weighted engine over the plugin registry. It owns no behaviour of
 * its own: it builds a context, asks which quirks are eligible, weighs them,
 * and runs one.
 *
 * To add something the pet does, drop a file in content/quirks/ .
 * To change how often it happens, edit core/config.js .
 * To change what it says, edit core/lines.js . */
(function (global) {
  'use strict';

  var CFG = global.RKConfig || { timing: {} };
  var L = global.RKLines;
  var pick = L ? L.pick : function (a) { return a[0]; };

  function timeBand(hour) {
    if (hour < 6) return 'night';
    if (hour < 11) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  }

  function createBrain(o) {
    var lastRun = {};       // quirk id -> when it last fired
    var lastAction = 0;
    var greeted = false;
    var busy = false;
    var lastChoice = null;
    var lastWeights = null;

    // ---- things quirks can look for on the page ---------------------------

    function visible(el) {
      if (!el || el.closest('[data-ruckus]')) return null;
      var r = el.getBoundingClientRect();
      if (r.width < 30 || r.height < 16) return null;
      if (r.top < 60 || r.bottom > window.innerHeight - 40) return null;
      return r;
    }

    // One decision may ask for buttons, photos and words. Cache each query for
    // the length of a single decision rather than walking the DOM three times.
    var scan = { at: 0, hits: {} };

    function cached(key, fn) {
      var now = Date.now();
      if (now - scan.at > 2000) { scan = { at: now, hits: {} }; }
      if (scan.hits[key] === undefined) scan.hits[key] = fn();
      return scan.hits[key];
    }

    // A quirk's `when` runs every few seconds for every quirk, so these
    // queries are memoised for the length of one decision.
    var scanCache = {};
    var scanAt = 0;

    function cached(key, fn) {
      var now = Date.now();
      if (now - scanAt > 1500) { scanCache = {}; scanAt = now; }
      if (!(key in scanCache)) scanCache[key] = fn();
      return scanCache[key];
    }

    function collect(selector, min, max) {
      var out = [];
      var all = document.querySelectorAll(selector);
      var step = Math.max(1, Math.floor(all.length / 80));
      for (var i = 0; i < all.length; i += step) {
        var r = visible(all[i]);
        if (!r) continue;
        if (min && (r.width < min || r.height < min)) continue;
        out.push(all[i]);
        if (out.length >= (max || 20)) break;
      }
      return out;
    }

    var page = {
      buttons: function () {
        return cached('buttons', function () {
          return collect('button, [role="button"], input[type="submit"], .btn', 0, 12);
        });
      },
      photos: function () {
        return cached('photos', function () { return collect('img, picture, figure', 80, 12); });
      },
      curiosities: function () {
        return cached('curiosities', function () {
          return collect('img, h1, h2, button, video, pre, a[href]', 0, 24);
        });
      },
      /** A long word, with where it sits, so the pet can go and point at it. */
      longWord: function () { return cached('word', function () {
        var blocks = collect('p, li, h1, h2, blockquote', 0, 24);
        for (var attempt = 0; attempt < 6; attempt++) {
          if (!blocks.length) return null;
          var block = pick(blocks);
          var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
          var nodes = [], n;
          while ((n = walker.nextNode())) {
            if (/\S{8,}/.test(n.nodeValue || '')) nodes.push(n);
          }
          if (!nodes.length) continue;
          var node = pick(nodes);
          var v = node.nodeValue;
          var words = [], re = /\S{8,}/g, m;
          while ((m = re.exec(v)) !== null) words.push([m.index, m.index + m[0].length]);
          if (!words.length) continue;
          var span = pick(words);
          var range = document.createRange();
          try {
            range.setStart(node, span[0]);
            range.setEnd(node, span[1]);
          } catch (_) { continue; }
          var rect = range.getBoundingClientRect();
          if (!rect.width || rect.top < 60 || rect.bottom > window.innerHeight - 40) continue;
          return { word: v.slice(span[0], span[1]).replace(/[^\w\u00C0-\u024F-]/g, ''), rect: rect };
        }
        return null;
        }); }
    };

    // ---- helpers quirks use -----------------------------------------------

    function visitRect(rect, onArrive) {
      if (!rect) return false;
      busy = true;
      o.pet.goGrab(rect, function () {
        if (onArrive) onArrive();
        setTimeout(function () {
          busy = false;
          o.pet.runOff();
        }, 2400);
      });
      return true;
    }

    function visit(el, onArrive) {
      var r = visible(el);
      return r ? visitRect(r, onArrive) : false;
    }

    function doInspect() {
      var opts = page.curiosities();
      if (!opts.length) return false;
      var el = pick(opts);
      var lines = L.LINES.inspect[el.tagName] || L.LINES.inspect.other;
      var ok = visit(el, function () {
        o.pet.setAnim('peer');
        o.pet.think(pick(lines), 3200);
        o.pet.puff('sparkle', 2);
      });
      if (ok) o.onInspect();
      return ok;
    }

    function doThought() {
      var band = ctxBand();
      var pool = (L.LINES.thought[band] || []).concat(L.LINES.thought.generic);
      o.pet.think(pick(pool), 3600);
      return true;
    }

    function ctxBand() {
      var v = o.view();
      return timeBand(v && typeof v.hour === 'number' ? v.hour : new Date().getHours());
    }

    function buildContext() {
      var v = o.view();
      if (!v) return null;
      return {
        pet: o.pet,
        view: v,
        needs: v.needs || { curiosity: 50, mischiefUrge: 40, confidence: 30 },
        band: ctxBand(),
        page: page,
        pick: pick,
        say: function (t, ms) { o.pet.say(t, ms); },
        think: function (t, ms) { o.pet.think(t, ms); },
        visit: visit,
        visitRect: visitRect,
        doMischief: o.doMischief,
        doChatter: o.doChatter,
        doBeg: o.doBeg,
        doCritter: o.doCritter,
        doInspect: doInspect,
        doThought: doThought,
        doJarPoke: o.doJarPoke,
        hasJar: o.hasJar,
        root: o.root && o.root(),
        sound: o.sound && o.sound()
      };
    }

    // ---- the loop ----------------------------------------------------------

    function decide() {
      var ctx = buildContext();
      if (!ctx || busy) return null;
      if (ctx.view.asleep || ctx.view.sulkMinutes > 0) return null;

      var now = Date.now();
      if (now - lastAction < (CFG.timing.decideCooldown || 3000)) return null;

      var quirks = global.RKRegistry.quirks;
      var options = [];
      for (var i = 0; i < quirks.length; i++) {
        var q = quirks[i];
        if (q.cooldown && now - (lastRun[q.id] || 0) < q.cooldown) continue;
        if (q.when) {
          var ok = false;
          try { ok = q.when(ctx); } catch (_) { ok = false; }
          if (!ok) continue;
        }
        var w = global.RKRegistry.weightOf('quirkWeights', q.id, q.weight, ctx);
        if (!(w > 0)) continue;
        options.push([q, w]);
      }
      if (!options.length) return null;

      var total = options.reduce(function (a, b) { return a + b[1]; }, 0);
      var roll = Math.random() * total;
      var chosen = options[options.length - 1][0];
      for (var j = 0; j < options.length; j++) {
        roll -= options[j][1];
        if (roll <= 0) { chosen = options[j][0]; break; }
      }

      lastAction = now;
      lastChoice = chosen.id;
      lastWeights = {
        chosen: chosen.id,
        total: Math.round(total),
        options: options.map(function (p) { return [p[0].id, Math.round(p[1])]; })
      };
      if (o.log) {
        o.log('brain chose', chosen.id, 'from',
          lastWeights.options.map(function (p) { return p[0] + ':' + p[1]; }).join(' '));
      }
      return chosen;
    }

    function act() {
      var q = decide();
      if (!q) return false;
      var ctx = buildContext();
      var done = false;
      try {
        done = q.run(ctx);
      } catch (e) {
        if (o.log) o.log('quirk "' + q.id + '" failed:', e);
        busy = false;
      }
      // Only start the cooldown if it actually happened.
      if (done) lastRun[q.id] = Date.now();
      else if (q.id !== 'wander') o.pet.wander();
      return true;
    }

    return {
      act: act,
      decide: function () { var q = decide(); return q ? q.id : null; },
      page: page,
      timeBand: ctxBand,
      busy: function () { return busy; },
      weights: function () { return lastWeights; },
      lastChoice: function () { return lastChoice; },
      /** For tuning from the console. */
      cooldowns: function () { return lastRun; },
      quirks: function () {
        return global.RKRegistry.quirks.map(function (q) { return q.id; });
      }
    };
  }

  global.RKBrain = { create: createBrain };
})(typeof globalThis !== 'undefined' ? globalThis : window);
