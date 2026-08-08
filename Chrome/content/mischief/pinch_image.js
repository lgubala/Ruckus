/* Take a picture, leaving a faded ghost behind. */
RKRegistry.trick({
  id: 'pinch_image',
  weight: 2,
  plan: function (kit) {
    var img = kit.findImage();
    if (!img) return null;
    var r = img.getBoundingClientRect();
    return {
      rect: r,
      line: 'mischief.taken',
      take: function () {
        if (kit.taken.has(img)) return null;
        kit.taken.add(img);
        var prev = img.getAttribute('style');
        var loot = kit.loot('pic');
        var clone = document.createElement('img');
        clone.src = img.currentSrc || img.src;
        clone.alt = '';
        loot.appendChild(clone);
        loot.style.left = r.left + 'px';
        loot.style.top = r.top + 'px';
        img.style.opacity = '0.2';
        img.style.filter = 'grayscale(1)';

        var entry = {
          kind: 'pic', loot: loot, at: Date.now(),
          restore: function () {
            kit.taken.delete(img);
            // An empty cssText leaves a bare style="" behind, which is not how
            // we found it.
            if (prev === null) img.removeAttribute('style');
            else img.setAttribute('style', prev);
          }
        };
        loot.__entry = entry;
        kit.held.push(entry);
        return entry;
      }
    };
  }
});
