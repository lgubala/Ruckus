/* Ruckus — particles. A single canvas over the viewport; everything is
   drawn as pixel blocks so it matches the sprite rather than floating emoji. */
(function (global) {
  'use strict';

  // 1 = filled. Rows are top to bottom.
  var SHAPES = {
    heart: ['.11.11.', '1111111', '1111111', '.11111.', '..111..', '...1...'],
    sparkle: ['..1..', '.111.', '11111', '.111.', '..1..'],
    zzz: ['1111', '..11', '.11.', '11..', '1111'],
    dust: ['.11.', '1111', '1111', '.11.'],
    sweat: ['..1..', '.111.', '11111', '11111', '.111.'],
    note: ['..11', '..11', '..11', '111.', '111.'],
    anger: ['1...1', '.1.1.', '..1..', '.1.1.', '1...1'],
    crumb: ['11', '11']
  };

  // Every particle gets the same dark outline the sprite has. Without it a
  // 2px mint block is invisible on a white page, which is exactly how the
  // first version failed.
  var OUTLINE = '#20182f';

  var STYLE = {
    heart:   { color: '#ff6f9e', px: 4, life: 1500, vy: -38, spread: 30, gravity: 6 },
    sparkle: { color: '#ffd033', px: 4, life: 1200, vy: -24, spread: 52, gravity: 14 },
    zzz:     { color: '#a693ff', px: 4, life: 2600, vy: -18, spread: 12, gravity: -3 },
    dust:    { color: '#c9c2d8', px: 3, life: 720,  vy: -10, spread: 62, gravity: 36 },
    sweat:   { color: '#57c8f0', px: 3, life: 950,  vy: -14, spread: 34, gravity: 72 },
    note:    { color: '#48e2a0', px: 4, life: 1700, vy: -28, spread: 38, gravity: 4 },
    anger:   { color: '#ff5252', px: 4, life: 800,  vy: -34, spread: 76, gravity: 42 },
    crumb:   { color: '#d98b3a', px: 3, life: 780,  vy: -26, spread: 66, gravity: 92 }
  };

  function createParticles(o) {
    var canvas = document.createElement('canvas');
    canvas.className = 'particles';
    var ctx = canvas.getContext('2d');
    o.root.appendChild(canvas);

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var live = [];
    var last = 0;
    var reduced = false;

    function resize() {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    resize();
    window.addEventListener('resize', resize);

    function emit(type, x, y, n) {
      var st = STYLE[type];
      if (!st || live.length > 160) return;
      n = n || 1;
      for (var i = 0; i < n; i++) {
        live.push({
          type: type,
          x: x + (Math.random() - 0.5) * 14,
          y: y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * st.spread,
          vy: st.vy * (0.7 + Math.random() * 0.6),
          born: performance.now(),
          life: st.life * (0.8 + Math.random() * 0.4),
          wobble: Math.random() * Math.PI * 2
        });
      }
    }

    function tick(now) {
      if (!last) last = now;
      var dt = Math.min(48, now - last) / 1000;
      last = now;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!live.length) return;

      for (var i = live.length - 1; i >= 0; i--) {
        var p = live[i];
        var age = now - p.born;
        if (age > p.life) { live.splice(i, 1); continue; }
        var st = STYLE[p.type];

        p.vy += st.gravity * dt;
        p.x += (p.vx + Math.sin(p.wobble + age / 190) * 12) * dt;
        p.y += p.vy * dt;

        var t = age / p.life;
        ctx.globalAlpha = t < 0.15 ? t / 0.15 : (1 - t) * 1.15;
        draw(p.type, p.x, p.y, st);
      }
      ctx.globalAlpha = 1;
    }

    function draw(type, x, y, st) {
      var rows = SHAPES[type];
      var px = st.px;
      var ox = Math.round(x);
      var oy = Math.round(y);
      var r, c, row;

      // Pass one: a dark halo so the shape reads on any background.
      ctx.fillStyle = OUTLINE;
      for (r = 0; r < rows.length; r++) {
        row = rows[r];
        for (c = 0; c < row.length; c++) {
          if (row[c] !== '1') continue;
          ctx.fillRect(ox + c * px - 2, oy + r * px - 2, px + 4, px + 4);
        }
      }
      // Pass two: the colour on top.
      ctx.fillStyle = st.color;
      for (r = 0; r < rows.length; r++) {
        row = rows[r];
        for (c = 0; c < row.length; c++) {
          if (row[c] !== '1') continue;
          ctx.fillRect(ox + c * px, oy + r * px, px, px);
        }
      }
    }

    var emitted = 0;
    var drawn = 0;

    return {
      emit: function (t, x, y, n) {
        emitted += (n || 1);
        if (o.log) o.log('emit', t, 'x' + (n || 1), 'at', Math.round(x) + ',' + Math.round(y),
          reduced ? '(SUPPRESSED: particles off)' : '');
        emit(t, x, y, n);
      },
      tick: function (now) { drawn++; tick(now); },
      status: function () {
        return 'canvas ' + canvas.width + 'x' + canvas.height +
          ' attached=' + canvas.isConnected +
          ' emitted=' + emitted + ' frames=' + drawn +
          ' live=' + live.length + ' off=' + reduced;
      },
      setEnabled: function (v) { reduced = !v; if (!v) live.length = 0; },
      clear: function () { live.length = 0; },
      destroy: function () {
        window.removeEventListener('resize', resize);
        canvas.remove();
      }
    };
  }

  global.RKParticles = { create: createParticles };
})(typeof globalThis !== 'undefined' ? globalThis : window);
