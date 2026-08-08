/* Mirror a picture horizontally. */
RKRegistry.trick({
  id: 'flip',
  weight: 1.5,
  plan: function (kit) {
    return kit.styleTrick('flip', function (el) {
      el.style.transform = (el.style.transform || '') + ' scaleX(-1)';
      el.style.transition = 'transform 380ms ease-in-out';
    }, 'mischief.flip');
  }
});
