/* Ruckus — sprite data + renderer.
   One 16x16 base creature. Evolution stages reveal extra pixel layers
   (ears, tail, wings, crown) rather than swapping in whole new art. */
(function (global) {
  'use strict';

  var SIZE = 16;
  // Animations push the sprite a couple of pixels around, so the canvas gets a
  // margin. Callers size their canvas CANVAS*scale, not SIZE*scale.
  var PAD = 2;
  var CANVAS = SIZE + PAD * 2;

  // --- grids ------------------------------------------------------------
  // . transparent   o outline   b body   l belly   e eye   s shine   n blush
  // E ears (stage>=2)  T tail (stage>=2)  W wings (stage>=3)  C crown (stage>=3)

  var CREATURE = [
    '................',
    '...EE.C..C.EE...',
    '...EECCCCCCEE...',
    '....oooooooo....',
    '.W.obbbbbbbbo.W.',
    'WWobbbbbbbbbboWW',
    '.WobbsebbsebboW.',
    '..obbeebbeebbo..',
    '..obnbbbbbbnbo..',
    '..obbbbbbbbbbo.T',
    '..obbllllllbboTT',
    '..obllllllllboT.',
    '..obllllllllbo..',
    '...obllllllbo...',
    '....oooooooo....',
    '................'
  ];


  // --- palettes ---------------------------------------------------------

  // The base palette. Colour variants override the body and belly.
  var PALETTES = [null, null, {
    o: '#3a2233', b: '#f2a05c', l: '#ffe1bd', n: '#ff8098',
    e: '#3a2233', s: '#ffffff', E: '#e08a45', T: '#e08a45',
    W: '#ffe9a8', C: '#ffcf47'
  }];

  // Which optional layers each stage shows.
  // Things it can wear. Drawn over the finished sprite, so they work with any
  // colour or stage. [x, y, colour].
  var WEAR = {
    // Thin half-moon reading spectacles. The first version was a solid bar
    // across the whole face, which read as sunglasses rather than readers.
    glasses: (function () {
      var w = '#8f8aa6', g = '#ffd97a', px = [];
      // lens rims, open at the top so the eyes stay visible
      [[4,7],[4,8],[5,9],[6,9],[7,8],[7,7]].forEach(function (p) { px.push([p[0], p[1], g]); });
      [[11,7],[11,8],[10,9],[9,9],[8,8],[8,7]].forEach(function (p) { px.push([p[0], p[1], g]); });
      // bridge and arms
      px.push([7, 6, g]); px.push([8, 6, g]);
      px.push([3, 6, w]); px.push([12, 6, w]);
      return px;
    })(),
    headphones: (function () {
      var f = '#2a2338', c = '#6ff2b8', px = [];
      [4,5,6,7,8,9,10,11].forEach(function (x) { px.push([x, 2, f]); });
      [[3,3],[12,3]].forEach(function (p) { px.push([p[0], p[1], f]); });
      [[2,4],[3,4],[2,5],[3,5],[2,6],[3,6]].forEach(function (p) { px.push([p[0], p[1], c]); });
      [[12,4],[13,4],[12,5],[13,5],[12,6],[13,6]].forEach(function (p) { px.push([p[0], p[1], c]); });
      [[2,7],[3,7],[12,7],[13,7]].forEach(function (p) { px.push([p[0], p[1], f]); });
      return px;
    })(),
    nightcap: (function () {
      var b = '#8f9ff5', t = '#c8d2ff', f = '#2a2338', px = [];
      [[10,0],[11,0],[9,1],[10,1],[11,1]].forEach(function (p) { px.push([p[0], p[1], b]); });
      [[12,0],[12,1]].forEach(function (p) { px.push([p[0], p[1], t]); });
      [6,7,8,9,10].forEach(function (x) { px.push([x, 2, b]); });
      [4,5,6,7,8,9,10,11].forEach(function (x) { px.push([x, 3, t]); });
      [4,11].forEach(function (x) { px.push([x, 2, f]); });
      return px;
    })(),
    monocle: (function () {
      var f = '#ffcf47', px = [];
      [[8,5],[9,5],[10,5],[11,5],[8,6],[11,6],[8,7],[11,7],[9,8],[10,8]]
        .forEach(function (p) { px.push([p[0], p[1], f]); });
      [[12,8],[12,9],[12,10]].forEach(function (p) { px.push([p[0], p[1], f]); });
      return px;
    })(),
    hardhat: (function () {
      var y = '#ffcf47', d = '#e0a92c', f = '#2a2338', px = [];
      [6,7,8,9].forEach(function (x) { px.push([x, 1, y]); });
      [5,6,7,8,9,10].forEach(function (x) { px.push([x, 2, y]); });
      [4,5,6,7,8,9,10,11].forEach(function (x) { px.push([x, 3, d]); });
      [3,12].forEach(function (x) { px.push([x, 3, f]); });
      return px;
    })(),
    mask: (function () {
      var f = '#1d1830', px = [];
      for (var x = 3; x <= 12; x++) { px.push([x, 5, f]); }
      [[3,6],[4,6],[7,6],[8,6],[11,6],[12,6],
       [3,7],[4,7],[7,7],[8,7],[11,7],[12,7]].forEach(function (p) {
        px.push([p[0], p[1], f]);
      });
      [[5,6],[6,6],[9,6],[10,6]].forEach(function (p) { px.push([p[0], p[1], '#ffffff']); });
      [[5,7],[6,7],[9,7],[10,7]].forEach(function (p) { px.push([p[0], p[1], '#1d1830']); });
      return px;
    })(),
    blindfold: (function () {
      var f = '#3a3350', h = '#5a5175', px = [];
      for (var x = 3; x <= 12; x++) { px.push([x, 6, f]); px.push([x, 7, h]); }
      [[2,6],[13,6],[2,7],[13,7]].forEach(function (p) { px.push([p[0], p[1], f]); });
      return px;
    })(),
    cinema: (function () {
      var f = '#2a2338', px = [];
      [4,5,6,7,8,9,10,11].forEach(function (x) { px.push([x, 5, f]); });
      [[4,6],[7,6],[8,6],[11,6],[4,7],[7,7],[8,7],[11,7]].forEach(function (c) {
        px.push([c[0], c[1], f]);
      });
      [[5,6],[6,6],[5,7],[6,7]].forEach(function (c) { px.push([c[0], c[1], '#ff5252']); });
      [[9,6],[10,6],[9,7],[10,7]].forEach(function (c) { px.push([c[0], c[1], '#3fd0e0']); });
      [[5,8],[6,8],[9,8],[10,8]].forEach(function (c) { px.push([c[0], c[1], f]); });
      return px;
    })()
  };

  // Colour variants the user can pick once the egg hatches.
  var COLORS = [
    { id: 'mint',   name: 'Mint',   b: '#6fd3c2', l: '#c6f5ec', d: '#4bb0a0' },
    { id: 'amber',  name: 'Amber',  b: '#f2a05c', l: '#ffe1bd', d: '#e08a45' },
    { id: 'violet', name: 'Violet', b: '#a394f7', l: '#e6e0ff', d: '#8d7cf0' },
    { id: 'rose',   name: 'Rose',   b: '#f58ba8', l: '#ffdbe5', d: '#e0708f' },
    { id: 'sky',    name: 'Sky',    b: '#7cc0f5', l: '#d4ecff', d: '#5aa3de' },
    { id: 'moss',   name: 'Moss',   b: '#9dc45e', l: '#e4f3c2', d: '#82a848' },
    { id: 'ash',    name: 'Ash',    b: '#a8adc0', l: '#e2e5ee', d: '#8b90a3' },
    { id: 'coal',   name: 'Coal',   b: '#5b5570', l: '#8d86a5', d: '#443f57' }
  ];

  /* --- species -------------------------------------------------------------
     There is one pet. This table is the seam for adding another later: give it
     a grid, the layers it shows, and a default colour, then reference its id in
     settings.species. Nothing else needs to know. */
  var SPECIES = {
    ruckus: {
      id: 'ruckus',
      name: 'Ruckus',
      grid: null,                                  // null = the built-in body
      layers: { E: true, T: true, W: false, C: false },
      defaultColor: 'amber'
    }
  };

  function speciesOf(id) { return SPECIES[id] || SPECIES.ruckus; }

  function paletteFor(colorId) {
    var base = PALETTES[2];
    if (!colorId) colorId = 'amber';
    var c = null;
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === colorId) c = COLORS[i];
    if (!c) return base;
    return Object.assign({}, base, {
      b: c.b, l: c.l, E: c.d, T: c.d
    });
  }

  function layersFor(speciesId) { return speciesOf(speciesId).layers; }

  // --- eye + extra pixel overrides -------------------------------------
  // Left eye occupies cols 5-6, right eye cols 9-10, rows 6-7.

  var EYES = {
    open:    [[5,6,'s'],[6,6,'e'],[5,7,'e'],[6,7,'e'],[9,6,'s'],[10,6,'e'],[9,7,'e'],[10,7,'e']],
    closed:  [[5,6,'b'],[6,6,'b'],[5,7,'e'],[6,7,'e'],[9,6,'b'],[10,6,'b'],[9,7,'e'],[10,7,'e']],
    happy:   [[5,6,'b'],[6,6,'e'],[5,7,'e'],[6,7,'b'],[9,6,'e'],[10,6,'b'],[9,7,'b'],[10,7,'e']],
    wide:    [[5,6,'e'],[6,6,'e'],[5,7,'e'],[6,7,'e'],[9,6,'e'],[10,6,'e'],[9,7,'e'],[10,7,'e']],
    focused: [[5,6,'b'],[6,6,'e'],[5,7,'b'],[6,7,'e'],[9,6,'e'],[10,6,'b'],[9,7,'e'],[10,7,'b']]
  };

  var FEET = {
    a: [[5,15,'o'],[6,15,'o'],[9,15,'o'],[10,15,'o']],
    b: [[4,15,'o'],[5,15,'o'],[9,15,'o'],[10,15,'o']],
    c: [[5,15,'o'],[6,15,'o'],[10,15,'o'],[11,15,'o']]
  };

  var MOUTH_OPEN = [[7,8,'o'],[8,8,'o']];
  var SNIFF_NOSE = [[13,8,'n'],[14,8,'n']];

  function frame(opts) {
    return {
      dy: opts.dy || 0,
      dx: opts.dx || 0,
      px: (opts.eyes ? EYES[opts.eyes] : EYES.open)
        .concat(opts.feet ? FEET[opts.feet] : [])
        .concat(opts.extra || [])
    };
  }

  // --- animations -------------------------------------------------------
  // Each animation: { fps, loop, frames: [...] }

  var ANIM = {
    idle: { fps: 3, loop: true, frames: [
      frame({}), frame({ dy: -1 }), frame({}), frame({ eyes: 'closed' })
    ]},
    walk: { fps: 8, loop: true, frames: [
      frame({ feet: 'a' }), frame({ dy: -1, feet: 'b' }),
      frame({ feet: 'a' }), frame({ dy: -1, feet: 'c' })
    ]},
    sniff: { fps: 7, loop: true, frames: [
      frame({ eyes: 'focused', dx: 1, extra: SNIFF_NOSE }),
      frame({ eyes: 'focused', dx: 1, dy: -1, extra: SNIFF_NOSE }),
      frame({ eyes: 'focused', dx: 2, extra: SNIFF_NOSE.concat(MOUTH_OPEN) })
    ]},
    happy: { fps: 6, loop: true, frames: [
      frame({ eyes: 'happy', dy: -2, extra: MOUTH_OPEN }),
      frame({ eyes: 'happy', dy: 0, extra: MOUTH_OPEN })
    ]},
    startled: { fps: 10, loop: true, frames: [
      frame({ eyes: 'wide', dy: -2, extra: MOUTH_OPEN }),
      frame({ eyes: 'wide', dy: -1, dx: -1, extra: MOUTH_OPEN })
    ]},
    sleep: { fps: 1.2, loop: true, frames: [
      frame({ eyes: 'closed' }), frame({ eyes: 'closed', dy: 1 })
    ]},
    // Micro-animations. Idle should never be truly idle.
    stretch: { fps: 3, loop: true, frames: [
      frame({ eyes: 'closed', dy: 1 }), frame({ eyes: 'closed', dy: 2, dx: 1 }),
      frame({ eyes: 'closed', dy: 1, dx: 2 }), frame({ eyes: 'happy', dy: -1 })
    ]},
    scratch: { fps: 9, loop: true, frames: [
      frame({ eyes: 'closed', dx: -1 }), frame({ eyes: 'closed', dx: 1 }),
      frame({ eyes: 'closed', dx: -1, dy: -1 }), frame({ eyes: 'happy', dx: 1 })
    ]},
    yawn: { fps: 2, loop: true, frames: [
      frame({ eyes: 'closed', extra: MOUTH_OPEN }),
      frame({ eyes: 'closed', dy: -1, extra: MOUTH_OPEN }),
      frame({ eyes: 'happy', dy: 1 })
    ]},
    peer: { fps: 4, loop: true, frames: [
      frame({ eyes: 'focused', dx: 1, extra: SNIFF_NOSE }),
      frame({ eyes: 'focused', dx: 2, dy: -1, extra: SNIFF_NOSE }),
      frame({ eyes: 'wide', dx: 1 })
    ]},
    shrug: { fps: 4, loop: true, frames: [
      frame({ eyes: 'happy', dx: -1, dy: -1 }),
      frame({ eyes: 'happy', dx: 1, dy: -1 }),
      frame({ eyes: 'happy', dy: 0 })
    ]},
    dance: { fps: 7, loop: true, frames: [
      frame({ eyes: 'happy', dx: -2, dy: -1, extra: MOUTH_OPEN }),
      frame({ eyes: 'happy', dx: 0, dy: 0 }),
      frame({ eyes: 'happy', dx: 2, dy: -1, extra: MOUTH_OPEN }),
      frame({ eyes: 'happy', dx: 0, dy: 0 })
    ]},
    headtilt: { fps: 3, loop: true, frames: [
      frame({ eyes: 'wide', dx: 1 }),
      frame({ eyes: 'wide', dx: 2, dy: 1 })
    ]},
    dizzy: { fps: 8, loop: true, frames: [
      frame({ eyes: 'wide', dx: -2, dy: -1 }),
      frame({ eyes: 'closed', dx: 0, dy: -2 }),
      frame({ eyes: 'wide', dx: 2, dy: -1 }),
      frame({ eyes: 'closed', dx: 0, dy: 0 })
    ]},
    wave: { fps: 5, loop: true, frames: [
      frame({ eyes: 'happy', dx: 1, dy: -2 }),
      frame({ eyes: 'happy', dx: 2, dy: -1 }),
      frame({ eyes: 'happy', dx: 1, dy: -2 })
    ]},
    mark: { fps: 4, loop: true, frames: [
      frame({ eyes: 'focused', dx: 1, dy: 1 }),
      frame({ eyes: 'focused', dx: 2, dy: 1 }),
      frame({ eyes: 'focused', dx: 1, dy: 2 })
    ]},
    drill: { fps: 14, loop: true, frames: [
      frame({ eyes: 'wide', dy: -1 }), frame({ eyes: 'wide', dy: 1 }),
      frame({ eyes: 'wide', dy: -1, dx: 1 }), frame({ eyes: 'wide', dy: 1, dx: -1 })
    ]},
    push: { fps: 6, loop: true, frames: [
      frame({ eyes: 'focused', dx: 1, dy: 1, feet: 'a' }),
      frame({ eyes: 'focused', dx: 2, dy: 0, feet: 'b' }),
      frame({ eyes: 'focused', dx: 1, dy: 1, feet: 'a' }),
      frame({ eyes: 'focused', dx: 2, dy: 0, feet: 'c' })
    ]},
    stumble: { fps: 9, loop: true, frames: [
      frame({ eyes: 'wide', dy: 2, dx: 2 }),
      frame({ eyes: 'closed', dy: 2, dx: -1 }),
      frame({ eyes: 'wide', dy: 1, dx: 1 }),
      frame({ eyes: 'happy', dy: 0 })
    ]},
    sneeze: { fps: 6, loop: true, frames: [
      frame({ eyes: 'closed', dy: -2 }),
      frame({ eyes: 'closed', dy: -2, extra: MOUTH_OPEN }),
      frame({ eyes: 'wide', dy: 1, dx: -2, extra: MOUTH_OPEN }),
      frame({ eyes: 'happy', dy: 0 })
    ]},
    pounce: { fps: 10, loop: true, frames: [
      frame({ eyes: 'focused', dy: 1, dx: -1 }),
      frame({ eyes: 'wide', dy: -2, dx: 2 }),
      frame({ eyes: 'wide', dy: -1, dx: 2 })
    ]},
    juggle: { fps: 8, loop: true, frames: [
      frame({ eyes: 'focused', dy: -1, dx: -1 }),
      frame({ eyes: 'wide', dy: 0, dx: 1 }),
      frame({ eyes: 'focused', dy: -1, dx: 1 }),
      frame({ eyes: 'wide', dy: 0, dx: -1 })
    ]},
    sulk: { fps: 1.5, loop: true, frames: [
      frame({ eyes: 'closed', dy: 1 }), frame({ eyes: 'closed', dy: 0 })
    ]},
    eat: { fps: 6, loop: true, frames: [
      frame({ eyes: 'closed', extra: MOUTH_OPEN }),
      frame({ eyes: 'happy', dy: -1 })
    ]}
  };

  // --- rendering --------------------------------------------------------



  function buildGrid(speciesId, frameDef) {
    var spec = speciesOf(speciesId);
    var grid = (spec.grid || CREATURE).map(function (row) { return row.split(''); });
    var show = spec.layers;
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var c = grid[y][x];
        if ((c === 'E' || c === 'T' || c === 'W' || c === 'C') && !show[c]) {
          grid[y][x] = '.';
        }
      }
    }
    if (frameDef) {
      for (var i = 0; i < frameDef.px.length; i++) {
        var p = frameDef.px[i];
        if (p[1] < SIZE && p[0] < SIZE) grid[p[1]][p[0]] = p[2];
      }
    }
    return grid;
  }

  /** Draw one frame. opts: { scale, color, species, wear } */
  function drawFrame(ctx, _unusedStage, animName, frameIndex, opts) {
    // The second argument used to be an evolution stage. It is kept so older
    // call sites still work, but the species decides the body now.
    opts = opts || {};
    var anim = ANIM[animName] || ANIM.idle;
    var f = anim.frames[frameIndex % anim.frames.length];
    var pal = paletteFor(opts.color);
    var grid = buildGrid(opts.species, f);
    var scale = opts.scale || 1;

    var ox = f.dx || 0;
    var oy = f.dy || 0;
    ctx.clearRect(0, 0, CANVAS * scale, CANVAS * scale);
    for (var y2 = 0; y2 < SIZE; y2++) {
      for (var x2 = 0; x2 < SIZE; x2++) {
        var ch = grid[y2][x2];
        if (ch === '.' || !pal[ch]) continue;
        ctx.fillStyle = pal[ch];
        ctx.fillRect((x2 + ox + PAD) * scale, (y2 + oy + PAD) * scale, scale, scale);
      }
    }

    // Anything it is wearing rides on top, following the frame's bob.
    var worn = WEAR[opts.wear];
    if (worn && !isClosedEyed(animName)) {
      for (var w = 0; w < worn.length; w++) {
        ctx.fillStyle = worn[w][2];
        ctx.fillRect((worn[w][0] + ox + PAD) * scale,
                     (worn[w][1] + oy + PAD) * scale, scale, scale);
      }
    }
  }

  // Glasses look wrong on a sleeping face; take them off for those.
  function isClosedEyed(animName) {
    return animName === 'sleep' || animName === 'sulk';
  }

  function frameCount(animName) {
    return (ANIM[animName] || ANIM.idle).frames.length;
  }

  function fps(animName) {
    return (ANIM[animName] || ANIM.idle).fps;
  }

  global.RKSprites = {
    SIZE: SIZE,
    COLORS: COLORS,
    SPECIES: SPECIES,
    WEAR: WEAR,
    CANVAS: CANVAS,
    PAD: PAD,
    PALETTES: PALETTES,
    ANIM: ANIM,
    drawFrame: drawFrame,
    frameCount: frameCount,
    fps: fps
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
