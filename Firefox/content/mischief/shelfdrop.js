/* Shelf drop — nudges the letters off a heading, one at a time. Owns its own
   letter clones and their CSS; the heading is only hidden, never rewritten. */
(function () {
  'use strict';

  RKRegistry.style([
    '.letter {',
    '  position: fixed; pointer-events: none; white-space: pre;',
    '  will-change: transform; transition: opacity 240ms linear;',
    '}',
    '.letter.gone { opacity: 0; }',
    '@media (prefers-reduced-motion: reduce) { .letter { transition: none; } }'
  ].join('\n'));

  /** Measure each character, clone it into the overlay, hide the original. */
  function shake(kit, el, onDrop) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var best = null, n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.trim().length >
          (best ? best.nodeValue.trim().length : 0)) best = n;
    }
    if (!best) return null;

    var text = best.nodeValue;
    var cs = getComputedStyle(el);
    var range = document.createRange();
    var letters = [];
    for (var i = 0; i < text.length && letters.length < 60; i++) {
      if (!text[i].trim()) continue;
      try {
        range.setStart(best, i);
        range.setEnd(best, i + 1);
      } catch (_) { continue; }
      var r = range.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) continue;
      letters.push({ ch: text[i], x: r.left, y: r.top, h: r.height });
    }
    if (letters.length < 2) return null;

    var prev = el.getAttribute('style');
    el.style.visibility = 'hidden';

    var made = letters.map(function (L, i) {
      var d = kit.el('letter');
      d.textContent = L.ch;
      d.style.left = Math.round(L.x) + 'px';
      d.style.top = Math.round(L.y) + 'px';
      d.style.font = cs.font || (cs.fontSize + ' ' + cs.fontFamily);
      d.style.fontWeight = cs.fontWeight;
      d.style.color = cs.color;
      d.style.lineHeight = cs.lineHeight;
      setTimeout(function () {
        if (!d.isConnected) return;
        d.style.transition = 'transform 1100ms cubic-bezier(.5,0,.9,.6)';
        d.style.transform = 'translate(' + ((Math.random() - 0.5) * 90).toFixed(0) +
          'px,' + (window.innerHeight - L.y - L.h - 6).toFixed(0) + 'px) rotate(' +
          ((Math.random() - 0.5) * 90).toFixed(0) + 'deg)';
        if (onDrop) onDrop();
      }, 260 + i * 180);
      return d;
    });

    return function restore() {
      made.forEach(function (d) {
        d.classList.add('gone');
        setTimeout(function () { d.remove(); }, 260);
      });
      if (prev === null) el.removeAttribute('style');
      else el.setAttribute('style', prev);
    };
  }

  RKRegistry.trick({
    id: 'shelfdrop',
    weight: 0.6,
    scene: true,
    plan: function (kit) {
      var heads = kit.headings();
      if (!heads.length) return null;
      var head = kit.pick(heads);
      return {
        rect: head.getBoundingClientRect(),
        line: 'mischief.shelfdrop',
        take: function () {
          if (kit.taken.has(head)) return null;
          var restore = shake(kit, head, function () {
            kit.pet.puff('dust', 1, 0, 6);
            if (kit.sound) kit.sound.play('tick');
          });
          if (!restore) return null;
          kit.taken.add(head);
          kit.pet.setAnim('mark');
          var entry = {
            kind: 'letters', loot: null, at: Date.now(),
            restore: function () { kit.taken.delete(head); restore(); }
          };
          kit.held.push(entry);
          setTimeout(function () { kit.pet.runOff(); }, 1400);
          return entry;
        }
      };
    }
  });
})();
