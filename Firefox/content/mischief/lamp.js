/* The lamp — flicks the lights on and off. Owns the darkness it makes, and
   tells the overlay to flip its bubble palette so text stays readable. */
(function () {
  'use strict';

  RKRegistry.style([
    '.lamp-veil {',
    '  position: fixed; inset: 0; pointer-events: none;',
    '  background: #0a0714; opacity: 0;',
    '  transition: opacity 180ms steps(3);',
    '}',
    '.lamp-veil.on { opacity: 0.78; }',
    '@media (prefers-reduced-motion: reduce) { .lamp-veil { transition: none; } }'
  ].join('\n'));

  var veil = null;
  var lightsOff = false;

  function flick(kit) {
    if (!veil) veil = kit.el('lamp-veil');
    lightsOff = !lightsOff;
    veil.classList.toggle('on', lightsOff);
    if (kit.onDark) kit.onDark(lightsOff);
    return lightsOff;
  }

  function lightsOn(kit) {
    if (!lightsOff) return;
    lightsOff = false;
    if (veil) veil.classList.remove('on');
    if (kit.onDark) kit.onDark(false);
  }

  RKRegistry.trick({
    id: 'lamp',
    weight: 0.6,
    scene: true,
    plan: function (kit) {
      var spots = kit.targets();
      var r = spots.length ? kit.pick(spots).getBoundingClientRect()
        : { left: window.innerWidth * 0.6, top: window.innerHeight * 0.4,
            width: 40, height: 40 };
      return {
        rect: r,
        line: 'mischief.lamp',
        take: function () {
          kit.pet.dressUp('lamp', null, 15000);
          var flicks = 0;
          var timer = setInterval(function () {
            flicks++;
            flick(kit);
            if (kit.sound) kit.sound.play('tick');
            kit.pet.puff('sparkle', 2);
            if (flicks >= 5) {
              clearInterval(timer);
              setTimeout(function () { kit.pet.undress(); kit.pet.runOff(); }, 600);
            }
          }, 620);

          var entry = {
            kind: 'lamp', loot: null, at: Date.now(),
            restore: function () {
              clearInterval(timer);
              lightsOn(kit);
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
