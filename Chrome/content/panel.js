/* Ruckus — the in-page character card.
 *
 * On Android the toolbar popup is buried three taps deep in Settings, which is
 * no good for a glance at how Ruckus is doing. This is the same information,
 * opened from the right-click menu or the pet's own menu, drawn in the page. */
(function (global) {
  'use strict';

  var S = global.RKSprites;
  var L = global.RKLines;

  function createPanel(o) {
    var el = document.createElement('div');
    el.className = 'card';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Ruckus');
    o.root.appendChild(el);

    var open = false;
    var frame = 0;
    var timer = null;
    var canvas = null;
    var ctx = null;

    function node(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }

    function bar(label, value, tone) {
      var row = node('div', 'card-stat');
      row.appendChild(node('span', 'card-stat-label', label));
      var track = node('div', 'card-stat-track');
      var fill = node('div', 'card-stat-fill ' + tone);
      fill.style.width = Math.max(0, Math.min(100, value)) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(node('span', 'card-stat-num', Math.round(value)));
      return row;
    }

    function button(label, sub, onClick, disabled, kind) {
      var b = node('button', 'card-key' + (kind ? ' ' + kind : ''));
      b.type = 'button';
      b.appendChild(node('span', 'card-key-top', label));
      if (sub) b.appendChild(node('span', 'card-key-sub', sub));
      if (disabled) b.disabled = true;
      else b.addEventListener('click', onClick);
      return b;
    }

    function draw(view) {
      if (!canvas) return;
      S.drawFrame(ctx, 0, view.asleep ? 'sleep' : 'idle', frame,
        { scale: 5, color: view.settings.color, species: view.settings.species });
    }

    function render() {
      var view = o.view();
      if (!view) return;
      el.textContent = '';

      // --- header: sprite, name, level ---
      var head = node('div', 'card-head');
      var art = node('div', 'card-art');
      canvas = document.createElement('canvas');
      canvas.width = S.CANVAS * 5;
      canvas.height = S.CANVAS * 5;
      ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      art.appendChild(canvas);
      head.appendChild(art);

      var who = node('div', 'card-who');
      who.appendChild(node('h2', 'card-name', 'RUCKUS'));
      who.appendChild(node('p', 'card-mood', o.moodLine(view)));

      var lvl = node('div', 'card-level');
      lvl.appendChild(node('span', 'card-level-num', 'Lv ' + view.level));
      var xpTrack = node('div', 'card-xp');
      var xpFill = node('div', 'card-xp-fill');
      xpFill.style.width =
        Math.min(100, (view.xpInLevel / Math.max(1, view.xpForNext)) * 100) + '%';
      xpTrack.appendChild(xpFill);
      lvl.appendChild(xpTrack);
      who.appendChild(lvl);
      head.appendChild(who);

      var x = node('button', 'card-x', '\u00d7');
      x.type = 'button';
      x.title = 'Close';
      x.addEventListener('click', hide);
      head.appendChild(x);
      el.appendChild(head);

      // --- stats ---
      var stats = node('div', 'card-stats');
      stats.appendChild(bar('Fed', view.hunger, view.hunger < 30 ? 'low' : ''));
      stats.appendChild(bar('Mood', view.happiness, view.happiness < 30 ? 'low' : ''));
      stats.appendChild(bar('Rest', view.energy, view.energy < 30 ? 'low' : ''));
      el.appendChild(stats);

      // --- actions ---
      var keys = node('div', 'card-keys');
      keys.appendChild(button('Feed', view.treats + ' treats',
        function () { o.act('feed'); }, view.treats <= 0, 'go'));
      keys.appendChild(button('Pat', '+mood', function () { o.act('pat'); }));
      keys.appendChild(view.asleep
        ? button('Wake', 'rouse', function () { o.act('wake'); })
        : button('Nap', 'rest', function () { o.act('nap'); }));
      el.appendChild(keys);

      // --- shortcuts ---
      var links = node('div', 'card-links');
      [['Burrow', o.openBurrow],
       ['Find', o.openFinder],
       ['Tools', o.openTools],
       [view.settings.enabled === false ? 'Turn on' : 'Off here', o.offHere]
      ].forEach(function (pair) {
        var b = node('button', 'card-link', pair[0]);
        b.type = 'button';
        b.addEventListener('click', pair[1]);
        links.appendChild(b);
      });
      el.appendChild(links);

      draw(view);
    }

    function show() {
      open = true;
      render();
      el.classList.add('open');
      if (!timer) {
        timer = setInterval(function () {
          frame++;
          var v = o.view();
          if (v) draw(v);
        }, 240);
      }
    }

    function hide() {
      open = false;
      el.classList.remove('open');
      if (timer) { clearInterval(timer); timer = null; }
    }

    document.addEventListener('pointerdown', function (e) {
      if (!open) return;
      if (e.composedPath && e.composedPath().indexOf(el) !== -1) return;
      hide();
    }, true);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) hide();
    });

    return {
      show: show,
      hide: hide,
      toggle: function () { open ? hide() : show(); },
      isOpen: function () { return open; },
      refresh: function () { if (open) render(); }
    };
  }

  global.RKPanel = { create: createPanel };
})(typeof globalThis !== 'undefined' ? globalThis : window);
