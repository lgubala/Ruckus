/* Ruckus — document tools registry.
 *
 * Every operation is a plugin in tools/ops/. To add one, drop a file in
 * there, list it in tools.html, and call RKDocTools.op({...}).
 *
 *   id       unique slug
 *   title    what the button says
 *   group    which section of the sidebar it lands in
 *   blurb    one line explaining what it does
 *   accept   input filter, e.g. '.pdf' or 'image/*'
 *   multiple whether it takes more than one file
 *   options  [{ id, label, type: 'text'|'number'|'check'|'select', ... }]
 *   run      async ({ files, options, log }) => [{ name, blob }]
 *
 * Everything runs in this page. Nothing is uploaded anywhere. */
(function (global) {
  'use strict';

  var ops = [];

  function op(def) {
    if (!def || !def.id || typeof def.run !== 'function') return;
    def.group = def.group || 'Other';
    def.options = def.options || [];
    ops.push(def);
    return def;
  }

  /** Group order in the sidebar. Unknown groups sort last, alphabetically. */
  var GROUP_ORDER = ['Create PDF', 'Edit PDF', 'Convert from PDF', 'Documents'];

  function grouped() {
    var by = {};
    ops.forEach(function (o) { (by[o.group] = by[o.group] || []).push(o); });
    return Object.keys(by)
      .sort(function (a, b) {
        var ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map(function (name) { return { name: name, ops: by[name] }; });
  }

  // ---- shared helpers ------------------------------------------------------

  var util = {
    async bytes(file) { return new Uint8Array(await file.arrayBuffer()); },

    /** "1-3, 7, 9-" over a document of `total` pages -> zero-based indices. */
    parseRange(spec, total) {
      var out = [];
      String(spec || '').split(',').forEach(function (chunk) {
        chunk = chunk.trim();
        if (!chunk) return;
        var m = /^(\d*)\s*-\s*(\d*)$/.exec(chunk);
        if (m) {
          var from = m[1] ? parseInt(m[1], 10) : 1;
          var to = m[2] ? parseInt(m[2], 10) : total;
          for (var i = from; i <= to; i++) if (i >= 1 && i <= total) out.push(i - 1);
        } else if (/^\d+$/.test(chunk)) {
          var n = parseInt(chunk, 10);
          if (n >= 1 && n <= total) out.push(n - 1);
        }
      });
      return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
    },

    stem(name) { return String(name).replace(/\.[^.]+$/, ''); },

    /** Word-wrap for the very plain text-into-PDF path. */
    wrap(text, font, size, width) {
      var lines = [];
      String(text).split(/\r?\n/).forEach(function (para) {
        if (!para.trim()) { lines.push(''); return; }
        var words = para.split(/\s+/);
        var line = '';
        words.forEach(function (w) {
          var probe = line ? line + ' ' + w : w;
          var wide;
          try { wide = font.widthOfTextAtSize(probe, size) > width; }
          catch (_) { wide = probe.length * size * 0.5 > width; }
          if (wide && line) { lines.push(line); line = w; }
          else line = probe;
        });
        if (line) lines.push(line);
      });
      return lines;
    },

    /** Strip characters WinAnsi cannot encode, so pdf-lib does not throw. */
    safeText(s) {
      return String(s).replace(/[\u0100-\uFFFF]/g, function (ch) {
        var map = { '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
                    '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u00A0': ' ' };
        if (map[ch]) return map[ch];
        try {
          return ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '?';
        } catch (_) { return '?'; }
      }).replace(/[^\x00-\xFF]/g, '?');
    }
  };

  global.RKDocTools = {
    op: op,
    ops: ops,
    grouped: grouped,
    util: util,
    byId: function (id) {
      for (var i = 0; i < ops.length; i++) if (ops[i].id === id) return ops[i];
      return null;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
