/* Ruckus — playing, and pestering you about the treat jar. */
(function () {
  'use strict';
  var L = RKLines;

  RKRegistry.quirk({ id: 'play_ball', weight: 22, cooldown: 95000,
    when: function (ctx) { return ctx.view.energy > 35; },
    run: function (ctx) {
      ctx.pet.dressUp('ball', null, 9000);
      ctx.say(L.get('play.ball'), 2600);
      ctx.pet.bounce(3, function () { ctx.pet.undress(); });
      return true;
    } });

  RKRegistry.quirk({ id: 'juggle', weight: 14, cooldown: 140000,
    run: function (ctx) {
      ctx.pet.dressUp('ball', null, 6500);
      ctx.say(L.get('play.juggle'), 2600);
      ctx.pet.playOnce('juggle', 5200);
      setTimeout(function () { ctx.pet.undress(); }, 5400);
      return true;
    } });

  RKRegistry.quirk({ id: 'dance', weight: 12, cooldown: 120000,
    when: function (ctx) { return ctx.view.happiness > 55; },
    run: function (ctx) {
      ctx.say(L.get('play.dance'), 2600);
      ctx.pet.playOnce('dance', 4200);
      ctx.pet.puff('note', 3);
      return true;
    } });

  RKRegistry.quirk({ id: 'sit_on_scrollbar', weight: 10, cooldown: 160000,
    run: function (ctx) {
      ctx.pet.perchAt(window.innerWidth - ctx.pet.size - 22, window.innerHeight * 0.4);
      ctx.think(L.get('play.scrollbar'), 3600);
      return true;
    } });

  /* Goes to the jar and rattles it. Not tied to hunger — it just fancies one. */
  RKRegistry.quirk({ id: 'jar_poke', weight: 26, cooldown: 70000,
    when: function (ctx) { return ctx.hasJar(); },
    run: function (ctx) { return ctx.doJarPoke(); } });

  /* The hungrier it gets, the more insistent. */
  RKRegistry.quirk({ id: 'beg', cooldown: RKConfig.timing.begCooldown,
    weight: function (ctx) {
      if (ctx.view.treats <= 0) return 0;
      return ctx.view.hunger < 65 ? (70 - ctx.view.hunger) * 1.6 : 0;
    },
    run: function (ctx) { return ctx.doBeg(); } });
})();
