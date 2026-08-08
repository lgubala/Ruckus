/* Shuffle the middle letters of a word. First and last stay put, which is what
   keeps it readable and therefore funny rather than just broken. */
RKRegistry.trick({
  id: 'scramble',
  weight: 2,
  plan: function (kit) {
    var found = kit.findWord();
    if (!found || found.text.length < 5) return null;
    var node = found.range.startContainer;
    var start = found.range.startOffset;
    var end = found.range.endOffset;
    if (node.nodeType !== 3 || kit.taken.has(node)) return null;

    return {
      rect: found.rect,
      line: 'mischief.scramble',
      take: function () {
        if (kit.taken.has(node)) return null;
        var whole = node.nodeValue;
        var word = whole.slice(start, end);
        var mid = word.slice(1, -1).split('');
        for (var i = mid.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = mid[i]; mid[i] = mid[j]; mid[j] = t;
        }
        var scrambled = word[0] + mid.join('') + word[word.length - 1];
        if (scrambled === word) return null;
        kit.taken.add(node);
        node.nodeValue = whole.slice(0, start) + scrambled + whole.slice(end);
        var entry = {
          kind: 'scramble', loot: null, at: Date.now(),
          restore: function () { kit.taken.delete(node); node.nodeValue = whole; }
        };
        kit.held.push(entry);
        return entry;
      }
    };
  }
});
