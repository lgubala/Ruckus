/* Nudge something down and slightly askew, as if it slipped. */
RKRegistry.trick({
  id: 'topple',
  weight: 1,
  plan: function (kit) {
    return kit.styleTrick('topple', function (el) {
      el.style.transform = (el.style.transform || '') +
        ' translateY(' + (8 + Math.random() * 14).toFixed(0) + 'px) rotate(' +
        ((Math.random() < 0.5 ? -1 : 1) * 2).toFixed(1) + 'deg)';
      el.style.transition = 'transform 500ms cubic-bezier(.5,1.8,.6,1)';
    }, 'mischief.topple');
  }
});
