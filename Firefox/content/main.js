/* Ruckus — content entry point. */
(function () {
  'use strict';

  var api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  var L = globalThis.RKLines;

  // In Firefox content scripts `window` and `globalThis` are different objects:
  // `window` is an Xray wrapper around the page, `globalThis` is the sandbox.
  // Sibling scripts export onto the sandbox, so look there first.
  // ---- logging -------------------------------------------------------------
  // Off by default. Turn it on from the popup (Settings > Verbose logging) or
  // from the page console with __ruckus.debug(true).

  var LOG_KEY = '__ruckusDebug';
  var debugOn = false;
  try { debugOn = window.localStorage.getItem(LOG_KEY) === '1'; } catch (_) {}

  function log() {
    if (!debugOn) return;
    var args = ['%c[Ruckus]', 'color:#6ff2b8;font-weight:600'];
    for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
    console.log.apply(console, args);
  }

  function setDebug(on) {
    debugOn = !!on;
    try { window.localStorage.setItem(LOG_KEY, debugOn ? '1' : '0'); } catch (_) {}
    console.info('[Ruckus] verbose logging ' + (debugOn ? 'ON' : 'off'));
    if (debugOn) dumpState();
    return debugOn;
  }

  function dumpState() {
    console.group('[Ruckus] state');
    console.log('view', view);
    console.log('pet', pet && { x: Math.round(pet.x), y: Math.round(pet.y),
      visible: pet.visible, anim: pet.anim, mode: pet.mode, stage: pet.stage,
      sulking: pet.sulking, reduceMotion: pet.reduceMotion,
      particlesOff: pet.particlesOff });
    console.log('particles', particles && particles.status());
    console.log('modules', {
      sprites: !!shared('RKSprites'), pet: !!shared('RKPet'),
      finder: !!shared('RKFinder'), mischief: !!shared('RKMischief'),
      tools: !!shared('RKTools'), treats: !!shared('RKTreats'),
      particles: !!shared('RKParticles'), sound: !!shared('RKSound'),
      chatter: !!shared('RKChatter')
    });
    console.groupEnd();
  }

  function shared(name) {
    try { if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name]; } catch (_) {}
    try { if (typeof window !== 'undefined' && window[name]) return window[name]; } catch (_) {}
    return null;
  }
  if (window.__ruckusLoaded) return;
  window.__ruckusLoaded = true;
  if (window.top !== window) return; // top frame only

  // Registered first and outside boot(), so the popup can detect us even if
  // something below throws.
  api.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === 'RK_PING') {
      return Promise.resolve({
        ok: true,
        host: location.host,
        booted: !!pet,
        hostAttached: !!(host && host.isConnected),
        styleLoaded: styleLoaded,
        petVisible: !!(pet && pet.visible),
        petAt: pet ? Math.round(pet.x) + ',' + Math.round(pet.y) : null,
        petSize: pet ? pet.size : null,
        petStage: pet ? pet.stage : null,
        petAnim: pet ? pet.anim : null,
        finderOpen: !!(finder && finder.isOpen()),
        highlightAPI: !!(shared('RKFinder') && shared('RKFinder').supportsHighlightAPI),
        gotState: !!view,
        shouldShow: view ? shouldShowPet(view) : null,
        hiddenReason: hideReason(view),
        sulking: !!(pet && pet.sulking),
        holding: mischief ? mischief.holding() : 0,
        particles: particles ? particles.status() : 'MISSING',
        activity: activity ? activity.kind() : 'n/a',
        needs: view && view.needs
          ? 'curiosity=' + Math.round(view.needs.curiosity) +
            ' mischief=' + Math.round(view.needs.mischiefUrge) +
            ' confidence=' + Math.round(view.needs.confidence)
          : 'n/a',
        lastChoice: brain ? (brain.lastChoice() || 'none yet') : 'n/a',
        wearing: pet ? (pet.wear || 'nothing') : null,
        onDark: !!(layer && layer.classList.contains('on-dark')),
        sulkMinutes: view ? view.sulkMinutes : null,
        bootError: bootError,
        viewport: window.innerWidth + 'x' + window.innerHeight
      });
    }
  });

  var styleLoaded = false;
  var bootError = null;

  var host, shadow, layer, pet, finder, mischief, tools, jar,
      particles, sound, chatter, brain, activity;
  var view = null;
  var awarded = Object.create(null);
  var lastAward = 0;

  // ---- host ---------------------------------------------------------------

  function buildHost() {
    // Belt and braces against a stray overlay from an earlier injection.
    var stale = document.querySelectorAll('[data-ruckus]');
    for (var i = 0; i < stale.length; i++) stale[i].remove();

    host = document.createElement('div');
    host.setAttribute('data-ruckus', '');
    // position:fixed creates a stacking context, so the z-index has to live on
    // the host or everything inside sits below the page.
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;' +
      'z-index:2147483647;pointer-events:none;';
    shadow = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    shadow.appendChild(style);
    // The stylesheet is split by concern; fetch the modules in order and
    // concatenate. Plugins append their own CSS through the registry.
    var SHEETS = ['base', 'pet', 'panels', 'tools'];
    Promise.all(SHEETS.map(function (name) {
      return fetch(api.runtime.getURL('ui/' + name + '.css'))
        .then(function (r) { return r.text(); })
        .catch(function () { return ''; });
    })).then(function (parts) {
      var plugin = shared('RKRegistry') ? shared('RKRegistry').css() : '';
      style.textContent = parts.join('\n') +
        (plugin ? '\n\n/* --- from plugins --- */\n' + plugin : '');
      styleLoaded = parts.some(function (p) { return p.length > 0; });
      log('stylesheets loaded:', parts.map(function (p, i) {
        return SHEETS[i] + '=' + p.length;
      }).join(' '));
    });

    layer = document.createElement('div');
    layer.className = 'layer';
    detectTheme();
    shadow.appendChild(layer);
    document.documentElement.appendChild(host);
  }

  // ---- page theme ----------------------------------------------------------
  // A dark bubble is unreadable on a dark site. Work out roughly how dark the
  // page is and flip the bubble palette to suit.

  function luminanceOf(color) {
    var m = /rgba?\(([^)]+)\)/.exec(color || '');
    if (!m) return null;
    var parts = m[1].split(',').map(parseFloat);
    if (parts.length > 3 && parts[3] === 0) return null;   // transparent
    return (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255;
  }

  function detectTheme() {
    var lum = null;
    var probes = [document.body, document.documentElement];
    for (var i = 0; i < probes.length && lum === null; i++) {
      if (!probes[i]) continue;
      try { lum = luminanceOf(getComputedStyle(probes[i]).backgroundColor); } catch (_) {}
    }
    var forced = view && view.settings && view.settings.theme;
    var dark;
    if (forced === 'dark') dark = true;
    else if (forced === 'light') dark = false;
    else if (lum !== null) dark = lum < 0.42;
    else {
      dark = false;
      try {
        dark = !!(window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      } catch (_) {}
    }
    layer.classList.toggle('on-dark', dark);
    log('page theme:', dark ? 'dark' : 'light', '(luminance', lum, ')');
    return dark;
  }

  // ---- site rules -----------------------------------------------------------

  function matchesRule(list) {
    var url = location.hostname + location.pathname;
    return (list || []).some(function (rule) {
      rule = String(rule).trim().toLowerCase();
      return rule && url.toLowerCase().indexOf(rule) !== -1;
    });
  }

  /** null when the pet should be on screen, otherwise a human-readable reason. */
  function hideReason(v) {
    if (!v) return 'no state yet';
    if (!v.settings.enabled) return 'turned off in settings';
    if (matchesRule(v.settings.mutedSites)) return 'this site is muted';
    if (matchesRule(v.settings.quietSites)) return 'site matches the stay-away list';
    return null;
  }

  function shouldShowPet(v) { return hideReason(v) === null && !!onStage; }

  // ---- one pet, not one per tab -------------------------------------------
  // Every tab runs its own content script, so without this you get a pet in
  // each one. Only the tab you are actually looking at gets to host it.

  var onStage = !document.hidden;

  function refreshStage() {
    var next = !document.hidden;
    if (next === onStage) return;
    onStage = next;
    if (!pet) return;
    if (onStage) {
      if (shouldShowPet(view)) {
        pet.show();
        if (view && view.pos) pet.placeAt(view.pos.xr, view.pos.yr);
      }
    } else {
      savePosition();
      pet.hide();
      if (mischief) mischief.returnAll();
      if (shared('RKRegistry') && shared('RKRegistry').clearCritters) shared('RKRegistry').clearCritters();
      if (particles) particles.clear();
      closeMenu();
      closeBurrow();
      if (badgeEl) badgeEl.classList.remove('open');
    }
  }

  var lastSaved = 0;
  var lastBeg = 0;
  var lastJarCheck = 0;
  var lastPounce = 0;
  var lastFrameAt = 0;

  function savePosition() {
    if (!pet || !pet.visible) return;
    var now = Date.now();
    if (now - lastSaved < 1500) return;
    lastSaved = now;
    var w = pet.where();
    send('pos', w);
  }

  document.addEventListener('visibilitychange', refreshStage);
  setInterval(savePosition, 4000);
  window.addEventListener('pagehide', function () {
    if (mischief) mischief.returnAll();
  });

  // ---- background chatter ----------------------------------------------------

  function send(action, payload) {
    return api.runtime.sendMessage({ type: 'RK_ACTION', action: action, payload: payload || {} })
      .then(function (res) {
        if (res && res.ok) applyState(res.state, res.event);
        return res;
      })
      .catch(function () { return null; });
  }

  var ORDINALS = ['Zeroth', 'First', 'Second', 'Third', 'Fourth', 'Fifth',
                  'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];

  function ordinal(n) {
    if (n < ORDINALS.length) return ORDINALS[n];
    var suffix = (n % 10 === 1 && n % 100 !== 11) ? 'st'
               : (n % 10 === 2 && n % 100 !== 12) ? 'nd'
               : (n % 10 === 3 && n % 100 !== 13) ? 'rd' : 'th';
    return n + suffix;
  }

  /** Lines that draw on what it actually remembers. */
  function rememberedLine(event) {
    if (!view || !view.memory) return null;
    var m = view.memory;
    var host = location.hostname.replace(/^www\./, '');
    var site = m.sites && m.sites[host];

    if (event === 'fed') {
      if (m.feeds === 1) return L.get('events.fedFirst');
      if (m.fedToday >= 8) return L.fill(L.get('fed.shameless'), { ordinal: ordinal(m.fedToday) });
      if (m.fedToday >= 4) return L.fill(L.get('fed.nth'), { ordinal: ordinal(m.fedToday) });
      if (m.fedToday === 3) return L.get('fed.third');
      if (m.fedToday === 2) return L.get('fed.second');
      if (m.lastFedAt && Date.now() - m.lastFedAt > 36 * 3600000) {
        return L.get('fed.backAfterAWhile');
      }
      return null;
    }
    if (event === 'patted') {
      if (m.pats === 1) return L.get('events.patFirst');
      if (m.pats === 25) return L.get('pats.milestone25');
      if (m.pats === 100) return L.get('pats.milestone100');
      if (m.shoos > m.pats) return L.get('pats.moreShoos');
      return null;
    }
    if (event === 'returned' && site && site.visits > 20) {
      return L.get('pats.fondOfHere');
    }
    return null;
  }

  var EVENT_LINES = {
    stole: null,
    helped: null,
    unstashed: null,
    stashed: L.get('events.stashed'),
    napping: L.get('events.napping'),
    returned: L.get('events.returned'),
    fed: L.get('events.fedAgain'),
    patted: L.get('events.patted'),
    alreadyPatted: L.get('events.pattedFull'),
    levelUp: L.get('events.levelUp'),

    noTreats: L.get('events.noTreats'),
    shooed: null,
    sniffed: null
  };

  var returnTimer = null;

  /** Come back on our own when the sulk expires, without needing a reload.
   *  A poll rather than one long timer, so a throttled tab or a clock change
   *  can't strand the pet off-screen. Only runs while it is actually hidden. */
  function scheduleReturn(v) {
    clearInterval(returnTimer);
    if (!v.sulkUntil || v.sulkUntil <= Date.now()) return;
    returnTimer = setInterval(function () {
      if (!view || !view.sulkUntil || view.sulkUntil <= Date.now()) {
        clearInterval(returnTimer);
        returnTimer = null;
        send('get');
      }
    }, 5000);
  }

  /** Everything that applies regardless of whether the pet is visible. */
  function applySettings(v) {
    var st = v.settings || {};
    if (particles) particles.setEnabled(st.particles !== false);
    if (sound) {
      sound.setEnabled(st.sound !== false);
      sound.setVolume(typeof st.volume === 'number' ? st.volume : 0.25);
    }
    if (st.debug !== undefined && !!st.debug !== debugOn) setDebug(!!st.debug);
    detectTheme();
  }

  function applyState(next, event) {
    view = next;
    log('state', event || '(sync)', {
      mood: next.mood, asleep: next.asleep, treats: next.treats,
      sulkMinutes: next.sulkMinutes, timerLeft: next.timerLeft,
      particles: next.settings.particles !== false,
      reduceMotion: !!next.settings.reduceMotion
    });
    scheduleReturn(next);
    if (!pet) return;
    pet.setState(next);
    if (finder) finder.setPet(next);
    if (jar) {
      jar.setTreats(next.treats);
      jar.setVisible(next.settings.showJar !== false && shouldShowPet(next));
    }

    // Settings that have nothing to do with whether the pet is on screen must
    // be applied unconditionally. These used to live inside the branch below,
    // so switching sound off while the pet was hidden, sulking, on a muted site
    // or in a background tab simply never reached the sound module.
    applySettings(next);

    if (shouldShowPet(next)) {
      if (!pet.visible) {
        pet.show();
        if (next.pos) pet.placeAt(next.pos.xr, next.pos.yr);
      }
      pet.setSulking(next.sulkMinutes > 0);
      renderBadge();
    } else if (pet.visible) {
      pet.hide();
    }

    var SOUND_FOR = { patted: 'pat', fed: 'feed', levelUp: 'levelUp',
                      evolved: 'levelUp', stole: 'steal', shooed: 'shoo',
                      stashed: 'steal', helped: 'pat' };
    if (sound && event && SOUND_FOR[event]) sound.play(SOUND_FOR[event]);

    var line = (event && rememberedLine(event)) || (event && EVENT_LINES[event]);
    if (line && pet.visible) {
      pet.say(line);
      if (event === 'evolved' || event === 'levelUp') pet.spark('\u2726', 5);
      if (event === 'fed') { pet.setAnim('eat'); pet.spark('\u25cf', 3); }
    }
  }

  // ---- wiring ------------------------------------------------------------------

  function boot() {
    buildHost();

    var RKPet = shared('RKPet');
    var RKFinder = shared('RKFinder');
    var RKMischief = shared('RKMischief');
    var RKTools = shared('RKTools');
    var RKParticles = shared('RKParticles');
    var RKSound = shared('RKSound');
    var RKChatter = shared('RKChatter');
    var RKBrain = shared('RKBrain');
    var RKActivity = shared('RKActivity');
    var RKTreats = shared('RKTreats');
    if (!RKPet || !RKFinder || !shared('RKSprites') || !RKParticles) {
      throw new Error('sibling content scripts did not load (RKSprites=' +
        !!shared('RKSprites') + ' RKPet=' + !!RKPet + ' RKFinder=' + !!RKFinder +
        ' RKParticles=' + !!RKParticles + ' RKTools=' + !!RKTools +
        ' RKTreats=' + !!RKTreats + ')');
    }

    if (RKParticles) {
      particles = RKParticles.create({ root: layer, log: log });
      log('particles ready:', particles.status());
    }
    if (RKSound) {
      try {
        sound = RKSound.create({ url: function (p) { return api.runtime.getURL(p); }, log: log });
        sound.loadPack();
      } catch (e) {
        log('sound unavailable:', e);
        sound = null;
      }
    }

    pet = RKPet.create({
      root: layer,
      particles: particles,
      // Bigger sprite on big screens so it stays readable.
      scale: window.innerWidth >= 1900 ? 4 : 3,
      onPat: function () { send('pat'); },
      onShoo: function () { send('shoo'); closeMenu(); },
      onForgive: function () { send('comeBack'); },
      onMenu: openMenu,
      onFrame: function (now) {
        // jar.rect() forces layout, so this used to cost a reflow every single
        // frame. Four times a second is plenty for a proximity glow.
        if (jar && now - lastJarCheck > 250) {
          lastJarCheck = now;
          var r = jar.rect();
          var near = Math.abs((pet.x + pet.size / 2) - (r.left + r.width / 2)) < 90 &&
                     Math.abs((pet.y + pet.size / 2) - (r.top + r.height / 2)) < 110;
          jar.setNear(near && pet.visible);
        }

        // Plugins that need a frame get one, with a shared little api.
        var reg = shared('RKRegistry');
        if (reg) {
          reg.runTickers(now, {
            pet: pet, root: layer, sound: sound,
            dt: Math.min(0.05, (now - lastFrameAt) / 1000) || 0.016,
            reward: function () { send('inspected'); }
          });
        }
        lastFrameAt = now;

        if (!mischief) return;
        mischief.follow();
        if (pet.carrying !== mischief.holding()) pet.setCarrying(mischief.holding());
      },
      // Everything self-directed now goes through the brain, which weighs the
      // pet's drives against what is on the page and commits to one thing.
      onIdleThink: function () {
        // While you are typing or watching something, it keeps you company
        // instead of running off. Only the small idle animations continue.
        // Only states where you are actively engaged stand the brain down.
        // Reading or browsing a shop should not make it a statue — that bug
        // meant it never misbehaved on any long article.
        var ENGAGED = { typing: 1, watching: 1, secure: 1, searching: 1, music: 1 };
        if (activity && ENGAGED[activity.kind()]) {
          if (Math.random() < 0.35) pet.playOnce(
            pet.activity === 'typing' ? 'scratch' : 'peer', 1300);
          return;
        }
        if (brain) brain.act();
      }
    });

    finder = RKFinder.create({
      root: layer,
      onOpen: function () { if (activity) activity.setOverride('searching'); },
      onFocusMatch: function (rect) {
        if (pet && pet.visible) pet.sniffAt(rect);
      },
      onSearch: function (query, count) {
        var now = Date.now();
        var key = location.hostname + '|' + query.toLowerCase();
        if (awarded[key] || now - lastAward < 2500) return;
        awarded[key] = true;
        lastAward = now;
        send('search', { matches: count });
      },
      onEmpty: function () {
        if (pet && pet.visible) pet.say('Nothing here. Sorry.', 2000);
      },
      onClose: function () {
        if (activity) activity.setOverride(null);
        if (pet && pet.visible) pet.returnToFloor();
      }
    });

    if (RKChatter) {
      chatter = RKChatter.create({
        say: function (t, ms) { if (pet && pet.visible) pet.say(t, ms); },
        enabled: function () { return !!(view && view.settings.chatter !== false); },
        bond: function () {
          var host = location.hostname.replace(/^www\./, '');
          return view && view.memory && view.memory.sites
            ? view.memory.sites[host] : null;
        }
      });
      chatter.greet();
      log('page looks like:', chatter.kind(), chatter.facts());
    }

    if (RKTools) {
      tools = RKTools.create({
        root: layer, api: api, pet: pet,
        onSnip: function () { send('tool'); },
        onTool: function () { send('tool'); },
        clipboardEnabled: function () {
          return !!(view && view.settings.clipboardHistory !== false);
        }
      });
    }

    if (RKTreats) {
      jar = RKTreats.create({
        root: layer, pet: pet,
        onReach: function (rect) { pet.excite(rect); },
        onFeed: function () { send('feed'); },
        onEmpty: function () {
          pet.say(L.get('treats.empty'), 3400);
        }
      });
    }

    if (RKMischief) {
      mischief = RKMischief.create({
        root: layer,
        pet: pet,
        sound: sound,
        onDark: function (dark) {
          layer.classList.toggle('on-dark', dark ? true : detectTheme());
          log('lights', dark ? 'off' : 'on');
        },
        enabled: function () { return !!(view && view.settings.mischief); },
        onSteal: function () { send('mischief'); }
      });
      setInterval(function () { mischief.tick(); }, 2000);
    }

    if (RKBrain) {
      brain = RKBrain.create({
        pet: pet,
        log: log,
        view: function () { return view; },
        onInspect: function () { send('inspected'); },
        doMischief: function () {
          if (!view || !view.settings.mischief || !mischief) return false;
          return mischief.act();
        },
        doBeg: function () {
          if (!jar || !view || view.treats <= 0) return false;
          if (Date.now() - lastBeg < 90000) return false;
          if (!pet.beg(jar.rect(), function () { jar.wobble(); })) return false;
          lastBeg = Date.now();
          if (sound) sound.play('tick');
          return true;
        },
        root: function () { return layer; },
        sound: function () { return sound; },
        doChatter: function () { return !!(chatter && chatter.maybeSay()); },
        hasJar: function () { return !!(jar && view && view.settings.showJar !== false); },
        doJarPoke: function () {
          if (!jar) return false;
          return pet.beg(jar.rect(), function () {
            jar.wobble();
            if (sound) sound.play('tick');
          }, L.get('treats.rattle'));
        },

      });
      log('brain online, time band:', brain.timeBand());
    }

    if (RKActivity) {
      activity = RKActivity.create({
        pageKind: function () { return chatter ? chatter.kind() : null; },
        onChange: function (kind, anchor, was) {
          log('activity:', was, '->', kind);
          if (!pet || !pet.visible) return;
          pet.setActivity(kind, anchor);
          if (kind !== 'idle' && sound) sound.play('tick');
        },
        onAnchor: function (kind, anchor) {
          // The video or text box may have moved; shuffle along with it.
          if (pet && pet.visible && pet.mode === 'roam' && !pet.target) {
            pet.perch(anchor);
          }
        }
      });
    }

    // Arriving somewhere builds a bond with the site over repeat visits.
    send('visit', { host: location.hostname.replace(/^www\./, '') });

    send('get');

    api.runtime.onMessage.addListener(function (msg) {
      if (!msg) return;
      if (msg.type === 'RK_STATE') applyState(msg.state, msg.event);
      if (msg.type === 'RK_MENU') { runMenuAction(msg.id); return; }
      if (msg.type === 'RK_NUDGE') { showNudge(msg); return; }
      if (msg.type === 'RK_COMMAND') {
        if (msg.command === 'toggle-search') openFinder();
        if (msg.command === 'toggle-pet') togglePet();
      }
    });
  }

  // ---- timer badge ---------------------------------------------------------

  var badgeEl = null;
  var badgeTick = null;

  function renderBadge() {
    if (!view) return;
    var left = view.timerLeft || 0;
    if (!left) {
      if (badgeEl) badgeEl.classList.remove('open');
      if (badgeTick) { clearInterval(badgeTick); badgeTick = null; }
      return;
    }
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.className = 'badge';
      badgeEl.title = 'Click to stop the timer';
      badgeEl.addEventListener('click', function () { send('stopTimer'); });
      layer.appendChild(badgeEl);
    }
    badgeEl.classList.add('open');
    paintBadge();
    if (!badgeTick) {
      badgeTick = setInterval(function () {
        if (!view || !view.timerLeft) { renderBadge(); return; }
        view.timerLeft = Math.max(0, view.timerLeft - 1);
        paintBadge();
        if (view.timerLeft === 0) send('get');
      }, 1000);
    }
  }

  function paintBadge() {
    var left = view.timerLeft || 0;
    var m = Math.floor(left / 60);
    var sec = Math.floor(left % 60);
    badgeEl.textContent = '';
    var phase = document.createElement('span');
    phase.className = 'badge-phase';
    phase.textContent = view.timerPhase === 'rest' ? 'BREAK' : 'FOCUS';
    var clock = document.createElement('span');
    clock.className = 'badge-clock';
    clock.textContent = m + ':' + (sec < 10 ? '0' : '') + sec;
    badgeEl.appendChild(phase);
    badgeEl.appendChild(clock);
    badgeEl.classList.toggle('rest', view.timerPhase === 'rest');
  }

  // ---- the burrow: stashed pages and clipboard history --------------------

  var burrowEl = null;
  var burrowTab = 'stash';

  function buildBurrow() {
    burrowEl = document.createElement('div');
    burrowEl.className = 'burrow';
    layer.appendChild(burrowEl);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burrowEl.classList.contains('open')) closeBurrow();
    });
  }

  function closeBurrow() { if (burrowEl) burrowEl.classList.remove('open'); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function openBurrow(tab) {
    if (!burrowEl) buildBurrow();
    if (tab) burrowTab = tab;
    burrowEl.textContent = '';

    var head = el('div', 'burrow-head');
    var tabs = el('div', 'burrow-tabs');
    [['stash', 'Buried', (view && view.stash || []).length],
     ['clips', 'Copied', (view && view.clips || []).length]].forEach(function (t) {
      var b = el('button', 'burrow-tab', t[1] + ' (' + t[2] + ')');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(burrowTab === t[0]));
      b.addEventListener('click', function () { openBurrow(t[0]); });
      tabs.appendChild(b);
    });
    var x = el('button', 'burrow-x', '\u00d7');
    x.type = 'button';
    x.title = 'Close';
    x.addEventListener('click', closeBurrow);
    head.appendChild(tabs);
    head.appendChild(x);
    burrowEl.appendChild(head);

    var list = el('ul', 'burrow-list');
    var items = burrowTab === 'stash' ? (view && view.stash || []) : (view && view.clips || []);

    if (!items.length) {
      burrowEl.appendChild(el('p', 'burrow-empty', burrowTab === 'stash'
        ? 'Nothing buried yet. Use "Bury this for later".'
        : 'Nothing copied yet. Copy some text on any page.'));
    } else {
      items.forEach(function (item) {
        var li = el('li');
        var main = el('button', 'burrow-item');
        main.type = 'button';
        main.appendChild(el('span', 'burrow-title',
          burrowTab === 'stash' ? (item.title || item.url) : item.text));
        main.appendChild(el('span', 'burrow-sub',
          burrowTab === 'stash'
            ? (item.note || hostOf(item.url))
            : (item.title || hostOf(item.url))));
        main.addEventListener('click', function () {
          if (burrowTab === 'stash') {
            window.open(item.url, '_blank', 'noreferrer');
          } else {
            tools.copyText(item.text).then(function (ok) {
              pet.say(L.get(ok ? 'tools.copiedAgain' : 'tools.noClipboard'), 2200);
              if (ok) pet.puff('sparkle', 4);
            });
            closeBurrow();
          }
        });
        var drop = el('button', 'burrow-drop', '\u00d7');
        drop.type = 'button';
        drop.title = 'Remove';
        drop.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (burrowTab === 'stash') send('unstash', { url: item.url });
          else send('forgetClip', { text: item.text });
          setTimeout(function () { openBurrow(); }, 120);
        });
        li.appendChild(main);
        li.appendChild(drop);
        list.appendChild(li);
      });
      burrowEl.appendChild(list);
    }

    burrowEl.classList.add('open');
  }

  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
  }

  // ---- context menu (long press / right click on the pet) -----------------

  var menuEl = null;

  function buildMenu() {
    menuEl = document.createElement('div');
    menuEl.className = 'menu';
    // Keep the page selection alive while the menu is interacted with.
    menuEl.addEventListener('mousedown', function (e) { e.preventDefault(); });
    menuEl.setAttribute('role', 'menu');
    layer.appendChild(menuEl);

    document.addEventListener('pointerdown', function (e) {
      if (!menuEl.classList.contains('open')) return;
      if (e.composedPath && e.composedPath().indexOf(menuEl) !== -1) return;
      closeMenu();
    }, true);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuEl.classList.contains('open')) closeMenu();
    });
  }

  function closeMenu() {
    if (menuEl) menuEl.classList.remove('open');
  }

  var MISCHIEF_MENU = [
    ['tilt', 'Tilt something', 'rotate'],
    ['flip', 'Flip a picture', 'mirror'],
    ['topple', 'Topple something', 'nudge'],
    ['scramble', 'Scramble a word', 'letters'],
    ['word', 'Pinch a word', 'carry'],
    ['image', 'Pinch a picture', 'carry'],
    ['wheelbarrow', 'Wheelbarrow it away', 'scene'],
    ['roadworks', 'Roadworks', 'scene'],
    ['shelfdrop', 'Drop the letters', 'scene'],
    ['lamp', 'Play with the lamp', 'scene'],
    ['robbery', 'Rob the place', 'scene']
  ];

  function mischiefItems() {
    var off = !view || !view.settings.mischief || !mischief;
    var items = MISCHIEF_MENU.map(function (t) {
      return {
        label: t[1], key: t[2], disabled: off,
        run: function () {
          if (!mischief.run(t[0])) pet.say(L.get('menu.nothingHere'), 2200);
        }
      };
    });
    items.push({ sep: true });
    items.push({ label: L.get('labels.surprise'), key: 'any',
      disabled: off,
      run: function () { if (mischief && !mischief.act(true)) pet.say(L.get('menu.nothingDoing'), 1800); } });
    items.push({ label: L.get('labels.back'), run: function () { openMenu(lastMenuAt.x, lastMenuAt.y); } });
    return items;
  }

  function menuItems() {
    var holding = mischief ? mischief.holding() : 0;
    var hasSel = tools && tools.hasSelection();
    return [
      { label: L.get('labels.feed'), key: view ? view.treats + ' left' : '',
        disabled: !view || view.treats <= 0,
        run: function () { send('feed'); } },
      { sep: true },
      { label: L.get('labels.find'), key: 'Ctrl+Shift+F', run: openFinder },
      { label: L.get('labels.snip'), key: 'png',
        disabled: !tools,
        run: function () { tools.snipArea(); } },
      { label: L.get('labels.linkTo'), key: hasSel ? 'copy' : 'select first',
        disabled: !tools || !hasSel,
        run: function () { tools.linkToSelection(); send('tool'); } },
      { label: L.get('labels.quote'), key: hasSel ? 'copy' : '',
        disabled: !tools || !hasSel,
        run: function () { tools.quoteSelection(); send('tool'); } },
      { label: L.get(tools && tools.isReading() ? 'labels.readerOff' : 'labels.reader'),
        key: 'hide clutter',
        disabled: !tools,
        run: function () { tools.toggleReader(); } },
      { label: L.get('labels.bury'), key: 'stash',
        disabled: !tools,
        run: function () { tools.stashPage(); } },
      { label: L.get('labels.burrow'),
        key: ((view && view.stash || []).length + (view && view.clips || []).length) || '',
        run: function () { openBurrow('stash'); } },
      { label: L.get('labels.pageLength'),
        disabled: !tools,
        run: function () { tools.pageFacts(); } },
      { sep: true },
      { label: 'Go steal something', key: 'mischief',
        disabled: !view || !view.settings.mischief || !mischief,
        run: function () {
          if (mischief && !mischief.act(true)) pet.say(L.get('menu.nothingWorth'), 2000);
        } },
      { label: L.get('labels.mischief'), key: String(MISCHIEF_MENU.length),
        disabled: !view || !view.settings.mischief || !mischief,
        run: function () { openMenu(lastMenuAt.x, lastMenuAt.y, 'mischief'); } },
      { label: L.get('labels.zoomies'), key: 'wheee',
        run: function () { pet.zoomies(); } },
      { label: L.get('labels.putBack'), key: holding ? String(holding) : '',
        disabled: !holding,
        run: function () { if (mischief) mischief.returnAll(); } },
      { sep: true },
      { label: L.get(view && view.asleep ? 'labels.wake' : 'labels.nap'),
        run: function () { send(view && view.asleep ? 'wake' : 'nap'); } },
      { label: L.get(view && view.timerLeft ? 'labels.stopTimer' : 'labels.pomodoro'),
        key: view && view.timerLeft
          ? Math.ceil(view.timerLeft / 60) + 'm ' + view.timerPhase
          : (view ? view.settings.pomodoro.work + 'm' : ''),
        run: function () {
          send(view && view.timerLeft ? 'stopTimer' : 'startTimer', { phase: 'work' });
        } },
      { label: L.get('labels.leaveAlone'), key: '3 min',
        run: function () { pet.shoo(); } }
    ];
  }

  var lastMenuAt = { x: 0, y: 0 };

  function openMenu(x, y, page) {
    if (!menuEl) buildMenu();
    lastMenuAt = { x: x, y: y };
    // Focusing a menu button collapses the page selection, so grab it first.
    if (tools) tools.captureSelection();
    menuEl.textContent = '';
    (page === 'mischief' ? mischiefItems() : menuItems()).forEach(function (item) {
      if (item.sep) {
        var hr = document.createElement('div');
        hr.className = 'sep';
        menuEl.appendChild(hr);
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      var label = document.createElement('span');
      label.textContent = item.label;
      var key = document.createElement('span');
      key.className = 'k';
      key.textContent = item.key || '';
      b.appendChild(label);
      b.appendChild(key);
      if (item.disabled) b.disabled = true;
      else b.addEventListener('click', function () { closeMenu(); item.run(); });
      menuEl.appendChild(b);
    });

    menuEl.classList.add('open');
    var w = menuEl.offsetWidth || 160;
    var h = menuEl.offsetHeight || 200;
    menuEl.style.left = Math.max(8, Math.min(x - w / 2, window.innerWidth - w - 8)) + 'px';
    menuEl.style.top = (y - h - 10 < 8 ? y + 70 : y - h - 10) + 'px';
    var first = menuEl.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }

  // ---- actions shared by the pet menu and the native right-click menu ------

  var MENU_ACTIONS = {
    'rk-find': function () { openFinder(); },
    'rk-snip': function () { if (tools) tools.snipArea(); },
    'rk-reader': function () { if (tools) tools.toggleReader(); },
    'rk-link': function () { if (tools) { tools.captureSelection(); tools.linkToSelection(); send('tool'); } },
    'rk-quote': function () { if (tools) { tools.captureSelection(); tools.quoteSelection(); send('tool'); } },
    'rk-stash': function () { if (tools) { tools.captureSelection(); tools.stashPage(); } },
    'rk-burrow': function () { openBurrow('stash'); },
    'rk-feed': function () { send('feed'); },
    'rk-pomodoro': function () { send('startTimer', { phase: 'work' }); },
    'rk-call': function () { comeHere(); }
  };

  function runMenuAction(id) {
    var fn = MENU_ACTIONS[id];
    if (fn) fn();
  }

  /** Summon the pet to the middle of the screen — it is meant to be hard to catch. */
  function comeHere() {
    if (!pet) return;
    send('comeBack');
    if (!pet.visible) pet.show();
    pet.summon();
  }

  // ---- nudges: water, movement, pomodoro -----------------------------------

  function showNudge(msg) {
    if (!pet) return;
    if (sound) sound.play(msg.sound || 'nudge');
    if (!pet.visible) {
      // Nothing on screen to speak, so use a system notification instead.
      send('notify', { title: 'Ruckus', text: msg.text });
      return;
    }
    pet.summon();
    pet.say(msg.text, 7000);
    pet.puff(msg.kind === 'water' ? 'sweat' : 'sparkle', 6);
  }

  function selectionSeed() {
    var s = String(window.getSelection() || '').trim();
    return (s && s.length < 80 && s.indexOf('\n') === -1) ? s : '';
  }

  // Ctrl+Shift+F reaches us twice: once from our own keydown listener and once
  // from the browser's commands API. Collapse anything inside 400ms.
  var lastToggle = 0;

  function openFinder() {
    var now = Date.now();
    if (now - lastToggle < 400) return;
    lastToggle = now;
    if (finder.isOpen()) finder.close();
    else finder.open(selectionSeed());
  }

  function togglePet() {
    if (!view) return;
    if (pet.visible) {
      pet.hide();
      send('settings', { settings: { enabled: false } });
    } else {
      send('settings', { settings: { enabled: true } }).then(function () { pet.show(); });
    }
  }

  // ---- hotkeys -------------------------------------------------------------------

  window.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    var k = e.key.toLowerCase();

    if (k === 'f' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      openFinder();
      return;
    }
    if (k === 'f' && !e.shiftKey && view && view.settings.hijackCtrlF) {
      var t = e.target;
      var tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      e.preventDefault();
      e.stopPropagation();
      openFinder();
    }
  }, true);

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && finder && finder.isOpen()) finder.close();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeBoot, { once: true });
  } else {
    safeBoot();
  }

  function safeBoot() {
    try {
      boot();
      console.info('[Ruckus] awake on ' + location.host +
        ' \u2014 __ruckus.debug(true) for verbose logs');
      if (debugOn) dumpState();
      globalThis.__ruckus = {
        pet: pet, finder: finder,
        state: function () { return view; },
        debug: setDebug,
        dump: dumpState,
        status: function () { return particles && particles.status(); },
        sounds: function () { return sound && sound.packStatus(); },
        play: function (n) { return sound && sound.play(n); },
        soundEnabled: function () { return !!(sound && sound.isEnabled()); },
        chatter: function () { return chatter && chatter.facts(); },
        brain: function () { return brain && brain.decide(); },
        weights: function () { return brain && brain.weights(); },
        act: function () { return brain && brain.act(); },
        activity: function () { return activity && activity.kind(); },
        show: function () { pet.show(); },
        find: function (q) { finder.open(q); },
        steal: function () { return mischief && mischief.act(true); },
        zoomies: function () { return pet && pet.zoomies(); },
        beg: function () { return jar && pet.beg(jar.rect(), function () { jar.wobble(); }); },
        snip: function () { return tools && tools.snipArea(); },
        tools: function () { return tools; },
        giveBack: function () { return mischief && mischief.returnAll(); },
        menu: function () { openMenu(pet.x + pet.size / 2, pet.y); },
        burrow: function () { openBurrow('stash'); },
        where: function () {
          return { x: pet.x, y: pet.y, visible: pet.visible, anim: pet.anim,
                   attached: host.isConnected, viewport: [innerWidth, innerHeight] };
        }
      };
    } catch (e) {
      bootError = String((e && e.message) || e);
      console.error('[Ruckus] failed to start:', e);
    }
  }
})();
