/* Ruckus — props. Small pixel objects the pet holds, drawn on their own
   canvas inside the pet element so they travel with it. */
(function (global) {
  'use strict';

  var W = 12, H = 12;

  // . transparent, then one letter per colour in the prop's palette.
  var PROPS = {
    notebook: {
      pal: { o: '#2a2338', p: '#f6f1e4', l: '#9fb7d4', y: '#ffcf47', g: '#c76a3a' },
      grid: [
        '............',
        '.....oooooo.',
        '....opppppo.',
        '...oplllllo.',
        '..oppppppo..',
        '..oplllllo..',
        '..oppppppo..',
        '..oplllllo..',
        '..oooooooo..',
        '.......y....',
        '......yg....',
        '.....g......'
      ]
    },
    popcorn: {
      pal: { o: '#2a2338', r: '#e2453f', w: '#fff6e8', k: '#ffe08a' },
      grid: [
        '............',
        '...k..k.k...',
        '..kkk.kkk...',
        '...k.kk.k.k.',
        '..okkkkkko..',
        '..owrwrwro..',
        '..owrwrwro..',
        '..owrwrwro..',
        '...owrwro...',
        '...owrwro...',
        '...oooooo...',
        '............'
      ]
    },
    mug: {
      pal: { o: '#2a2338', c: '#8fd6c8', b: '#6a4a3a', s: '#cfd8e6' },
      grid: [
        '....s..s....',
        '...s..s.....',
        '....s..s....',
        '............',
        '..oooooo....',
        '..obbbbo.oo.',
        '..occcco.oo.',
        '..occcco.oo.',
        '..occcco.oo.',
        '..occccooo..',
        '..oooooo....',
        '............'
      ]
    },
    marker: {
      pal: { o: '#2a2338', y: '#ffe066', t: '#ff9f45', c: '#f6f1e4' },
      grid: [
        '............',
        '.......oo...',
        '......otto..',
        '.....ottto..',
        '....oyyyo...',
        '...oyyyo....',
        '..oyyyo.....',
        '..oyyo......',
        '..ooo.......',
        '.ccccccc....',
        '.ccccccc....',
        '............'
      ]
    },
    backpack: {
      pal: { o: '#2a2338', b: '#6a8fd4', d: '#4d6ba8', y: '#ffcf47' },
      grid: [
        '............',
        '...oooooo...',
        '..obbbbbbo..',
        '..obbbbbbo..',
        '..odddddo...',
        '..obyyyybo..',
        '..obbbbbbo..',
        '..obbbbbbo..',
        '..obdddbbo..',
        '..obbbbbbo..',
        '...oooooo...',
        '............'
      ]
    },
    shopping: {
      pal: { o: '#2a2338', p: '#f5d0e0', h: '#c76a9a', w: '#fff6fa' },
      grid: [
        '...o....o...',
        '..o.o..o.o..',
        '..o.o..o.o..',
        '.oooooooooo.',
        '.opppppppppo',
        '.opwwppwwppo',
        '.opppppppppo',
        '.ophhpphhppo',
        '.opppppppppo',
        '.opppppppppo',
        '.oooooooooo.',
        '............'
      ]
    },
    bugnet: {
      pal: { o: '#2a2338', n: '#e4e9f2', h: '#c76a3a', g: '#8fd66a' },
      grid: [
        '...oooo.....',
        '..onnnno....',
        '.onnnnnno...',
        '.onngnnno...',
        '.onnnnnno...',
        '..onnnno....',
        '...oooo.....',
        '.....h......',
        '......h.....',
        '.......h....',
        '........h...',
        '............'
      ]
    },
    wheelbarrow: {
      pal: { o: '#2a2338', m: '#b8562f', d: '#8a3f22', w: '#4a4358', s: '#cfc7dd' },
      grid: [
        '............',
        '..oooooooo..',
        '..ommmmmmo..',
        '..odddddo...',
        '..ommmmo....',
        '..oooooo....',
        '..s...s.....',
        '.oso..s.....',
        'owwwo.s.....',
        'owwwo.......',
        '.ooo........',
        '............'
      ]
    },
    jackhammer: {
      pal: { o: '#2a2338', y: '#ffcf47', g: '#8a8496', t: '#5c5670' },
      grid: [
        '....oo......',
        '...oyyo.....',
        '...oyyo.....',
        '...ottg.....',
        '...ottg.....',
        '...oggo.....',
        '...oggo.....',
        '..ooggoo....',
        '..oggggg....',
        '...oggo.....',
        '...oooo.....',
        '............'
      ]
    },
    lamp: {
      pal: { o: '#2a2338', y: '#ffe066', s: '#8a8496', b: '#5c5670' },
      grid: [
        '...oooooo...',
        '..oyyyyyyo..',
        '.oyyyyyyyyo.',
        '.oyyyyyyyyo.',
        '..oooooooo..',
        '.....ss.....',
        '.....ss.....',
        '.....ss.....',
        '....obbo....',
        '...obbbbo...',
        '...oooooo...',
        '............'
      ]
    },
    swagbag: {
      pal: { o: '#2a2338', b: '#3b3550', h: '#f6f1e4', k: '#6a6382' },
      grid: [
        '.....oo.....',
        '....o..o....',
        '...obbbbo...',
        '..obbbbbbo..',
        '.obbbbbbbbo.',
        '.obbhhhhbbo.',
        '.obbhhhhbbo.',
        '.obbbbbbbbo.',
        '.okbbbbbbko.',
        '.obbbbbbbbo.',
        '..oooooooo..',
        '............'
      ]
    },
    ball: {
      pal: { o: '#2a2338', r: '#ff6f6f', w: '#fff6ea', b: '#5aa9e6' },
      grid: [
        '............',
        '............',
        '....oooo....',
        '...orrrro...',
        '..orwwwwro..',
        '.obwwwwwwbo.',
        '.obwwwwwwbo.',
        '..obbwwbbo..',
        '...obbbbo...',
        '....oooo....',
        '............',
        '............'
      ]
    },
    magnifier: {
      pal: { o: '#2a2338', g: '#bfe6f5', h: '#c76a3a' },
      grid: [
        '..oooo......',
        '.oggggo.....',
        'oggggggo....',
        'oggggggo....',
        'oggggggo....',
        '.oggggo.....',
        '..oooho.....',
        '.....oho....',
        '......oho...',
        '.......oho..',
        '........oo..',
        '............'
      ]
    }
  };

  function createProps(o) {
    var scale = o.scale || 3;
    var canvas = document.createElement('canvas');
    canvas.className = 'prop';
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    o.root.appendChild(canvas);

    var current = null;

    function draw(name) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var p = PROPS[name];
      if (!p) return;
      for (var y = 0; y < p.grid.length; y++) {
        var row = p.grid[y];
        for (var x = 0; x < row.length; x++) {
          var c = row[x];
          if (c === '.' || !p.pal[c]) continue;
          ctx.fillStyle = p.pal[c];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    return {
      set: function (name) {
        if (name === current) return;
        current = name;
        canvas.classList.toggle('on', !!PROPS[name]);
        draw(name);
      },
      /** Props sit on whichever side the pet is not facing. */
      setFacing: function (dir) {
        canvas.classList.toggle('left', dir < 0);
      },
      current: function () { return current; },
      names: function () { return Object.keys(PROPS); },
      destroy: function () { canvas.remove(); }
    };
  }

  global.RKProps = { create: createProps };
})(typeof globalThis !== 'undefined' ? globalThis : window);
