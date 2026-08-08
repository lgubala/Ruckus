/* Wheelbarrow — carts something off to a pile in the corner. Owns the pile. */
(function () {
  'use strict';

  RKRegistry.style([
    '.pile {',
    '  position: fixed; width: 78px; pointer-events: none; display: none;',
    '  border: 2px solid var(--rk-ink); border-bottom: none;',
    '  background: repeating-linear-gradient(135deg,',
    '    rgba(255,159,69,.35) 0 4px, rgba(184,167,255,.3) 4px 8px);',
    '}',
    '.pile.on { display: block; }',
    '.loot.piled { transition: transform 620ms cubic-bezier(.4,1.3,.6,1); }',
    '@media (prefers-reduced-motion: reduce) { .loot.piled { transition: none; } }'
  ].join('\n'));

  var pileEl = null;
  var piled = 0;

  function corner() { return { x: 46, y: window.innerHeight - 60 }; }

  function tipOnto(kit, lootEl) {
    if (!pileEl) pileEl = kit.el('pile');
    pileEl.classList.add('on');
    var p = corner();
    var jitter = (piled % 5) * 9 - 18;
    piled++;
    lootEl.classList.add('piled');
    lootEl.style.transform = 'translate3d(' +
      Math.round(p.x + jitter - (parseFloat(lootEl.style.left) || 0)) + 'px,' +
      Math.round(p.y - piled * 4 - (parseFloat(lootEl.style.top) || 0)) + 'px,0)';
    pileEl.style.left = (p.x - 34) + 'px';
    pileEl.style.top = (p.y - 18) + 'px';
    pileEl.style.height = Math.min(90, 22 + piled * 5) + 'px';
  }

  function clearPile() {
    piled = 0;
    if (pileEl) pileEl.classList.remove('on');
  }

  RKRegistry.trick({
    id: 'wheelbarrow',
    weight: 0.6,
    scene: true,
    plan: function (kit) {
      var inner = RKRegistry.trickById('pinch_image').plan(kit) ||
                  RKRegistry.trickById('pinch_word').plan(kit);
      if (!inner) return null;
      return {
        rect: inner.rect,
        line: 'mischief.wheelbarrow',
        take: function () {
          var entry = inner.take();
          if (!entry || !entry.loot) return entry;
          entry.pinned = true;             // it goes on the pile, not in tow
          var lootEl = entry.loot;
          kit.pet.dressUp('wheelbarrow', null, 20000);
          var p = corner();
          kit.pet.haulTo(p.x, p.y, function () {
            tipOnto(kit, lootEl);
            kit.pet.undress();
            kit.pet.puff('dust', 4, 0, 20);
            kit.say('mischief.dumped');
          });
          var undo = entry.restore;
          entry.restore = function () {
            kit.pet.undress();
            clearPile();
            undo();
          };
          return entry;
        }
      };
    }
  });
})();
