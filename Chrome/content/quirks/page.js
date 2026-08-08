/* Ruckus — curiosity about the page you are on. */
(function () {
  'use strict';
  var L = RKLines;

  RKRegistry.quirk({ id: 'ask_button', weight: 20, cooldown: 100000,
    when: function (ctx) { return ctx.page.buttons().length > 0; },
    run: function (ctx) {
      return ctx.visit(ctx.pick(ctx.page.buttons()), function () {
        ctx.pet.setAnim('peer');
        ctx.say(L.get('ask.button'), 4200);
        ctx.pet.puff('sparkle', 2);
      });
    } });

  RKRegistry.quirk({ id: 'ask_photo', weight: 18, cooldown: 110000,
    when: function (ctx) { return ctx.page.photos().length > 0; },
    run: function (ctx) {
      return ctx.visit(ctx.pick(ctx.page.photos()), function () {
        ctx.pet.setAnim('headtilt');
        ctx.say(L.get('ask.photo'), 4200);
      });
    } });

  RKRegistry.quirk({ id: 'ask_word', weight: 16, cooldown: 130000,
    when: function (ctx) { return !!ctx.page.longWord(); },
    run: function (ctx) {
      var found = ctx.page.longWord();
      if (!found) return false;
      return ctx.visitRect(found.rect, function () {
        ctx.pet.setAnim('peer');
        ctx.say(L.fill(L.get('ask.word'), { word: found.word }), 4600);
      });
    } });
})();
