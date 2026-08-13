/* Ruckus — popup. */
(function () {
  'use strict';

  var api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  var S = window.RKSprites;

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var el = {
    name: document.getElementById('name'),
    status: document.getElementById('status'),
    level: document.getElementById('levelLabel'),
    xp: document.getElementById('xpLabel'),
    xpFill: document.getElementById('xpFill'),
    treats: document.getElementById('treats'),
    feed: document.getElementById('feed'),
    pat: document.getElementById('pat'),
    wake: document.getElementById('wake'),
    wakeTop: document.getElementById('wakeTop'),
    wakeSub: document.getElementById('wakeSub'),
    helpToggle: document.getElementById('helpToggle'),
    tabs: Array.prototype.slice.call(document.querySelectorAll('.tab')),
    help: document.getElementById('help'),
    comeBack: document.getElementById('comeBack'),
    reset: document.getElementById('reset'),
    sEnabled: document.getElementById('s-enabled'),
    sHijack: document.getElementById('s-hijack'),
    sMotion: document.getElementById('s-motion'),
    sParticles: document.getElementById('s-particles'),
    sChatter: document.getElementById('s-chatter'),
    debugBtn: document.getElementById('debugBtn'),
    sMischief: document.getElementById('s-mischief'),
    sJar: document.getElementById('s-jar'),
    sClips: document.getElementById('s-clips'),
    sSound: document.getElementById('s-sound'),
    sWaterOn: document.getElementById('s-water-on'),
    sWater: document.getElementById('s-water'),
    sMoveOn: document.getElementById('s-move-on'),
    sMove: document.getElementById('s-move'),
    sWork: document.getElementById('s-work'),
    sRest: document.getElementById('s-rest'),
    timerRead: document.getElementById('timerRead'),
    timerBtn: document.getElementById('timerBtn'),
    openTools: document.getElementById('openTools'),
    chaos: document.getElementById('chaos'),
    chaosValue: document.getElementById('chaosValue'),
    offSite: document.getElementById('offSite'),
    offAll: document.getElementById('offAll'),
    forgetClips: document.getElementById('forgetClips'),
    sQuiet: document.getElementById('s-quiet'),
    grant: document.getElementById('grant'),
    grantText: document.getElementById('grantText'),
    grantBtn: document.getElementById('grantBtn'),
    stash: document.getElementById('stash'),
    stashList: document.getElementById('stashList'),
    stashToggle: document.getElementById('stashToggle'),
    swatches: document.getElementById('swatches'),
    testNudge: document.getElementById('testNudge'),
    diag: document.getElementById('diag'),
    diagBtn: document.getElementById('diagBtn'),
    reloadTab: document.getElementById('reloadTab')
  };

  var view = null;
  var anim = 'idle';
  var frame = 0;
  var timer = null;
  var overrideUntil = 0;

  var STATUS = {
    hungry: 'Rummaging for crumbs.',
    glum: 'Could use some attention.',
    sleepy: 'Out cold. Wake or wait.',
    sulking: 'Facing the wall in a corner.',
    delighted: 'Thrilled with everything.',
    content: 'Pottering about happily.'
  };

  // ---- rendering ---------------------------------------------------------


  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!view) return;
    S.drawFrame(ctx, 0, anim, frame,
      { scale: 12, color: view.settings.color, species: view.settings.species });
  }

  function startLoop() {
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if (overrideUntil && Date.now() > overrideUntil) {
        overrideUntil = 0;
        anim = restingAnim();
        frame = 0;
      }
      frame++;
      draw();
      if (view && view.timerLeft > 0) {
        view.timerLeft -= 0.2;
        if (view.timerLeft <= 0) send('get');
        else renderTimer(view);
      }
    }, 1000 / 5);
  }

  function restingAnim() {
    if (!view) return 'idle';
    if (view.asleep) return 'sleep';
    if (view.mood === 'delighted') return 'happy';
    if (view.mood === 'hungry' || view.mood === 'glum') return 'idle';
    return 'idle';
  }

  function playOnce(name, ms) {
    anim = name;
    frame = 0;
    overrideUntil = Date.now() + (ms || 1600);
    draw();
  }

  // ---- gauges -------------------------------------------------------------

  function paintGauge(id, value) {
    var fill = document.getElementById(id);
    var num = document.getElementById('n-' + id.replace('g-', ''));
    if (!fill) return;
    fill.style.width = Math.max(0, Math.min(100, value)) + '%';
    fill.classList.toggle('low', value < 30);
    fill.classList.toggle('mid', value >= 30 && value < 55);
    if (num) num.textContent = Math.round(value);
  }

  // ---- looks ---------------------------------------------------------------

  var looksBuilt = false;

  function buildLooks() {
    if (looksBuilt) return;
    looksBuilt = true;

    S.COLORS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = c.b;
      b.title = c.name;
      b.setAttribute('aria-label', c.name);
      b.dataset.color = c.id;
      b.addEventListener('click', function () {
        pushSettings({ color: c.id });
      });
      el.swatches.appendChild(b);
    });

  }

  function renderLooks(v) {
    buildLooks();
    var chosen = v.settings.color || 'amber';
    Array.prototype.forEach.call(el.swatches.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.color === chosen));
    });
  }

  function renderTimer(v) {
    var left = v.timerLeft || 0;
    if (!left) {
      el.timerRead.textContent = 'off';
      el.timerRead.className = 'timer-read idle';
      el.timerBtn.textContent = 'Start';
      return;
    }
    var m = Math.floor(left / 60), sec = left % 60;
    el.timerRead.textContent = (v.timerPhase === 'rest' ? 'break ' : 'work ') +
      m + ':' + (sec < 10 ? '0' : '') + sec +
      (v.timerRound ? '  \u00b7 round ' + v.timerRound : '');
    el.timerRead.className = 'timer-read ' + (v.timerPhase === 'rest' ? 'rest' : '');
    el.timerBtn.textContent = 'Stop';
  }

  function renderStash(items) {
    el.stash.hidden = !items.length;
    if (!items.length) return;
    el.stashToggle.textContent = el.stashList.hidden
      ? 'Show (' + items.length + ')' : 'Hide';
    if (el.stashList.hidden) return;

    el.stashList.textContent = '';
    items.forEach(function (item) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = item.title || item.url;
      a.title = (item.note ? item.note + '\n\n' : '') + item.url;
      var x = document.createElement('button');
      x.className = 'drop';
      x.textContent = '\u00d7';
      x.title = 'Remove';
      x.addEventListener('click', function () { send('unstash', { url: item.url }); });
      li.appendChild(a);
      li.appendChild(x);
      el.stashList.appendChild(li);
    });
  }

  // ---- state --------------------------------------------------------------

  function render(v) {
    view = v;
    el.status.textContent = STATUS[v.mood] || STATUS.content;
    // (overridden further down if the pet is off sulking)
    el.level.textContent = 'Lv ' + v.level;
    el.xp.textContent = v.xpInLevel + ' / ' + v.xpForNext;
    el.xpFill.style.width = Math.min(100, (v.xpInLevel / Math.max(1, v.xpForNext)) * 100) + '%';
    el.treats.textContent = v.treats;

    renderQuickOff(v);
    var lvl = v.settings.mischiefLevel == null ? 2 : v.settings.mischiefLevel;
    if (document.activeElement !== el.chaos) el.chaos.value = String(lvl);
    el.chaosValue.textContent = CHAOS_NAMES[lvl] || 'Normal';
    renderLooks(v);
    renderStash(v.stash || []);

    paintGauge('g-hunger', v.hunger);
    paintGauge('g-happiness', v.happiness);
    paintGauge('g-energy', v.energy);

    el.feed.disabled = v.treats <= 0;

    // The third key does whatever the pet currently needs.
    if (v.sulkMinutes > 0) {
      el.wake.dataset.mode = 'callback';
      el.wake.disabled = false;
      el.wake.classList.add('go');
      el.wakeTop.textContent = 'Make up';
      el.wakeSub.textContent = v.sulkMinutes + 'm left';
      el.status.textContent = 'Sulking in the corner. Click it on the page, or ' +
        'make up here.';
    } else {
      el.wake.dataset.mode = 'wake';
      el.wake.disabled = !v.asleep;
      el.wake.classList.remove('go');
      el.wakeTop.textContent = 'Wake';
      el.wakeSub.textContent = 'rouse';
    }

    el.sEnabled.checked = !!v.settings.enabled;
    el.sHijack.checked = !!v.settings.hijackCtrlF;
    el.sMotion.checked = !!v.settings.reduceMotion;
    el.sParticles.checked = v.settings.particles !== false;
    el.sChatter.checked = v.settings.chatter !== false;
    el.debugBtn.textContent = v.settings.debug ? 'Logs: on' : 'Verbose logs';
    el.sMischief.checked = !!v.settings.mischief;
    el.sJar.checked = v.settings.showJar !== false;
    el.sClips.checked = v.settings.clipboardHistory !== false;
    el.sSound.checked = v.settings.sound !== false;
    el.sWaterOn.checked = !!(v.settings.water && v.settings.water.on);
    el.sMoveOn.checked = !!(v.settings.move && v.settings.move.on);
    if (document.activeElement !== el.sWater) el.sWater.value = (v.settings.water || {}).every || 45;
    if (document.activeElement !== el.sMove) el.sMove.value = (v.settings.move || {}).every || 60;
    if (document.activeElement !== el.sWork) el.sWork.value = (v.settings.pomodoro || {}).work || 25;
    if (document.activeElement !== el.sRest) el.sRest.value = (v.settings.pomodoro || {}).rest || 5;
    renderTimer(v);
    if (document.activeElement !== el.sQuiet) {
      el.sQuiet.value = (v.settings.quietSites || []).join('\n');
    }

    if (!overrideUntil) anim = restingAnim();
    draw();
  }

  function send(action, payload) {
    return api.runtime
      .sendMessage({ type: 'RK_ACTION', action: action, payload: payload || {} })
      .then(function (res) {
        if (res && res.ok) render(res.state);
        return res;
      })
      .catch(function () {
        el.status.textContent = 'Lost the pet. Try reopening this popup.';
        return null;
      });
  }

  // ---- events --------------------------------------------------------------

  el.feed.addEventListener('click', function () {
    send('feed').then(function (res) {
      if (!res || !res.ok) return;
      if (res.event === 'noTreats') {
        el.status.textContent = 'No treats. Search a few pages to earn more.';
      } else {
        playOnce('eat', 1500);
      }
    });
  });

  el.pat.addEventListener('click', function () {
    send('pat').then(function (res) {
      if (res && res.event === 'alreadyPatted') {
        el.status.textContent = 'Already patted. Give it a minute.';
      } else {
        playOnce('happy', 1500);
      }
    });
  });

  el.wake.addEventListener('click', function () {
    if (el.wake.dataset.mode === 'callback') {
      send('comeBack').then(function () {
        playOnce('happy', 1500);
        el.status.textContent = 'Back. Reload the tab if you don\'t see it.';
      });
    } else {
      send('wake').then(function () { playOnce('startled', 1200); });
    }
  });


  el.stashToggle.addEventListener('click', function () {
    el.stashList.hidden = !el.stashList.hidden;
    el.stashToggle.setAttribute('aria-expanded', String(!el.stashList.hidden));
    if (view) renderStash(view.stash || []);
  });

  // ---- tabs -----------------------------------------------------------------
  // The pet and the toolkit are different things: one is a toy you poke, the
  // other is a panel you configure. Keeping them apart stops the popup being
  // one long undifferentiated scroll.

  var TAB_KEY = 'ruckusTab';

  function showTab(id) {
    el.tabs.forEach(function (t) {
      var on = t.id === id;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', String(on));
      var panel = document.getElementById(t.dataset.panel);
      if (panel) panel.classList.toggle('on', on);
    });
    try { localStorage.setItem(TAB_KEY, id); } catch (_) {}
  }

  el.tabs.forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.id); });
  });

  var savedTab = null;
  try { savedTab = localStorage.getItem(TAB_KEY); } catch (_) {}
  if (savedTab && document.getElementById(savedTab)) showTab(savedTab);

  el.helpToggle.addEventListener('click', function () {
    var open = el.help.hidden;
    el.help.hidden = !open;
    el.helpToggle.setAttribute('aria-expanded', String(open));
    el.helpToggle.textContent = open ? 'Hide help' : 'Help';
  });

  function pushSettings(patch) {
    send('settings', { settings: patch });
  }

  el.sEnabled.addEventListener('change', function () {
    pushSettings({ enabled: el.sEnabled.checked });
  });
  el.sHijack.addEventListener('change', function () {
    pushSettings({ hijackCtrlF: el.sHijack.checked });
  });
  el.sMotion.addEventListener('change', function () {
    pushSettings({ reduceMotion: el.sMotion.checked });
  });
  el.sParticles.addEventListener('change', function () {
    pushSettings({ particles: el.sParticles.checked });
  });
  el.sChatter.addEventListener('change', function () {
    pushSettings({ chatter: el.sChatter.checked });
  });
  el.testNudge.addEventListener('click', function () {
    send('testNudge', { kind: 'water' }).then(function () {
      el.testNudge.textContent = 'Sent \u2014 check the page';
      setTimeout(function () { el.testNudge.textContent = 'Test reminder'; }, 2600);
    });
  });
  el.debugBtn.addEventListener('click', function () {
    pushSettings({ debug: !(view && view.settings.debug) });
  });
  el.sMischief.addEventListener('change', function () {
    pushSettings({ mischief: el.sMischief.checked });
  });
  el.sJar.addEventListener('change', function () {
    pushSettings({ showJar: el.sJar.checked });
  });
  // ---- the two quick off switches ------------------------------------------

  function hostOfTab(tab) {
    try { return new URL(tab.url).hostname.replace(/^www\./, ''); }
    catch (_) { return ''; }
  }

  var CHAOS_NAMES = ['Quiet', 'Mild', 'Normal', 'Absolute ham'];

  function renderQuickOff(v) {
    var off = v.settings.enabled === false;
    el.offAll.setAttribute('aria-pressed', String(off));
    el.offAll.textContent = off ? 'Turn Ruckus on' : 'Turn Ruckus off';

    activeTab().then(function (tab) {
      var host = tab ? hostOfTab(tab) : '';
      var muted = host && (v.settings.mutedSites || []).indexOf(host) !== -1;
      el.offSite.disabled = !host;
      el.offSite.setAttribute('aria-pressed', String(!!muted));
      el.offSite.textContent = !host ? 'Off on this site'
        : muted ? 'On for ' + host : 'Off on ' + host;
      el.offSite.title = host ? host : 'No ordinary page in front';
    });
  }

  el.chaos.addEventListener('input', function () {
    el.chaosValue.textContent = CHAOS_NAMES[Number(el.chaos.value)] || 'Normal';
  });
  el.chaos.addEventListener('change', function () {
    pushSettings({ mischiefLevel: Number(el.chaos.value) });
  });

  el.offAll.addEventListener('click', function () {
    pushSettings({ enabled: !(view && view.settings.enabled === false) ? false : true });
  });

  el.offSite.addEventListener('click', function () {
    activeTab().then(function (tab) {
      var host = tab ? hostOfTab(tab) : '';
      if (host) send('toggleMuteSite', { host: host });
    });
  });

  el.openTools.addEventListener('click', function () {
    api.tabs.create({ url: api.runtime.getURL('tools/tools.html') });
    window.close();
  });

  el.timerBtn.addEventListener('click', function () {
    send(view && view.timerLeft ? 'stopTimer' : 'startTimer', { phase: 'work' });
  });

  function pushNested(key, patch) {
    var cur = (view && view.settings[key]) || {};
    var next = {};
    next[key] = Object.assign({}, cur, patch);
    pushSettings(next);
  }

  el.sSound.addEventListener('change', function () {
    pushSettings({ sound: el.sSound.checked });
  });
  el.sWaterOn.addEventListener('change', function () {
    pushNested('water', { on: el.sWaterOn.checked });
  });
  el.sWater.addEventListener('change', function () {
    pushNested('water', { every: Math.max(5, Number(el.sWater.value) || 45) });
  });
  el.sMoveOn.addEventListener('change', function () {
    pushNested('move', { on: el.sMoveOn.checked });
  });
  el.sMove.addEventListener('change', function () {
    pushNested('move', { every: Math.max(5, Number(el.sMove.value) || 60) });
  });
  el.sWork.addEventListener('change', function () {
    pushNested('pomodoro', { work: Math.max(5, Number(el.sWork.value) || 25) });
  });
  el.sRest.addEventListener('change', function () {
    pushNested('pomodoro', { rest: Math.max(1, Number(el.sRest.value) || 5) });
  });

  el.sClips.addEventListener('change', function () {
    pushSettings({ clipboardHistory: el.sClips.checked });
  });
  el.forgetClips.addEventListener('click', function () {
    send('forgetClips').then(function () {
      el.forgetClips.textContent = 'Forgotten';
      setTimeout(function () { el.forgetClips.textContent = 'Forget copied text'; }, 1800);
    });
  });
  el.sQuiet.addEventListener('change', function () {
    var lines = el.sQuiet.value.split('\n')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    pushSettings({ quietSites: lines });
  });

  el.comeBack.addEventListener('click', function () {
    send('comeBack').then(function () { playOnce('happy', 1400); });
  });

  el.reset.addEventListener('click', function () {
    if (el.reset.dataset.armed) {
      send('reset');
      delete el.reset.dataset.armed;
      el.reset.textContent = 'Start over';
    } else {
      el.reset.dataset.armed = '1';
      el.reset.textContent = 'Sure? Tap again';
      setTimeout(function () {
        delete el.reset.dataset.armed;
        el.reset.textContent = 'Start over';
      }, 4000);
    }
  });

  // --- is the content script actually there? ------------------------------
  // Asking permissions.contains() proved unreliable, so the source of truth is
  // whether the content script answers a ping.

  function activeTab() {
    return api.tabs.query({ active: true, currentWindow: true })
      .then(function (tabs) { return (tabs && tabs[0]) || null; })
      .catch(function () { return null; });
  }

  function ping(tab) {
    if (!tab || tab.id == null) {
      return Promise.resolve({ ok: false, reason: 'no active tab' });
    }
    var timeout = new Promise(function (r) {
      setTimeout(function () { r({ ok: false, reason: 'no reply in 1.5s' }); }, 1500);
    });
    var ask = api.tabs.sendMessage(tab.id, { type: 'RK_PING' })
      .then(function (res) { return res || { ok: false, reason: 'empty reply' }; })
      .catch(function (e) {
        return { ok: false, reason: String((e && e.message) || e) };
      });
    return Promise.race([ask, timeout]);
  }

  function isOrdinaryPage(url) {
    return !!url && /^(https?|file):/.test(url);
  }

  var lastTab = null;
  var MV = api.runtime.getManifest().manifest_version;

  function refreshAccess() {
    activeTab().then(function (tab) {
      lastTab = tab;
      var url = tab && tab.url;
      if (tab && !isOrdinaryPage(url)) {
        el.grant.hidden = false;
        el.grantBtn.hidden = true;
        el.grantText.textContent =
          'This is a browser page, not a website. Extensions are not allowed to ' +
          'run here. Open a normal site and reopen this popup.';
        return;
      }
      // One retry: the content script may still be booting.
      ping(tab).then(function (res) {
        if (res.ok) return res;
        return new Promise(function (r) { setTimeout(r, 700); }).then(function () {
          return ping(tab);
        });
      }).then(function (res) {
        if (res.ok) {
          el.grant.hidden = true;
          return;
        }
        el.grant.hidden = false;
        el.grantBtn.hidden = false;
        var mf = api.runtime.getManifest();
        el.grantText.textContent = MV === 2
          ? "Pixel isn't answering on this tab (" + res.reason + ").\n\n" +
            "1. Reload the tab \u2014 content scripts only inject on page load.\n" +
            "2. If that fails, remove Ruckus in about:debugging and load it " +
            "again. A previous copy with the same id blocks the new one.\n\n" +
            "This popup is running version " + mf.version + " \u2014 if that is " +
            "not the version you just loaded, the old copy is still installed."
          : "Pixel is not running on this tab (" + res.reason + "). Grant access, " +
            "then reload the tab.";
      });
    });
  }

  function configureGrantButton() {
    if (MV === 2) {
      el.grantBtn.textContent = 'Reload this tab';
      el.grantBtn.dataset.act = 'reload';
    } else {
      el.grantBtn.textContent = 'Let Pixel onto pages';
      el.grantBtn.dataset.act = 'grant';
    }
  }

  el.grantBtn.addEventListener('click', function () {
    if (el.grantBtn.dataset.act === 'reload') {
      activeTab().then(function (tab) {
        if (tab && tab.id != null) api.tabs.reload(tab.id);
        el.grantText.textContent = 'Reloading...';
        setTimeout(refreshAccess, 1500);
      });
      return;
    }
    api.permissions.request({ origins: ['<all_urls>'] })
      .then(function (granted) {
        el.grantText.textContent = granted
          ? 'Granted. Reload the tab, then reopen this popup to confirm.'
          : 'Declined. Grant it in about:addons under Permissions instead.';
        setTimeout(refreshAccess, 800);
      })
      .catch(function () {
        el.grantText.textContent = 'Open about:addons, find Ruckus, and turn ' +
          'on "Access your data for all websites".';
      });
  });

  el.reloadTab.addEventListener('click', function () {
    activeTab().then(function (tab) {
      if (tab && tab.id != null) api.tabs.reload(tab.id);
      setTimeout(refreshAccess, 1200);
    });
  });

  // --- diagnostics ---------------------------------------------------------

  function line(label, value, bad) {
    return (bad ? '! ' : '  ') + (label + ':').padEnd(16) + value;
  }

  el.diagBtn.addEventListener('click', function () {
    el.diag.hidden = false;
    el.diag.textContent = 'checking...';

    var mf = api.runtime.getManifest();
    var out = [
      line('extension', mf.name + ' ' + mf.version),
      line('manifest', 'v' + mf.manifest_version),
      line('browser', typeof browser !== 'undefined' ? 'firefox-style' : 'chrome-style')
    ];

    var perms = (api.permissions && api.permissions.getAll)
      ? api.permissions.getAll().catch(function () { return null; })
      : Promise.resolve(null);

    Promise.all([perms, activeTab()]).then(function (r) {
      var p = r[0], tab = r[1];
      if (p) {
        out.push(line('origins', (p.origins || []).join(' ') || '(none granted)',
          !(p.origins || []).length));
        out.push(line('api perms', (p.permissions || []).join(' ')));
      } else {
        out.push(line('origins', 'permissions API unavailable'));
      }
      out.push(line('tab', tab ? ('#' + tab.id + ' ' + (tab.url || '(url hidden)')) : 'none', !tab));
      out.push(line('page type', tab && isOrdinaryPage(tab.url) ? 'ordinary' : 'privileged/unknown',
        !(tab && isOrdinaryPage(tab.url))));

      return ping(tab).then(function (res) {
        out.push('');
        if (!res.ok) {
          out.push(line('content script', 'NOT RUNNING - ' + res.reason, true));
          out.push('');
          out.push('  Fix: grant site access above, then reload the tab.');
          out.push('  Or: about:addons > Ruckus > Permissions >');
          out.push('      "Access your data for all websites".');
        } else {
          out.push(line('content script', 'running on ' + res.host));
          out.push(line('booted', String(res.booted), !res.booted));
          out.push(line('overlay in DOM', String(res.hostAttached), !res.hostAttached));
          out.push(line('stylesheet', String(res.styleLoaded), !res.styleLoaded));
          out.push(line('got state', String(res.gotState), !res.gotState));
          out.push(line('should show', String(res.shouldShow), res.shouldShow === false));
          if (res.hiddenReason) out.push(line('hidden because', res.hiddenReason, true));
          out.push(line('holding loot', String(res.holding)));
          out.push(line('drives', String(res.needs)));
          out.push(line('last choice', String(res.lastChoice)));
          out.push(line('doing', String(res.activity) +
            (res.wearing && res.wearing !== 'nothing' ? ' (' + res.wearing + ')' : '')));
          out.push(line('page theme', res.onDark ? 'dark' : 'light'));
          out.push(line('particles', String(res.particles),
            String(res.particles).indexOf('MISSING') === 0));
          out.push(line('sulking', String(res.sulking) +
            (res.sulkMinutes ? ' (' + res.sulkMinutes + 'm left)' : '')));
          out.push(line('pet visible', String(res.petVisible), !res.petVisible));
          out.push(line('pet at', res.petAt + ' size ' + res.petSize));
          out.push(line('viewport', String(res.viewport)));
          out.push(line('stage/anim', res.petStage + ' / ' + res.petAnim));
          out.push(line('finder open', String(res.finderOpen)));
          out.push(line('highlight api', String(res.highlightAPI)));
          if (res.bootError) out.push(line('boot error', res.bootError, true));
        }
        el.diag.textContent = out.join('\n');
        console.log('[Ruckus] diagnostics\n' + out.join('\n'));
      });
    }).catch(function (e) {
      el.diag.textContent = out.join('\n') + '\n! diagnostics failed: ' + e;
    });
  });

  api.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === 'RK_STATE') render(msg.state);
  });

  // The stats drift continuously, so refresh while the popup is open.
  setInterval(function () { send('get'); }, 8000);

  /** The background may still be starting when the popup opens; the first
   *  get() can come back empty and leave every gauge and swatch unbuilt. */
  function loadState(attempt) {
    return send('get').then(function (res) {
      if (res && res.ok) return res;
      if ((attempt || 0) < 4) {
        return new Promise(function (r) { setTimeout(r, 250); })
          .then(function () { return loadState((attempt || 0) + 1); });
      }
      el.status.textContent = 'No answer from the background script.';
      return null;
    });
  }

  configureGrantButton();
  refreshAccess();
  // The content script may still be booting when the popup opens; check again.
  setTimeout(refreshAccess, 1800);
  loadState(0).then(startLoop);
})();
