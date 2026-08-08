/* Ruckus — what are you actually doing?
 *
 * Deliberately shallow: it watches for focus, keystroke rhythm and whether a
 * video is playing. It never reads what you type — only that you are typing. */
(function (global) {
  'use strict';

  var T = (global.RKConfig && global.RKConfig.timing) || {};
  var TYPING_GRACE = 7000;
  var READING_AFTER = T.readingStillness || 12000;

  function createActivity(o) {
    var kind = 'idle';
    var lastKey = 0;
    var lastScroll = Date.now();
    var lastInput = Date.now();
    var typingField = null;
    var video = null;
    var timer = null;
    var override = null;

    function isField(el) {
      if (!el) return false;
      if (el.closest && el.closest('[data-ruckus]')) return false;
      var t = el.tagName;
      return t === 'INPUT' || t === 'TEXTAREA' || el.isContentEditable;
    }

    function playingVideo() {
      var vids = document.querySelectorAll('video');
      for (var i = 0; i < vids.length; i++) {
        var v = vids[i];
        if (v.paused || v.ended || v.readyState < 2) continue;
        var r = v.getBoundingClientRect();
        if (r.width < 160 || r.height < 90) continue;
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        return v;
      }
      return null;
    }

    // innerText forces a full layout and text serialisation, which is far too
    // expensive to run on a 2.5s timer. The answer barely changes, so cache it.
    var longReadCache = null;
    var longReadAt = 0;

    function longRead() {
      var now = Date.now();
      if (longReadCache !== null && now - longReadAt < 30000) return longReadCache;
      longReadAt = now;
      try {
        longReadCache = (document.body.innerText || '').length > 2500;
      } catch (_) { longReadCache = false; }
      return longReadCache;
    }

    function securedField() {
      var a = document.activeElement;
      return a && a.tagName === 'INPUT' && a.type === 'password' ? a : null;
    }

    function playingAudio() {
      var list = document.querySelectorAll('audio');
      for (var i = 0; i < list.length; i++) {
        if (!list[i].paused && !list[i].ended) return list[i];
      }
      return null;
    }

    function hasSelection() {
      try {
        var t = String(window.getSelection() || '').trim();
        return t.length > 3 ? t : null;
      } catch (_) { return null; }
    }

    /** Highest priority first. Privacy beats everything. */
    function evaluate() {
      var now = Date.now();
      var next = 'idle';
      var anchor = null;

      var secure = securedField();
      // Note: not named `kind` — that is the module's current state, and
      // shadowing it here silently threw every transition away.
      var v, category;

      if (secure) {
        next = 'secure';
        anchor = secure;
      } else if (override) {
        next = override;
      } else if (typingField && now - lastKey < TYPING_GRACE) {
        next = 'typing';
        anchor = typingField;
      } else if (hasSelection()) {
        next = 'selecting';
      } else if ((v = playingVideo())) {
        next = 'watching';
        anchor = v;
        video = v;
      } else if (playingAudio()) {
        next = 'music';
      } else if ((category = o.pageKind && o.pageKind()) === 'shop') {
        next = 'shopping';
      } else if (category === 'code') {
        next = 'code';
      } else if (longRead() && now - lastInput > READING_AFTER &&
                 now - lastInput < 5 * 60000) {
        // Settling down to read takes stillness. Any scroll, click or mouse
        // movement breaks it immediately — the old version only checked
        // scrolling, so it stayed in reading mode while you were clearly busy.
        next = 'reading';
      }

      if (next !== kind) {
        var was = kind;
        kind = next;
        o.onChange(kind, anchor, was);
      } else if (anchor) {
        o.onAnchor && o.onAnchor(kind, anchor);
      }
    }

    document.addEventListener('focusin', function (e) {
      if (isField(e.target)) { typingField = e.target; lastKey = Date.now(); evaluate(); }
    }, true);
    document.addEventListener('focusout', function () {
      // Leaving the field ends the typing state straight away. The grace period
      // is for pauses mid-sentence, not for after you have clicked away.
      setTimeout(function () {
        if (isField(document.activeElement)) return;
        typingField = null;
        evaluate();
      }, 50);
    }, true);
    document.addEventListener('keydown', function (e) {
      if (!isField(e.target)) return;
      typingField = e.target;
      lastKey = Date.now();
      if (kind !== 'typing') evaluate();
    }, true);
    /** Any sign of life resets the stillness clock. */
    function stirred() {
      lastInput = Date.now();
      lastScroll = lastInput;
      if (kind === 'reading') evaluate();     // stop reading straight away
    }

    var stirThrottle = 0;
    function stirredThrottled() {
      var now = Date.now();
      if (now - stirThrottle < 300) { lastInput = now; return; }
      stirThrottle = now;
      stirred();
    }

    window.addEventListener('scroll', stirredThrottled, { passive: true });
    window.addEventListener('pointermove', stirredThrottled, { passive: true });
    window.addEventListener('pointerdown', stirred, { passive: true });
    window.addEventListener('wheel', stirredThrottled, { passive: true });
    window.addEventListener('keydown', stirredThrottled, true);
    document.addEventListener('play', function () { evaluate(); }, true);
    document.addEventListener('pause', function () { evaluate(); }, true);

    timer = setInterval(evaluate, 2500);

    document.addEventListener('selectionchange', function () {
      if (kind === 'selecting' || hasSelection()) evaluate();
    });

    return {
      kind: function () { return kind; },
      /** Used for states we are told about, like the finder being open. */
      setOverride: function (v) { override = v; evaluate(); },
      anchor: function () {
        if (kind === 'typing') return typingField;
        if (kind === 'watching') return video;
        return null;
      },
      stop: function () { clearInterval(timer); }
    };
  }

  global.RKActivity = { create: createActivity };
})(typeof globalThis !== 'undefined' ? globalThis : window);
