/* Rotate something a few degrees. The funniest small one. */
RKRegistry.trick({
  id: 'tilt',
  weight: 3,
  plan: function (kit) {
    return kit.styleTrick('tilt', function (el) {
      var deg = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 7);
      el.style.transform = (el.style.transform || '') + ' rotate(' + deg.toFixed(1) + 'deg)';
      el.style.transition = 'transform 420ms cubic-bezier(.34,1.56,.64,1)';
    }, 'mischief.tilt');
  }
});
