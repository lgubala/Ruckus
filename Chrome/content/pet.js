/* Ruckus — the creature that walks around the page. */
(function (global) {
  'use strict';

  var S = global.RKSprites;
  var L = global.RKLines;



  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function createPet(opts) {
    var root = opts.root;
    var scale = opts.scale || 3;
    var px = S.CANVAS * scale;

    var self_props = null;
    var el = document.createElement('div');
    el.className = 'pet';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Ruckus');
    var canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    el.appendChild(canvas);
    if (global.RKProps) {
      self_props = global.RKProps.create({ root: el, scale: scale });
    }

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.setAttribute('aria-live', 'polite');

    root.appendChild(el);
    root.appendChild(bubble);

    var self = {
      x: 60,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      anim: 'idle',
      frame: 0,
      stage: 0,
      state: null,
      target: null,       // { x, y, onArrive, hover }
      mode: 'roam',       // roam | sniff | held | flee | offstage
      visible: true,
      size: px,
      scale: scale,
      sulking: false,
      reduceMotion: false
    };

    var lastFrameAt = 0;
    var airborne = false;
    var lastPuff = 0;
    var lastDust = 0;
    var lastTrip = 0;
    var lastThink = Date.now();
    var lastBreakNudge = Date.now();
    var bubbleTimer = null;
    var raf = null;

    function floorY() {
      // The sprite has a transparent margin, so sit it lower to compensate.
      return window.innerHeight - self.size + S.PAD * scale - 8;
    }

    self.y = floorY();

    // ---- drawing ------------------------------------------------------

    function redraw() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, px, px);
      if (self.facing < 0) {
        ctx.translate(px, 0);
        ctx.scale(-1, 1);
      }
      if (self_props) self_props.setFacing(self.facing);
      S.drawFrame(ctx, 0, self.anim, self.frame,
        { scale: scale, color: self.color, species: self.species, wear: self.wear });
      ctx.restore();
    }

    function setAnim(name) {
      if (self.anim === name) return;
      self.anim = name;
      self.frame = 0;
      lastFrameAt = 0;
      redraw();
    }
    self.setAnim = setAnim;

    // ---- speech + sparks ----------------------------------------------

    function say(text, ms) {
      if (!bubble.classList.contains('thought')) bubble.classList.remove('thought');
      bubble.innerHTML = '';
      bubble.appendChild(document.createTextNode(text));
      positionBubble();
      bubble.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(function () {
        bubble.classList.remove('show');
      }, ms || 3200);
    }
    self.say = say;

    /** Quieter than speech. Used for musings the user did not ask for. */
    function think(text, ms) {
      bubble.classList.add('thought');
      say(text, ms || 3600);
      clearTimeout(self._thoughtTimer);
      self._thoughtTimer = setTimeout(function () {
        bubble.classList.remove('thought');
      }, (ms || 3600) + 200);
    }
    self.think = think;

    function positionBubble() {
      var bx = clamp(self.x + self.size / 2 - 70, 8, window.innerWidth - 200);
      var by = self.y - 40;
      if (by < 8) by = self.y + self.size + 6;
      bubble.style.left = Math.round(bx) + 'px';
      bubble.style.top = Math.round(by) + 'px';
    }

    /** Mood particles: puff('heart'), puff('zzz'), and so on. */
    function puff(type, n, dx, dy) {
      if (!opts.particles || self.particlesOff) return;
      // Calmer animation thins them out rather than removing them entirely.
      if (self.reduceMotion) n = Math.max(1, Math.round((n || 1) / 2));
      opts.particles.emit(type,
        self.x + self.size / 2 + (dx || 0),
        self.y - 6 + (dy || 0), n || 1);
    }
    self.puff = puff;

    var PUFF_FOR = { '\u2665': 'heart', '\u2726': 'sparkle', '!': 'anger',
                     '*': 'dust', '\u25cf': 'crumb', '~': 'note' };

    function spark(ch, n) {
      if (PUFF_FOR[ch]) { puff(PUFF_FOR[ch], n || 3); return; }
      if (self.reduceMotion) return;
      n = n || 3;
      for (var i = 0; i < n; i++) {
        var s = document.createElement('div');
        s.className = 'spark';
        s.textContent = ch;
        s.style.left = Math.round(self.x + 8 + Math.random() * (self.size - 16)) + 'px';
        s.style.top = Math.round(self.y) + 'px';
        s.style.setProperty('--dx', (Math.random() * 24 - 12).toFixed(0) + 'px');
        s.style.animationDelay = (i * 90) + 'ms';
        root.appendChild(s);
        (function (node) {
          setTimeout(function () { node.remove(); }, 1100 + i * 90);
        })(s);
      }
    }
    self.spark = spark;

    // ---- movement ------------------------------------------------------

    function moveTo(x, y, o) {
      o = o || {};
      self.target = {
        x: o.offscreen ? x : clamp(x, 4, window.innerWidth - self.size - 4),
        y: o.offscreen ? y : clamp(y, 4, window.innerHeight - self.size - 4),
        onArrive: o.onArrive || null,
        speed: o.speed || 90,
        hover: !!o.hover
      };
      self.mode = o.mode || self.mode;
    }
    self.moveTo = moveTo;

    /** Walk to a page rect and sniff at it. */
    function sniffAt(rect) {
      self.mode = 'sniff';
      var wantX = rect.left - self.size + 6;
      if (wantX < 8) wantX = rect.right - 6;
      var wantY = rect.top + rect.height / 2 - self.size + 8;
      moveTo(wantX, wantY, {
        speed: 420,
        hover: true,
        mode: 'sniff',
        onArrive: function () { setAnim('sniff'); }
      });
      self.facing = (rect.left + rect.width / 2) > (self.x + self.size / 2) ? 1 : -1;
    }
    self.sniffAt = sniffAt;

    /** Walk over to a page rect and reach for it. */
    function goGrab(rect, onArrive) {
      if (self.state && self.state.asleep) return;   // let it sleep
      self.mode = 'fetch';
      airborne = true;
      var wantX = clamp(rect.left + rect.width / 2 - self.size / 2,
        4, window.innerWidth - self.size - 4);
      var wantY = clamp(rect.top + rect.height / 2 - self.size * 0.75,
        4, window.innerHeight - self.size - 4);
      self.facing = (rect.left + rect.width / 2) > (self.x + self.size / 2) ? 1 : -1;
      setAnim('walk');
      moveTo(wantX, wantY, {
        speed: 340,
        mode: 'fetch',
        onArrive: function () {
          setAnim('sniff');
          setTimeout(function () {
            if (onArrive) onArrive();
          }, 420);
        }
      });
    }
    self.goGrab = goGrab;

    /** Scarper, loot in tow. */
    function runOff() {
      self.mode = 'roam';
      setAnim('happy');
      wanderSomewhere();
    }
    self.runOff = runOff;

    function returnToFloor() {
      self.mode = 'roam';
      self.target = null;
      setAnim('idle');
    }
    self.returnToFloor = returnToFloor;

    // ---- the think loop ------------------------------------------------

    function think() {
      var st = self.state;
      if (!st || self.sulking || self.mode !== 'roam') return;
      if (self.activity && self.activity !== 'idle') return;
      self.asleep = !!st.asleep;

      if (st.asleep) {
        setAnim('sleep');
        self.target = null;
        return;
      }

      var r = Math.random();
      if (r < 0.06 && st.happiness > 55) {
        zoomies();
      } else if (r < 0.62) {
        wanderSomewhere();
      } else if (r < 0.76) {
        setAnim(st.mood === 'delighted' ? 'happy' : 'idle');
      } else if (r < 0.86) {
        say(L.get('idle.' + st.mood) || L.get('idle.content'));
      }
    }

    /** Pick somewhere new anywhere on screen. Mostly the lower half, because a
     *  pet hovering over the headline is annoying, but it does climb. */
    function wanderSomewhere() {
      var W = window.innerWidth;
      var H = window.innerHeight;
      var margin = 24;
      var nx = margin + Math.random() * Math.max(1, W - self.size - margin * 2);
      var ny;
      var roll = Math.random();
      if (roll < 0.45) {
        ny = floorY();                                   // back down to ground
      } else if (roll < 0.8) {
        ny = H * 0.55 + Math.random() * (floorY() - H * 0.55);   // lower half
      } else {
        ny = margin + Math.random() * (floorY() - margin);       // anywhere
      }
      airborne = Math.abs(ny - floorY()) > 24;
      moveTo(nx, ny, { speed: airborne ? 95 + Math.random() * 70
                                       : 55 + Math.random() * 45 });
    }

    /** A burst of pointless sprinting. Every pet does this. */
    function zoomies(left) {
      if (self.sulking || (self.state && self.state.asleep)) return;
      var laps = 3 + Math.floor(Math.random() * 2);
      airborne = false;
      say(L.get('play.zoomies'), 1600);

      function lap(n, goLeft) {
        if (n <= 0) {
          self.mode = 'roam';
          setAnim('happy');
          puff('sparkle', 3);
          setTimeout(function () {
            if (self.mode === 'roam' && !self.sulking) setAnim('idle');
          }, 900);
          return;
        }
        var x = goLeft ? 24 : window.innerWidth - self.size - 24;
        moveTo(x, floorY(), {
          speed: 760,
          mode: 'zoom',
          onArrive: function () { lap(n - 1, !goLeft); }
        });
        setAnim('walk');
      }
      lap(laps, left !== undefined ? left : self.x > window.innerWidth / 2);
    }
    self.zoomies = zoomies;

    /** A treat is hovering over us. Eyes up, hearts out. */
    self.setHungryEyes = function (on) {
      on = !!on;
      if (on === self.hungryEyes) return;
      self.hungryEyes = on;
      if (self.sulking || (self.state && self.state.asleep)) return;
      if (on) {
        self.target = null;
        setAnim('happy');
        puff('heart', 2);
      } else if (self.mode === 'roam' && !self.sulking) {
        setAnim('idle');
      }
    };

    /** Someone reached for the jar. Notice, and be obvious about it. */
    self.excite = function (rect) {
      if (self.sulking || (self.state && self.state.asleep)) return;
      if (rect) {
        var jx = rect.left + rect.width / 2;
        self.facing = jx > (self.x + self.size / 2) ? 1 : -1;
      }
      setAnim('happy');
      puff('heart', 3);
      if (Math.random() < 0.7) say(pick(TREAT_LINES), 2400);
      setTimeout(function () {
        if (self.mode === 'roam' && !self.sulking && !self.hungryEyes) setAnim('idle');
      }, 1600);
    };

    /** Trot over to the jar and headbutt it until someone takes the hint. */
    self.beg = function (rect, onBump, line) {
      if (!rect || self.sulking || (self.state && self.state.asleep)) return false;
      if (self.mode !== 'roam') return false;
      airborne = false;
      var side = rect.left > window.innerWidth / 2 ? -1 : 1;
      var restX = rect.left + (side < 0 ? -self.size - 4 : rect.width + 4);

      moveTo(restX, floorY(), {
        speed: 420,
        onArrive: function () {
          self.facing = -side;
          say(line || L.get('treats.asking'), 3200);
          bump(2);
        }
      });
      return true;

      function bump(n) {
        if (n <= 0) {
          setAnim('idle');
          puff('heart', 2);
          return;
        }
        setAnim('startled');
        var into = restX + side * 12;
        moveTo(into, floorY(), {
          speed: 520,
          onArrive: function () {
            if (onBump) onBump();
            puff('dust', 2, side * 10, self.size * 0.35);
            moveTo(restX, floorY(), {
              speed: 380,
              onArrive: function () { bump(n - 1); }
            });
          }
        });
      }
    };

    /** Play an animation, then fall back to whatever it was doing. */
    self.playOnce = function (name, ms) {
      if (self.sulking || (self.state && self.state.asleep)) return false;
      if (self.mode !== 'roam') return false;
      self.target = null;
      setAnim(name);
      setTimeout(function () {
        if (self.mode === 'roam' && !self.sulking) setAnim('idle');
      }, ms || 1400);
      return true;
    };

    /** Chase its own tail. */
    self.spin = function () {
      if (self.mode !== 'roam' || self.sulking) return false;
      self.target = null;
      setAnim('walk');
      var flips = 6;
      (function turn() {
        if (flips-- <= 0) {
          setAnim('happy');
          puff('sparkle', 3);
          setTimeout(function () {
            if (self.mode === 'roam' && !self.sulking) setAnim('idle');
          }, 700);
          return;
        }
        self.facing = -self.facing;
        redraw();
        setTimeout(turn, 110);
      })();
      return true;
    };

    /** Look around, as if it heard something. */
    self.glance = function () {
      if (self.mode !== 'roam' || self.sulking) return false;
      var start = self.facing;
      self.facing = -start;
      setAnim('peer');
      setTimeout(function () { self.facing = start; redraw(); }, 700);
      setTimeout(function () {
        if (self.mode === 'roam' && !self.sulking) setAnim('idle');
      }, 1400);
      return true;
    };

    var ACTIVITY_KIT = {
      typing:    { wear: null,        prop: 'notebook',  anim: null, },
      watching:  { wear: 'cinema',    prop: 'popcorn',   anim: null, },
      reading:   { wear: 'glasses',   prop: null,        anim: null, },
      selecting: { wear: null,        prop: 'marker',    anim: 'mark', },
      searching: { wear: null,        prop: 'magnifier', anim: 'peer', },
      music:     { wear: 'headphones', prop: null,       anim: 'dance', },
      shopping:  { wear: 'monocle',   prop: 'shopping',  anim: null, },
      code:      { wear: 'hardhat',   prop: 'bugnet',    anim: null, },
      secure:    { wear: 'blindfold', prop: null,        anim: null, },
      sleepy:    { wear: 'nightcap',  prop: null,        anim: null },
      idle:      { wear: null,        prop: null,        anim: null }
    };

    /**
     * Settle in beside whatever you are doing. The pet stops wandering while an
     * activity is on, because a companion that runs off mid-sentence is not a
     * companion.
     */
    self.setActivity = function (kind, anchor) {
      var kit = ACTIVITY_KIT[kind] || ACTIVITY_KIT.idle;
      var changed = kind !== self.activity;
      self.activity = kind;
      applyLook();

      if (!changed || self.sulking || (self.state && self.state.asleep)) return;
      if (kind === 'idle') {
        self.mode = 'roam';
        return;
      }
      var actLine = L.get('activity.' + kind);
      if (actLine) say(actLine, 3200);
      puff(kind === 'secure' ? 'dust' : 'sparkle', 2);

      if (kind === 'secure') {
        // Turn its back on the password field and stay well out of the way.
        self.target = null;
        self.facing = -self.facing;
        setAnim('idle');
        return;
      }
      if (kind === 'music') {
        self.target = null;
        setAnim('dance');
        return;
      }
      self.perch(anchor);
      if (kit.anim) {
        setTimeout(function () {
          if (self.activity === kind && self.mode === 'roam') setAnim(kit.anim);
        }, 900);
      }
    };

    /** Sit down next to an element and stay put. */
    self.perch = function (anchor) {
      var rect = anchor && anchor.getBoundingClientRect
        ? anchor.getBoundingClientRect() : null;
      var tx, ty;
      if (rect && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
        var onLeft = rect.left > self.size + 30;
        tx = onLeft ? rect.left - self.size - 8 : rect.right + 8;
        ty = clamp(rect.bottom - self.size, 8, floorY());
        self.facing = onLeft ? 1 : -1;
      } else {
        tx = window.innerWidth - self.size - 120;
        ty = floorY();
      }
      airborne = false;
      moveTo(tx, ty, {
        speed: 380,
        onArrive: function () { setAnim('idle'); }
      });
    };

    // ---- costumes -----------------------------------------------------
    // Anything temporary goes through dressUp(), which always carries a
    // deadline. A costume that only undoes itself in a success callback gets
    // stranded the moment something interrupts the pet — which is exactly what
    // happened with the wheelbarrow.

    var costume = null;
    var costumeTimer = null;

    /** Work out what it should be wearing right now, from the ground up. */
    function applyLook() {
      var kit = ACTIVITY_KIT[self.activity] || ACTIVITY_KIT.idle;
      var prop = costume ? costume.prop : kit.prop;
      var wear = costume ? costume.wear : kit.wear;

      // Nightcap only when nothing else has an opinion.
      if (!costume && !wear && self.state) {
        var latish = typeof self.state.hour === 'number' &&
          (self.state.hour >= 23 || self.state.hour < 6);
        if (self.state.asleep || latish) wear = 'nightcap';
      }

      self.wear = wear || null;
      if (self_props) self_props.set(prop || null);
      redraw();
    }
    self.applyLook = applyLook;

    /** Put something on, with a hard deadline. */
    self.dressUp = function (prop, wear, ms) {
      clearTimeout(costumeTimer);
      costume = { prop: prop || null, wear: wear || null, at: Date.now() };
      applyLook();
      costumeTimer = setTimeout(function () {
        costumeTimer = null;
        self.undress();
      }, ms || 25000);
    };

    /** Back to normal, whatever "normal" currently means. */
    self.undress = function () {
      clearTimeout(costumeTimer);
      costumeTimer = null;
      costume = null;
      applyLook();
    };

    self.inCostume = function () { return !!costume; };

    // Kept for callers that only need one half.
    self.carry = function (prop) {
      if (prop) self.dressUp(prop, costume ? costume.wear : null);
      else self.undress();
    };
    self.wearFor = function (item) {
      if (item) self.dressUp(costume ? costume.prop : null, item);
      else self.undress();
    };

    /** Trundle to a spot, pushing whatever it is pushing. */
    self.haulTo = function (x, y, onArrive) {
      self.mode = 'haul';
      airborne = false;
      setAnim('push');
      moveTo(x, y, {
        speed: 150,
        mode: 'haul',
        onArrive: function () {
          self.mode = 'roam';
          setAnim('idle');
          if (onArrive) onArrive();
        }
      });
    };

    /** Leg it off the side of the screen. */
    self.escape = function (onGone) {
      var goLeft = (self.x + self.size / 2) < window.innerWidth / 2;
      airborne = false;
      setAnim('walk');
      moveTo(goLeft ? -self.size - 30 : window.innerWidth + 30, floorY(), {
        speed: 820,
        mode: 'flee',
        offscreen: true,
        onArrive: function () {
          self.hide();
          if (onGone) onGone();
        }
      });
    };

    /** Trip over its own feet. Recovers, looks embarrassed. */
    self.stumble = function () {
      if (self.mode !== 'roam' || self.sulking) return false;
      self.target = null;
      setAnim('stumble');
      puff('dust', 3, 0, self.size * 0.35);
      say(L.get('play.stumble'), 1800);
      setTimeout(function () {
        if (self.mode === 'roam' && !self.sulking) setAnim('idle');
      }, 1500);
      return true;
    };

    self.sneeze = function () {
      if (self.mode !== 'roam' || self.sulking) return false;
      self.target = null;
      setAnim('sneeze');
      setTimeout(function () {
        puff('dust', 5, self.facing * 16, -4);
        self.x = clamp(self.x - self.facing * 6, 4, window.innerWidth - self.size - 4);
        say(L.get('play.sneeze'), 1600);
      }, 340);
      setTimeout(function () {
        if (self.mode === 'roam' && !self.sulking) setAnim('idle');
      }, 1700);
      return true;
    };

    /** Go after a bug. Returns true while still hunting. */
    self.pounceAt = function (x, y, onCatch) {
      if (self.sulking || (self.state && self.state.asleep)) return false;
      self.mode = 'hunt';
      airborne = true;
      self.facing = x > (self.x + self.size / 2) ? 1 : -1;
      setAnim('pounce');
      moveTo(x - self.size / 2, y - self.size * 0.6, {
        speed: 460,
        mode: 'hunt',
        onArrive: function () {
          self.mode = 'roam';
          if (onCatch) onCatch();
        }
      });
      return true;
    };

    /** Bounce on the spot a few times, as if keeping a ball up. */
    self.bounce = function (times, onDone) {
      if (self.mode !== 'roam' || self.sulking) { if (onDone) onDone(); return false; }
      self.target = null;
      var left = times || 3;
      var baseY = self.y;
      airborne = false;
      (function hop() {
        if (left-- <= 0) {
          setAnim('happy');
          puff('sparkle', 3);
          setTimeout(function () {
            if (self.mode === 'roam' && !self.sulking) setAnim('idle');
            if (onDone) onDone();
          }, 700);
          return;
        }
        setAnim('juggle');
        moveTo(self.x + (Math.random() - 0.5) * 40, baseY - 46, {
          speed: 520,
          onArrive: function () {
            moveTo(self.x, baseY, { speed: 620, onArrive: hop });
          }
        });
      })();
      return true;
    };

    /** Go and sit at a specific spot and stay there. */
    self.perchAt = function (x, y) {
      if (self.sulking) return false;
      airborne = true;
      moveTo(x, y, { speed: 300, onArrive: function () { setAnim('idle'); } });
      return true;
    };

    self.wander = function () { wanderSomewhere(); return true; };

    function maybeNudgeBreak() {
      var now = Date.now();
      if (now - lastBreakNudge < 45 * 60000) return;
      lastBreakNudge = now;
      if (!self.visible || self.mode !== 'roam') return;
      say(L.get('breaks'), 6000);
      spark('~', 2);
    }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (!self.visible) return;

      var now = Date.now();

      // Animation frame advance.
      var f = S.fps(self.anim) * (self.reduceMotion ? 0.4 : 1);
      if (!lastFrameAt) lastFrameAt = t;
      if (t - lastFrameAt > 1000 / f) {
        lastFrameAt = t;
        self.frame = (self.frame + 1) % S.frameCount(self.anim);
        redraw();
      }

      // Movement toward target.
      if (self.target && self.mode !== 'held') {
        var dx = self.target.x - self.x;
        var dy = self.target.y - self.y;
        var dist = Math.hypot(dx, dy);
        var step = self.target.speed / 60;
        if (dist <= step) {
          self.x = self.target.x;
          self.y = self.target.y;
          var cb = self.target.onArrive;
          self.target = null;
          if (self.mode === 'roam') setAnim('idle');
          if (cb) cb();
        } else {
          self.x += (dx / dist) * step;
          self.y += (dy / dist) * step;
          if (Math.abs(dx) > 2) self.facing = dx > 0 ? 1 : -1;
          if (self.mode === 'roam') setAnim(airborne ? 'happy' : 'walk');
        }
      } else if (self.mode === 'roam' && !self.target) {
        // Keep it inside the window if the viewport changed under us.
        var maxY = window.innerHeight - self.size - 4;
        var maxX = window.innerWidth - self.size - 4;
        if (self.y > maxY) self.y += clamp(maxY - self.y, -8, 8);
        if (self.x > maxX) self.x += clamp(maxX - self.x, -8, 8);
      }

      if (now - lastThink > 4200) {
        lastThink = now;
        think();
        maybeNudgeBreak();
        var awake = !(self.state && self.state.asleep);
        if (awake && !self.sulking && self.mode === 'roam' && opts.onIdleThink) {
          opts.onIdleThink();
        }
      }

      // Ambient mood particles. tick() runs unconditionally so anything already
      // in flight still fades out when the setting changes mid-air.
      if (opts.particles) {
        var st2 = self.state;
        if (!self.particlesOff && now - lastPuff > (self.reduceMotion ? 1600 : 700)) {
          lastPuff = now;
          if (st2 && st2.asleep) puff('zzz', 1, self.facing * 14, -18);
          else if (self.sulking) { if (Math.random() < 0.3) puff('anger', 1, 0, -8); }
          else if (st2 && st2.mood === 'hungry' && Math.random() < 0.45) puff('sweat', 1, 10, -6);
          else if (st2 && st2.mood === 'delighted' && Math.random() < 0.5) puff('note', 1, self.facing * -12, -10);
          else if (Math.random() < 0.12) puff('sparkle', 1, 0, -10);
        }
        // Dust kicked up while hurrying along the ground.
        if (!self.particlesOff && self.target && !airborne && self.mode !== 'held' &&
            self.target.speed > 300 && now - lastDust > (self.mode === 'zoom' ? 60 : 110)) {
          lastDust = now;
          puff('dust', self.mode === 'zoom' ? 2 : 1,
            -self.facing * self.size * 0.3, self.size * 0.38);
        }
        opts.particles.tick(t);
      }

      // Every so often it trips over nothing at all.
      if (self.mode === 'roam' && self.target && !airborne && !self.activity &&
          now - lastTrip > 40000 && Math.random() < 0.004) {
        lastTrip = now;
        self.stumble();
      }

      // Belt and braces. If anything ever leaks a costume past its deadline,
      // this notices within a second.
      if (costume && now - costume.at > 45000) self.undress();

      if (opts.onFrame) opts.onFrame(t);

      var bob = (airborne && self.target && !self.reduceMotion)
        ? Math.sin(t / 130) * 3 : 0;
      el.style.transform = 'translate3d(' + Math.round(self.x) + 'px,' +
        Math.round(self.y + bob) + 'px,0)';
      if (bubble.classList.contains('show')) positionBubble();
    }

    // ---- interaction ---------------------------------------------------

    var down = null;

    // Gestures, all deliberate — moving the mouse near the pet does nothing.
    //   tap        -> pat (or apologise, if it is sulking)
    //   double tap -> shoo
    //   long press -> menu
    //   drag       -> pick it up and carry it
    var TAP_WINDOW = 260;
    var LONG_PRESS = 480;
    var tapTimer = null;
    var pressTimer = null;

    function cancelPress() {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      down = { x: e.clientX, y: e.clientY, moved: false, t: Date.now() };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.classList.add('dragging');

      cancelPress();
      pressTimer = setTimeout(function () {
        if (!down || down.moved) return;
        down.handled = true;
        clearTimeout(tapTimer);
        tapTimer = null;
        setAnim('idle');
        if (opts.onMenu) {
          opts.onMenu(self.x + self.size / 2, self.y);
        }
      }, LONG_PRESS);
    });

    el.addEventListener('pointermove', function (e) {
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
        down.moved = true;
        cancelPress();
        self.mode = 'held';
        self.target = null;
        airborne = false;
        setAnim('startled');
        self.x = e.clientX - self.size / 2;
        self.y = e.clientY - self.size / 2;
      }
    });

    el.addEventListener('pointerup', function (e) {
      if (!down) return;
      el.classList.remove('dragging');
      cancelPress();
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      var wasDragged = down.moved;
      var handled = down.handled;
      down = null;

      if (wasDragged) {
        self.mode = 'roam';
        moveTo(self.x, floorY(), { speed: 700, onArrive: function () {
          setAnim('idle');
          spark('*', 2);
        }});
        return;
      }
      if (handled) return;   // long press already did something

      if (tapTimer) {
        // Second tap inside the window: that is a shoo.
        clearTimeout(tapTimer);
        tapTimer = null;
        shoo();
        return;
      }
      tapTimer = setTimeout(function () {
        tapTimer = null;
        if (self.sulking) {
          if (opts.onForgive) opts.onForgive();
        } else if (opts.onPat) {
          setAnim('happy');
          spark('\u2665', 3);
          opts.onPat();
          setTimeout(function () {
            if (self.mode === 'roam' && !self.sulking) setAnim('idle');
          }, 1400);
        }
      }, TAP_WINDOW);
    });

    // Notices you. Turns to face the cursor when it comes near, and perks up
    // if you linger. Deliberately does nothing else — no shooing on movement.
    var lastLook = 0;

    function onNearby(e) {
      if (!self.visible || self.sulking || self.mode === 'held') return;
      if (self.state && self.state.asleep) return;
      var cx = self.x + self.size / 2;
      var cy = self.y + self.size / 2;
      var d = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (d > self.size * 3.2) return;
      var now = Date.now();
      if (now - lastLook < 700) return;
      lastLook = now;
      if (Math.abs(e.clientX - cx) > 8) self.facing = e.clientX > cx ? 1 : -1;
      if (d < self.size * 1.5 && self.mode === 'roam' && !self.target &&
          Math.random() < 0.5) {
        setAnim('happy');
        puff('note', 1, 0, -8);
        setTimeout(function () {
          if (self.mode === 'roam' && !self.sulking) setAnim('idle');
        }, 1100);
      }
    }
    window.addEventListener('pointermove', onNearby, { passive: true });

    // Hold on! Reacts when the page yanks out from under it.
    var lastScroll = window.scrollY;
    var lastScrollAt = 0;
    window.addEventListener('scroll', function () {
      var now = Date.now();
      var delta = Math.abs(window.scrollY - lastScroll);
      lastScroll = window.scrollY;
      if (!self.visible || self.sulking || self.mode === 'held') return;
      if (self.state && self.state.asleep) return;
      if (delta < 900 || now - lastScrollAt < 4000) return;
      lastScrollAt = now;
      setAnim('startled');
      puff('dust', 3, 0, self.size * 0.3);
      setTimeout(function () {
        if (self.mode === 'roam' && !self.sulking) setAnim('idle');
      }, 900);
    }, { passive: true });

    // Hovering right over him gets a reaction. Distinct from the cursor
    // proximity check, which only makes him turn to look.
    var HOVER_ACTS = ['shrug', 'headtilt', 'wave', 'peer'];
    var lastHover = 0;

    el.addEventListener('pointerenter', function () {
      var now = Date.now();
      if (now - lastHover < 2600) return;
      lastHover = now;
      if (self.sulking) { setAnim('sulk'); return; }
      if (self.state && self.state.asleep) {
        puff('zzz', 1, self.facing * 14, -18);
        return;
      }
      if (self.mode !== 'roam') return;
      self.target = null;
      var act = pick(HOVER_ACTS);
      setAnim(act);
      if (act === 'wave') puff('heart', 1);
      setTimeout(function () {
        if (self.mode === 'roam' && !self.sulking && !self.activity) setAnim('idle');
      }, act === 'wave' ? 1500 : 1200);
    });

    el.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (opts.onMenu) opts.onMenu(self.x + self.size / 2, self.y);
    });

    /** Deliberate dismissal. Straight to sulking, no warning shot needed. */
    function shoo() {
      if (self.sulking) return;
      setAnim('startled');
      spark('!', 1);
      var goLeft = (self.x + self.size / 2) < window.innerWidth / 2;
      airborne = false;
      say(L.get('events.shooed'), 1800);
      beginSulk(goLeft);
      if (opts.onShoo) opts.onShoo();
    }
    self.shoo = shoo;

    /** Retreat to a corner, turn to face the wall, and stop wandering. */
    function beginSulk(goLeft) {
      if (goLeft === undefined) {
        goLeft = (self.x + self.size / 2) < window.innerWidth / 2;
      }
      self.sulking = true;
      el.classList.add('sulking');
      var corner = goLeft ? 12 : window.innerWidth - self.size - 12;
      moveTo(corner, floorY(), {
        speed: 700,
        mode: 'sulk',
        onArrive: function () {
          self.mode = 'sulk';
          self.facing = goLeft ? -1 : 1;   // nose to the wall
          setAnim('sulk');
        }
      });
      setAnim('startled');
    }

    self.setSulking = function (on) {
      if (on === self.sulking) return;
      if (on) {
        beginSulk();
      } else {
        self.sulking = false;
        el.classList.remove('sulking');
        self.mode = 'roam';
        self.target = null;
        setAnim('happy');
        spark('\u2665', 3);
        setTimeout(function () {
          if (self.mode === 'roam' && !self.sulking) setAnim('idle');
        }, 1400);
      }
    };

    // ---- public surface -------------------------------------------------

    self.setCarrying = function (n) {
      var was = self.carrying || 0;
      self.carrying = n || 0;
      if (self.carrying > was && self.mode === 'roam') {
        setAnim('happy');
        setTimeout(function () {
          if (self.mode === 'roam' && !self.sulking) setAnim('idle');
        }, 1500);
      }
    };

    self.setState = function (view) {
      self.state = view;
      self.color = view.settings.color || null;
      self.species = view.settings.species || 'ruckus';
      self.reduceMotion = !!(view.settings && view.settings.reduceMotion);
      self.particlesOff = view.settings && view.settings.particles === false;
      applyLook();
    };

    /** Put the pet where it was in the tab you just came from. */
    self.placeAt = function (xr, yr) {
      if (typeof xr !== 'number' || typeof yr !== 'number') return;
      self.x = clamp(xr * (window.innerWidth - self.size), 4, window.innerWidth - self.size - 4);
      self.y = clamp(yr * (window.innerHeight - self.size), 4, floorY());
      self.target = null;
    };

    self.where = function () {
      return {
        xr: self.x / Math.max(1, window.innerWidth - self.size),
        yr: self.y / Math.max(1, window.innerHeight - self.size)
      };
    };

    /** Come to the middle of the screen and pay attention. */
    self.summon = function () {
      self.sulking = false;
      el.classList.remove('sulking');
      self.mode = 'roam';
      airborne = true;
      moveTo(window.innerWidth / 2 - self.size / 2,
             window.innerHeight * 0.55, {
        speed: 900,
        onArrive: function () {
          setAnim('happy');
          puff('sparkle', 4);
          setTimeout(function () {
            if (self.mode === 'roam' && !self.sulking) setAnim('idle');
          }, 1600);
        }
      });
    };

    self.show = function () {
      self.visible = true;
      el.classList.remove('gone');
      if (self.x < 0 || self.x > window.innerWidth) self.x = window.innerWidth * 0.25;
      self.y = floorY();
      self.mode = 'roam';
      setAnim('idle');
    };

    self.hide = function () {
      self.visible = false;
      el.classList.add('gone');
      bubble.classList.remove('show');
    };

    self.destroy = function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onNearby);
      el.remove();
      bubble.remove();
    };

    redraw();
    raf = requestAnimationFrame(loop);
    return self;
  }

  global.RKPet = { create: createPet };
})(typeof globalThis !== 'undefined' ? globalThis : window);
