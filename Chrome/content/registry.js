/* Ruckus — plugin registry.
 *
 * Behaviour plugins call RKRegistry.quirk({...}) and RKRegistry.trick({...})
 * at load time. Adding one means dropping a file in and listing it in the
 * manifest; removing one means deleting the file. Nothing else changes. */
(function (global) {
  'use strict';

  var CFG = global.RKConfig || { quirkWeights: {}, trickWeights: {} };

  var registry = {
    quirks: [],
    tricks: [],
    styles: [],
    tickers: [],

    /** A plugin's own CSS. Collected and injected into the overlay at boot,
     *  so a plugin file can carry everything it needs. */
    style: function (css) { registry.styles.push(css); },

    /** A plugin that needs a per-frame update. Called with (now, api). */
    ticker: function (fn) { registry.tickers.push(fn); },

    runTickers: function (now, api) {
      for (var i = 0; i < registry.tickers.length; i++) {
        try { registry.tickers[i](now, api); } catch (_) {}
      }
    },

    css: function () { return registry.styles.join('\n'); },

    /** A self-directed behaviour. See content/quirks/ for examples. */
    quirk: function (def) {
      if (!def || !def.id) return;
      registry.quirks.push(def);
      return def;
    },

    /** A mischief trick. See content/mischief/ for examples. */
    trick: function (def) {
      if (!def || !def.id) return;
      registry.tricks.push(def);
      return def;
    },

    /** config.js wins over whatever the plugin declared. */
    weightOf: function (table, id, fallback, ctx) {
      var override = CFG[table] ? CFG[table][id] : undefined;
      if (override !== undefined && override !== null) return override;
      return typeof fallback === 'function' ? fallback(ctx) : (fallback || 0);
    },

    quirkById: function (id) {
      for (var i = 0; i < registry.quirks.length; i++) {
        if (registry.quirks[i].id === id) return registry.quirks[i];
      }
      return null;
    },

    trickById: function (id) {
      for (var i = 0; i < registry.tricks.length; i++) {
        if (registry.tricks[i].id === id) return registry.tricks[i];
      }
      return null;
    },

    summary: function () {
      return {
        quirks: registry.quirks.map(function (q) { return q.id; }),
        tricks: registry.tricks.map(function (t) { return t.id; }),
        styles: registry.styles.length,
        tickers: registry.tickers.length
      };
    }
  };

  global.RKRegistry = registry;
})(typeof globalThis !== 'undefined' ? globalThis : window);
