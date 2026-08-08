/* A bug wanders across the page now and then, and the pet chases it.
   Self-contained: the creature, its flight, its CSS and the chase all here. */
(function () {
  'use strict';

  RKRegistry.style([
    '.critter {',
    '  position: fixed; left: 0; top: 0; width: 8px; height: 8px;',
    '  pointer-events: none; background: #4a3f6b;',
    '  box-shadow: -3px -3px 0 0 rgba(184,167,255,.85),',
    '               3px -3px 0 0 rgba(184,167,255,.85), 0 3px 0 0 #2a2338;',
    '  transition: opacity 200ms linear, transform 120ms linear;',
    '  animation: rk-flit 220ms steps(2) infinite;',
    '}',
    '.critter.gone { opacity: 0; }',
    '.critter.caught { opacity: 0; transform: scale(2.4); }',
    '@keyframes rk-flit {',
    '  0%,100% { box-shadow: -3px -3px 0 0 rgba(184,167,255,.85),',
    '            3px -3px 0 0 rgba(184,167,255,.85), 0 3px 0 0 #2a2338; }',
    '  50% { box-shadow: -4px -1px 0 0 rgba(184,167,255,.6),',
    '        4px -1px 0 0 rgba(184,167,255,.6), 0 3px 0 0 #2a2338; }',
    '}',
    '@media (prefers-reduced-motion: reduce) { .critter { animation: none; } }'
  ].join('\n'));

  var bug = null;
  var lastPounce = 0;

  function spawn(root) {
    if (bug) return bug;
    var el = document.createElement('div');
    el.className = 'critter';
    root.appendChild(el);
    var fromLeft = Math.random() < 0.5;
    bug = {
      el: el,
      x: fromLeft ? -20 : window.innerWidth + 20,
      y: window.innerHeight * (0.45 + Math.random() * 0.4),
      vx: fromLeft ? 60 : -60,
      born: Date.now(),
      caught: false
    };
    return bug;
  }

  function remove() {
    if (!bug) return;
    var b = bug;
    bug = null;
    b.el.classList.add('gone');
    setTimeout(function () { b.el.remove(); }, 260);
  }

  RKRegistry.ticker(function (now, api) {
    if (!bug || bug.caught) return;
    var dt = Math.min(0.05, api.dt || 0.016);

    // A lazy, drunken flight path.
    bug.vx = Math.max(-150, Math.min(150, bug.vx + (Math.random() - 0.5) * 40));
    bug.x += bug.vx * dt;
    bug.y += Math.sin(now / 420 + bug.born) * 40 * dt;
    bug.y = Math.max(60, Math.min(window.innerHeight - 40, bug.y));
    bug.el.style.transform = 'translate3d(' + Math.round(bug.x) + 'px,' +
      Math.round(bug.y) + 'px,0)';

    if (bug.x < -60 || bug.x > window.innerWidth + 60 ||
        now - bug.born > RKConfig.timing.critterLife) { remove(); return; }

    var pet = api.pet;
    if (!pet || !pet.visible || pet.sulking) return;
    if (now - lastPounce < 500) return;
    lastPounce = now;

    var target = bug;
    pet.pounceAt(bug.x, bug.y, function () {
      if (!bug || bug !== target) return;
      var close = Math.hypot(bug.x - (pet.x + pet.size / 2),
                             bug.y - (pet.y + pet.size / 2)) < pet.size;
      if (!close) return;
      bug.caught = true;
      bug.el.classList.add('caught');
      remove();
      pet.setAnim('happy');
      pet.puff('sparkle', 6);
      pet.say(RKLines.get('play.caught'), 2000);
      if (api.sound) api.sound.play('steal');
      if (api.reward) api.reward();
    });
  });

  RKRegistry.quirk({
    id: 'critter',
    weight: 14,
    cooldown: 90000,
    when: function (ctx) { return ctx.view.energy > 40 && !bug; },
    run: function (ctx) {
      if (!ctx.root) return false;
      spawn(ctx.root);
      ctx.say(RKLines.get('play.critter'), 2200);
      return true;
    }
  });

  RKRegistry.clearCritters = remove;
})();
