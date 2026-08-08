/* Ruckus — everyday behaviour.
   Weights live in core/config.js under quirkWeights; the numbers here are the
   fallback used when config.js says null. */
(function () {
  'use strict';
  var L = RKLines;

  RKRegistry.quirk({ id: 'wander', weight: 40,
    run: function (ctx) { return ctx.pet.wander(); } });

  RKRegistry.quirk({ id: 'micro', weight: 46, cooldown: RKConfig.timing.microGap,
    run: function (ctx) {
      var kind = ctx.pick(['stretch', 'scratch', 'yawn', 'peer', 'spin', 'look']);
      if (kind === 'spin') return ctx.pet.spin();
      if (kind === 'look') return ctx.pet.glance();
      return ctx.pet.playOnce(kind, kind === 'yawn' ? 1800 : 1300);
    } });

  RKRegistry.quirk({ id: 'mischief', cooldown: 4000,
    weight: function (ctx) {
      var shy = ctx.needs.confidence < 25;
      return (shy ? 6 : 18) + ctx.needs.mischiefUrge * (shy ? 0.25 : 0.9);
    },
    when: function (ctx) { return (ctx.view.settings || {}).mischief !== false; },
    run: function (ctx) { return ctx.doMischief(); } });

  RKRegistry.quirk({ id: 'inspect', cooldown: 8000,
    weight: function (ctx) { return 14 + ctx.needs.curiosity * 0.6; },
    run: function (ctx) { return ctx.doInspect(); } });

  RKRegistry.quirk({ id: 'chatter', weight: 26, cooldown: RKConfig.timing.chatterGap,
    run: function (ctx) { return ctx.doChatter(); } });

  RKRegistry.quirk({ id: 'thought', weight: 30, cooldown: RKConfig.timing.thoughtGap,
    run: function (ctx) { return ctx.doThought(); } });

  /** Something genuinely useful, now and then. */
  RKRegistry.quirk({ id: 'tip', weight: 22, cooldown: RKConfig.timing.tipGap,
    run: function (ctx) {
      ctx.say(L.get('tips'), 6500);
      ctx.pet.puff('sparkle', 2);
      return true;
    } });

  RKRegistry.quirk({ id: 'zoomies', cooldown: 60000,
    weight: function (ctx) {
      return ctx.view.happiness > 60 && ctx.view.energy > 55 &&
             ctx.band === 'afternoon' ? 22 : 8;
    },
    run: function (ctx) { ctx.pet.zoomies(); return true; } });

  RKRegistry.quirk({ id: 'sneeze', weight: 7, cooldown: 70000,
    run: function (ctx) { return ctx.pet.sneeze(); } });
})();
