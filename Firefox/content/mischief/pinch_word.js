/* Lift a word out of a paragraph and carry it around. The original is only
   hidden, never removed, so the layout never reflows. */
RKRegistry.trick({
  id: 'pinch_word',
  weight: 2,
  plan: function (kit) {
    var found = kit.findWord();
    if (!found) return null;
    return {
      rect: found.rect,
      line: 'mischief.taken',
      take: function () {
        var host = found.range.startContainer;
        if (kit.taken.has(host)) return null;
        var holder = document.createElement('span');
        holder.setAttribute('data-rk-loot', '');
        holder.style.visibility = 'hidden';
        try { found.range.surroundContents(holder); } catch (_) { return null; }
        kit.taken.add(host);

        var cs = getComputedStyle(holder.parentElement || document.body);
        var loot = kit.loot('word');
        loot.textContent = found.text;
        loot.style.font = cs.font || (cs.fontSize + ' ' + cs.fontFamily);
        loot.style.fontWeight = cs.fontWeight;
        loot.style.color = cs.color;
        loot.style.left = found.rect.left + 'px';
        loot.style.top = found.rect.top + 'px';

        var entry = {
          kind: 'word', loot: loot, at: Date.now(),
          restore: function () {
            kit.taken.delete(host);
            var parent = holder.parentNode;
            if (!parent) return;
            while (holder.firstChild) parent.insertBefore(holder.firstChild, holder);
            parent.removeChild(holder);
            parent.normalize();
          }
        };
        loot.__entry = entry;
        kit.held.push(entry);
        return entry;
      }
    };
  }
});
