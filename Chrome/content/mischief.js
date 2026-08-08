/* Ruckus — mischief engine.
 *
 * Owns no tricks of its own. It builds the kit, asks the registry which tricks
 * are available, picks one by weight, and manages undoing everything. Tricks
 * live one-per-file in content/mischief/ ; weights live in core/config.js. */
(function (global) {
  'use strict';

  function createMischief(o) {
    var CFG = global.RKConfig || {};
    var T = CFG.timing || {};
    var L = global.RKLines;
    var MAX_HELD = 3;

    var held = [];
    var taken = new Set();
    var lastAct = 0;
    var busy = false;

    function makeLoot(kind) {
      var d = document.createElement('div');
      d.className = 'loot ' + kind;
      d.title = 'Click to take it back';
      d.addEventListener('click', function (e) {
        e.stopPropagation();
        returnOne(d.__entry);
      });
      o.root.appendChild(d);
      return d;
    }

    var kit = global.RKMischiefKit.make({
      pet: o.pet, root: o.root, sound: o.sound,
      held: held, taken: taken, makeLoot: makeLoot
    });
    kit.onDark = o.onDark;
    kit.onReturn = function (entry) { returnOne(entry); };

    // ---- carrying ---------------------------------------------------------

    function follow() {
      if (!held.length) return;
      var px = o.pet.x + o.pet.size * 0.5;
      var py = o.pet.y + o.pet.size * 0.35;
      for (var i = 0; i < held.length; i++) {
        var e = held[i];
        if (!e.loot || e.pinned) continue;
        var cur = e.pos || { x: parseFloat(e.loot.style.left) || px,
                             y: parseFloat(e.loot.style.top) || py };
        var ease = 0.16 - i * 0.03;
        var tx = px + (o.pet.facing < 0 ? 10 : -10) * (i + 1);
        var ty = py + i * 6;
        cur.x += (tx - cur.x) * ease;
        cur.y += (ty - cur.y) * ease;
        e.pos = cur;
        e.loot.style.transform = 'translate3d(' +
          Math.round(cur.x - (parseFloat(e.loot.style.left) || 0)) + 'px,' +
          Math.round(cur.y - (parseFloat(e.loot.style.top) || 0)) + 'px,0)';
        e.loot.classList.add('carried');
      }
    }

    function returnOne(entry) {
      if (!entry) return;
      var i = held.indexOf(entry);
      if (i >= 0) held.splice(i, 1);
      try { entry.restore(); } catch (_) {}
      if (!entry.loot) return;
      entry.loot.classList.add('going');
      setTimeout(function () { entry.loot.remove(); }, 260);
    }

    function returnAll() {
      var n = held.length;
      // Newest first: a later trick may sit inside what an earlier one changed.
      held.slice().reverse().forEach(returnOne);
      if (n && o.pet.say && L) o.pet.say(L.get('mischief.returned'), 2200);
      return n;
    }

    function tick() {
      var now = Date.now();
      var hold = T.holdLoot || 14000;
      held.slice().reverse().forEach(function (e) {
        if (now - e.at > hold) returnOne(e);
      });
    }

    // ---- choosing and running --------------------------------------------

    function eligible(onlyScenes) {
      var out = [];
      var tricks = global.RKRegistry.tricks;
      for (var i = 0; i < tricks.length; i++) {
        var t = tricks[i];
        if (onlyScenes && !t.scene) continue;
        var w = global.RKRegistry.weightOf('trickWeights', t.id, t.weight);
        if (!(w > 0)) continue;
        out.push([t, w]);
      }
      return out;
    }

    function choose(pool) {
      var total = pool.reduce(function (a, b) { return a + b[1]; }, 0);
      if (total <= 0) return null;
      var roll = Math.random() * total;
      for (var i = 0; i < pool.length; i++) {
        roll -= pool[i][1];
        if (roll <= 0) return pool[i][0];
      }
      return pool[pool.length - 1][0];
    }

    function perform(trick) {
      var plan = null;
      try { plan = trick.plan(kit); } catch (e) {
        if (o.log) o.log('trick "' + trick.id + '" failed to plan:', e);
      }
      if (!plan) return false;

      busy = true;
      lastAct = Date.now();
      if (o.pet.say && L) o.pet.say(L.get(plan.line || 'mischief.taken'), 2400);

      o.pet.goGrab(plan.rect, function () {
        var entry = null;
        try { entry = plan.take(); } catch (e) {
          if (o.log) o.log('trick "' + trick.id + '" failed:', e);
        }
        busy = false;
        if (!entry) { o.pet.runOff(); return; }
        if (o.pet.spark) o.pet.spark('\u2726', 2);
        if (!entry.pinned && entry.loot && o.pet.runOff) o.pet.runOff();
        if (o.onSteal) o.onSteal();
      });
      return true;
    }

    /** Let it choose. `force` skips the cooldown. */
    function act(force) {
      if (!o.enabled() || busy) return false;
      if (held.length >= MAX_HELD) { returnAll(); return false; }
      if (!force && Date.now() - lastAct < (T.mischiefCooldown || 20000)) return false;

      var pool = eligible(false);
      // Shuffle so a trick that cannot find a target does not block the rest.
      pool.sort(function () { return Math.random() - 0.5; });
      for (var i = 0; i < pool.length; i++) {
        var t = choose(pool) || pool[i][0];
        if (perform(t)) return true;
        pool = pool.filter(function (p) { return p[0] !== t; });
        if (!pool.length) break;
      }
      return false;
    }

    /** Force one of the big productions. */
    function scene() {
      if (!o.enabled() || busy) return false;
      var pool = eligible(true);
      pool.sort(function () { return Math.random() - 0.5; });
      for (var i = 0; i < pool.length; i++) {
        if (perform(pool[i][0])) return true;
      }
      return false;
    }

    /** Run one trick by name. */
    function run(id) {
      if (!o.enabled() || busy) return false;
      var t = global.RKRegistry.trickById(id);
      return t ? perform(t) : false;
    }

    return {
      act: act, scene: scene, run: run,
      follow: follow, tick: tick, returnAll: returnAll,
      holding: function () { return held.length; },
      busy: function () { return busy; },
      names: function () {
        return global.RKRegistry.tricks.map(function (t) { return t.id; });
      }
    };
  }

  global.RKMischief = { create: createMischief };
})(typeof globalThis !== 'undefined' ? globalThis : window);
