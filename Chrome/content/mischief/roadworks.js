/* Roadworks — drills holes in the page. Self-contained: the hole visuals, their
   CSS and their cleanup all live here. Nothing is done to the page itself. */
(function () {
  'use strict';

  RKRegistry.style([
    '.hole {',
    '  position: fixed; pointer-events: none; border-radius: 50%;',
    '  background: radial-gradient(ellipse at 50% 35%, #0b0714 60%, #241a33 100%);',
    '  border: 2px solid #0b0714;',
    '  box-shadow: 0 2px 0 rgba(255,255,255,.18), inset 0 -4px 6px rgba(0,0,0,.6);',
    '  transform: scale(0.2); opacity: 0;',
    '  transition: transform 260ms cubic-bezier(.3,1.6,.5,1), opacity 200ms linear;',
    '}',
    '.hole.open { transform: scale(1); opacity: 1; }',
    '@media (prefers-reduced-motion: reduce) { .hole { transition: none; } }'
  ].join('\n'));

  function dig(kit, x, y) {
    var size = 22 + Math.random() * 26;
    var el = kit.el('hole');
    el.style.width = Math.round(size) + 'px';
    el.style.height = Math.round(size * 0.7) + 'px';
    el.style.left = Math.round(x - size / 2) + 'px';
    el.style.top = Math.round(y - size * 0.35) + 'px';
    requestAnimationFrame(function () { el.classList.add('open'); });
    return function fill() {
      el.classList.remove('open');
      setTimeout(function () { el.remove(); }, 320);
    };
  }

  RKRegistry.trick({
    id: 'roadworks',
    weight: 0.6,
    scene: true,
    plan: function (kit) {
      var spots = kit.targets();
      if (!spots.length) return null;
      var r = kit.pick(spots).getBoundingClientRect();
      return {
        rect: r,
        line: 'mischief.roadworks',
        take: function () {
          var fills = [];
          kit.pet.dressUp('jackhammer', null, 12000);
          kit.pet.setAnim('drill');
          var n = 3 + Math.floor(Math.random() * 3), made = 0;
          var timer = setInterval(function () {
            if (made >= n) {
              clearInterval(timer);
              kit.pet.undress();
              kit.pet.runOff();
              return;
            }
            made++;
            fills.push(dig(kit,
              r.left + Math.random() * r.width,
              r.top + r.height * (0.4 + Math.random() * 0.5)));
            kit.pet.puff('dust', 4, 0, 18);
            if (kit.sound) kit.sound.play('tick');
          }, 520);

          var entry = {
            kind: 'holes', loot: null, at: Date.now(),
            restore: function () {
              clearInterval(timer);
              fills.forEach(function (f) { f(); });
              kit.pet.undress();
            }
          };
          kit.held.push(entry);
          return entry;
        }
      };
    }
  });
})();
