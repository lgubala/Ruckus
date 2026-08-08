/* Ruckus — sound. Small square-wave blips generated on the fly, so there are
   no audio files to ship. The context is created lazily on the first gesture,
   because browsers refuse to start audio before the user interacts. */
(function (global) {
  'use strict';

  // [frequency, seconds] steps.
  var TUNES = {
    pat:      [[660, 0.06], [880, 0.08]],
    feed:     [[520, 0.05], [660, 0.05], [784, 0.09]],
    levelUp:  [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.16]],
    steal:    [[880, 0.05], [740, 0.05], [988, 0.09]],
    shoo:     [[400, 0.07], [280, 0.12]],
    nudge:    [[784, 0.1], [988, 0.14]],
    done:     [[988, 0.1], [784, 0.1], [1175, 0.22]],
    tick:     [[440, 0.04]]
  };

  // Drop your own files in /sounds and they are used instead of the blips.
  var CUES = ['pat', 'feed', 'levelUp', 'steal', 'shoo', 'nudge', 'done', 'tick'];
  var EXTS = ['ogg', 'mp3', 'wav'];

  function createSound(o) {
    var ctx = null;
    var enabled = true;
    var volume = 0.25;
    var pack = {};          // cue -> HTMLAudioElement that actually loaded
    var packChecked = false;

    /** Look for /sounds/<cue>.<ext>. Anything missing falls back to a blip. */
    /** Optional. A failure here must never take the rest of the pet down. */
    function loadPack() {
      if (packChecked || !o.url) return;
      packChecked = true;
      try {
        CUES.forEach(function (cue) { tryNext(cue, 0); });
      } catch (e) {
        if (o.log) o.log('sound pack unavailable:', e);
      }
    }

    function tryNext(cue, i) {
      if (i >= EXTS.length) return;
      if (typeof Audio !== 'function') return;   // no HTMLAudioElement here
      var audio;
      try {
        audio = new Audio(o.url('sounds/' + cue + '.' + EXTS[i]));
      } catch (_) { return; }
      audio.preload = 'auto';
      audio.addEventListener('canplaythrough', function () {
        pack[cue] = audio;
        if (o.log) o.log('sound pack: using sounds/' + cue + '.' + EXTS[i]);
      }, { once: true });
      audio.addEventListener('error', function () {
        tryNext(cue, i + 1);
      }, { once: true });
    }

    function wake() {
      if (ctx) return ctx;
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (_) { ctx = null; }
      return ctx;
    }

    // Any interaction is enough to unlock audio.
    ['pointerdown', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, function once() {
        wake();
        window.removeEventListener(ev, once);
      }, { once: true, capture: true, passive: true });
    });

    function play(name) {
      if (!enabled) return;
      loadPack();

      // A file from the pack wins over the synthesised version.
      var file = pack[name];
      if (file) {
        try {
          var shot = file.cloneNode();       // so overlapping cues both play
          shot.volume = volume;
          var p = shot.play();
          if (p && p.catch) p.catch(function () {});
          return;
        } catch (_) { /* fall through to the blip */ }
      }

      var tune = TUNES[name];
      if (!tune) return;
      var c = wake();
      if (!c) return;
      if (c.state === 'suspended') c.resume().catch(function () {});

      var t = c.currentTime;
      tune.forEach(function (step) {
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(step[0], t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + step[1]);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + step[1] + 0.02);
        t += step[1];
      });
    }

    return {
      play: play,
      cues: function () { return CUES.slice(); },
      packStatus: function () {
        return CUES.map(function (c) { return c + (pack[c] ? '=file' : '=blip'); })
          .join(' ');
      },
      loadPack: loadPack,
      setEnabled: function (v) { enabled = !!v; },
      isEnabled: function () { return enabled; },
      setVolume: function (v) { volume = Math.max(0, Math.min(1, v)); },
      ready: function () { return !!ctx; }
    };
  }

  global.RKSound = { create: createSound };
})(typeof globalThis !== 'undefined' ? globalThis : window);
