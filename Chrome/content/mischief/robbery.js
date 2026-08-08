/* Mask on, item in the bag, straight off the edge of the screen. */
RKRegistry.trick({
  id: 'robbery',
  weight: 0.5,
  scene: true,
  plan: function (kit) {
    var inner = RKRegistry.trickById('pinch_image').plan(kit) ||
                RKRegistry.trickById('pinch_word').plan(kit);
    if (!inner) return null;
    return {
      rect: inner.rect,
      line: 'mischief.robbery',
      take: function () {
        var entry = inner.take();
        if (!entry) return null;
        entry.pinned = true;
        if (entry.loot) entry.loot.classList.add('bagged');
        kit.pet.dressUp('swagbag', 'mask', 22000);
        kit.say('mischief.robberyGo');

        kit.pet.escape(function () {
          // Lies low off-screen, then sheepishly brings it back.
          setTimeout(function () {
            kit.pet.undress();
            if (entry.loot) entry.loot.classList.remove('bagged');
            kit.onReturn(entry);
            kit.pet.show();
            kit.say('mischief.remorse');
          }, 9000);
        });

        var undo = entry.restore;
        entry.restore = function () {
          kit.pet.undress();
          if (entry.loot) entry.loot.classList.remove('bagged');
          undo();
        };
        return entry;
      }
    };
  }
});
