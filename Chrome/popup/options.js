/* Ruckus — settings page.
 *
 * Android has no toolbar popup, so Settings > Add-ons > Ruckus > Settings is
 * the only route to the full interface. Rather than maintain two copies, this
 * loads the popup's markup and script into a full-width page. */
(function () {
  'use strict';
  var api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  fetch(api.runtime.getURL('popup/popup.html'))
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var device = doc.querySelector('.device');
      var mount = document.getElementById('mount');
      while (device.firstChild) mount.appendChild(document.adoptNode(device.firstChild));

      // The popup script expects its own DOM; it is now here.
      var s = document.createElement('script');
      s.src = api.runtime.getURL('popup/popup.js');
      document.body.appendChild(s);
    })
    .catch(function (e) {
      document.getElementById('mount').textContent = 'Could not load settings: ' + e;
    });
})();
