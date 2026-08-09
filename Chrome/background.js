/* Ruckus — background. Single source of truth for the pet.
   Content scripts and the popup never write storage directly; they ask here. */
'use strict';

var api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

var KEY = 'ruckusState';
var LEGACY_KEY = 'petPixelState';   // pre-rename installs
var PET_NAME = 'Ruckus';

// Drift rates come from core/config.js, which is loaded alongside this script
// (Firefox: background.scripts; Chrome: importScripts below). The fallback is
// only for environments where neither is available.
try {
  if (typeof RKConfig === 'undefined' && typeof importScripts === 'function') {
    importScripts('core/config.js');
  }
} catch (_) {}

var D = (typeof RKConfig !== 'undefined' && RKConfig.drift) || {
  hungerPerHour: 30, happinessPerHour: 20,
  energyAwakePerHour: 26, energyAsleepPerHour: 90,
  curiosityPerHour: 70, mischiefPerHour: 60,
  sleepBelow: 14, wakeAbove: 78, awayHours: 8
};

var EFFORT = (typeof RKConfig !== 'undefined' && RKConfig.effort) || {
  mischiefEnergy: 4, inspectEnergy: 1.5, patHappiness: 5,
  feedHunger: 28, treatCap: 20
};
var MINUTE = 60000;
var HOUR = 3600000;

var DEFAULT_SITE_RULES = [
  'mail.google.com',
  'calendar.google.com',
  'outlook.',
  'bank',
  'paypal.',
  'meet.google.com',
  'zoom.us',
  'teams.microsoft.com'
];

function defaultState() {
  var now = Date.now();
  return {
    version: 1,
    name: PET_NAME,
    born: now,
    xp: 0,
    level: 1,
    hunger: 80,      // 100 = full
    happiness: 80,
    energy: 90,
    treats: 8,
    asleep: false,
    lastTick: now,
    lastPat: 0,
    lastTreatGrant: now,
    searches: 0,
    wordsFound: 0,
    sulkUntil: 0,
    pos: { xr: 0.15, yr: 0.9 },
    stash: [],
    // Internal drives. These push behaviour rather than just describing it.
    needs: { curiosity: 55, mischiefUrge: 35, confidence: 15 },
    // What it remembers about you.
    memory: {
      pats: 0, feeds: 0, shoos: 0, steals: 0, snips: 0,
      fedToday: 0, dayKey: '', lastFedAt: 0, lastPatAt: 0,
      longestVisitMs: 0, sites: {}
    },
    clips: [],
    timer: null,   // { phase: 'work'|'rest', endsAt, round }
    settings: {
      enabled: true,
      hijackCtrlF: false,
      reduceMotion: false,
      mischief: true,
      showJar: true,
      clipboardHistory: true,
      sound: true,
      particles: true,
      theme: 'auto',   // auto | light | dark
      chatter: true,
      debug: false,
      volume: 0.25,
      water: { on: true, every: 45 },
      move: { on: true, every: 60 },
      pomodoro: { work: 25, rest: 5 },
      species: 'ruckus',
      color: null,
      scale: 3,
      shooMinutes: 3,
      quietSites: DEFAULT_SITE_RULES.slice(),
      mutedSites: []
    }
  };
}

var cache = null;
var saveTimer = null;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function dayKey(t) {
  var d = new Date(t || Date.now());
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function rollDay(s) {
  var today = dayKey();
  if (s.memory.dayKey !== today) {
    s.memory.dayKey = today;
    s.memory.fedToday = 0;
  }
}

function totalXpForLevel(level) {
  var l = level - 1;
  return 20 * l + 6 * l * l;
}

function levelForXp(xp) {
  var lvl = 1;
  while (totalXpForLevel(lvl + 1) <= xp && lvl < 99) lvl++;
  return lvl;
}

/* Looks are not earned and not staged. One pet, one body, pick a colour. */

function load() {
  if (cache) return Promise.resolve(cache);
  return api.storage.local.get([KEY, LEGACY_KEY]).then(function (res) {
    var s = res && res[KEY];
    // Installed before the rename? Adopt the old state rather than starting over.
    if (!s && res && res[LEGACY_KEY]) {
      s = res[LEGACY_KEY];
      api.storage.local.remove(LEGACY_KEY).catch(function () {});
    }
    if (!s || s.version !== 1) s = defaultState();
    // Backfill any settings added in later versions.
    var d = defaultState();
    s.settings = Object.assign({}, d.settings, s.settings || {});
    // Early builds sulked for 15 minutes, which was far too long to be fun.
    if (s.settings.shooMinutes > 5) s.settings.shooMinutes = d.settings.shooMinutes;
    // Older builds hid the pet entirely when shooed; now it just sulks in view.
    if (s.hiddenUntil != null) { s.sulkUntil = 0; delete s.hiddenUntil; }
    if (s.sulkUntil == null) s.sulkUntil = 0;
    if (!s.pos) s.pos = d.pos;
    if (!Array.isArray(s.stash)) s.stash = [];
    if (!Array.isArray(s.clips)) s.clips = [];
    if (!s.needs) s.needs = d.needs;
    if (!s.memory) s.memory = d.memory;
    if (!s.memory.sites) s.memory.sites = {};
    if (!s.settings.water) s.settings.water = d.settings.water;
    if (!s.settings.move) s.settings.move = d.settings.move;
    if (!s.settings.pomodoro) s.settings.pomodoro = d.settings.pomodoro;
    s.name = PET_NAME;
    cache = s;
    return cache;
  });
}

function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(function () {
    saveTimer = null;
    var obj = {};
    obj[KEY] = cache;
    api.storage.local.set(obj);
  }, 400);
}

/** Apply time-based decay. Called before every read. */
function tick(s) {
  var now = Date.now();
  var elapsed = now - (s.lastTick || now);
  if (elapsed < 1000) return s;
  var hours = elapsed / HOUR;

  if (hours > D.awayHours) {
    // You were away. The pet slept through it rather than slowly starving —
    // it should be pleased to see you, not on its deathbed.
    var capped = Math.min(hours, 14);
    s.hunger = clamp(s.hunger - capped * 4.2, 18, 100);
    s.happiness = clamp(s.happiness - capped * 1.8, 25, 100);
    s.energy = 100;
    s.asleep = false;
  } else {
    // Rates live in core/config.js so they are tunable in one place.
    s.hunger = clamp(s.hunger - hours * D.hungerPerHour, 0, 100);
    s.happiness = clamp(s.happiness - hours * D.happinessPerHour, 0, 100);

    if (s.asleep) {
      s.energy = clamp(s.energy + hours * D.energyAsleepPerHour, 0, 100);
      if (s.energy > D.wakeAbove) s.asleep = false;
    } else {
      s.energy = clamp(s.energy - hours * D.energyAwakePerHour, 0, 100);
      if (s.energy < D.sleepBelow) s.asleep = true;
    }

    // A hungry pet gets glum faster.
    if (s.hunger < 20) s.happiness = clamp(s.happiness - hours * 4, 0, 100);
  }

  // Slow trickle of treats so the pet is never unrecoverable.
  var grants = Math.floor((now - (s.lastTreatGrant || now)) / (0.25 * HOUR));
  if (grants > 0 && s.treats < EFFORT.treatCap) {
    s.treats = clamp(s.treats + grants, 0, EFFORT.treatCap);
    s.lastTreatGrant = now;
  }

  // Drives drift. Curiosity and mischief build up when unspent; confidence
  // only ever moves through interaction, so it is not touched here.
  // These have to refill faster than they drain, or one prank puts the pet in
  // a coma for six hours. Roughly: a full tank every 90 minutes of browsing.
  s.needs.curiosity = clamp(s.needs.curiosity + hours * D.curiosityPerHour, 0, 100);
  s.needs.mischiefUrge = clamp(s.needs.mischiefUrge + hours * D.mischiefPerHour, 0, 100);

  rollDay(s);
  s.lastTick = now;
  return s;
}

function decorate(s) {
  var view = Object.assign({}, s);
  view.stage = 0;   // kept for older callers; the species decides the look now
  view.xpInLevel = s.xp - totalXpForLevel(s.level);
  view.xpForNext = totalXpForLevel(s.level + 1) - totalXpForLevel(s.level);
  view.speciesName = (s.settings.species || 'ruckus');
  view.name = PET_NAME;
  view.mood = moodOf(s);
  view.hour = new Date().getHours();
  if (s.timer) {
    view.timerLeft = Math.max(0, Math.ceil((s.timer.endsAt - Date.now()) / 1000));
    view.timerPhase = s.timer.phase;
    view.timerRound = s.timer.round;
  } else {
    view.timerLeft = 0;
    view.timerPhase = null;
  }
  view.sulkMinutes = s.sulkUntil > Date.now()
    ? Math.max(1, Math.ceil((s.sulkUntil - Date.now()) / 60000))
    : 0;
  return view;
}

function moodOf(s) {
  if (s.asleep) return 'sleepy';
  if (Date.now() < s.sulkUntil) return 'sulking';
  if (s.hunger < 25) return 'hungry';
  if (s.happiness < 30) return 'glum';
  if (s.happiness > 75 && s.hunger > 60) return 'delighted';
  return 'content';
}

function addXp(s, amount) {
  s.xp += amount;
  var next = levelForXp(s.xp);
  var levelledUp = next > s.level;
  s.level = next;
  return { levelledUp: levelledUp, evolved: false };
}

function broadcast(view, event) {
  var msg = { type: 'RK_STATE', state: view, event: event || null };
  api.runtime.sendMessage(msg).catch(function () {});
  api.tabs.query({}).then(function (tabs) {
    tabs.forEach(function (t) {
      if (t.id != null) api.tabs.sendMessage(t.id, msg).catch(function () {});
    });
  }).catch(function () {});
}

// --- actions ----------------------------------------------------------

var ACTIONS = {
  get: function () { return {}; },

  pat: function (s) {
    var now = Date.now();
    if (now - s.lastPat < 45000) return { event: 'alreadyPatted' };
    s.lastPat = now;
    s.memory.pats += 1;
    s.memory.lastPatAt = now;
    s.needs.confidence = clamp(s.needs.confidence + 3, 0, 100);
    s.happiness = clamp(s.happiness + EFFORT.patHappiness, 0, 100);
    var r = addXp(s, 1);
    return { event: r.evolved ? 'evolved' : (r.levelledUp ? 'levelUp' : 'patted') };
  },

  feed: function (s) {
    if (s.treats <= 0) return { event: 'noTreats' };
    s.treats -= 1;
    rollDay(s);
    s.memory.feeds += 1;
    s.memory.fedToday += 1;
    s.memory.lastFedAt = Date.now();
    s.needs.confidence = clamp(s.needs.confidence + 2, 0, 100);
    s.hunger = clamp(s.hunger + EFFORT.feedHunger, 0, 100);
    s.happiness = clamp(s.happiness + 4, 0, 100);
    s.asleep = false;
    var r = addXp(s, 5);
    return { event: r.evolved ? 'evolved' : (r.levelledUp ? 'levelUp' : 'fed') };
  },

  mischief: function (s) {
    s.steals = (s.steals || 0) + 1;
    s.energy = clamp(s.energy - EFFORT.mischiefEnergy, 0, 100);
    s.memory.steals += 1;
    s.needs.mischiefUrge = clamp(s.needs.mischiefUrge - 30, 0, 100);
    if (s.steals % 2 === 0 && s.treats < EFFORT.treatCap) s.treats += 1;
    s.happiness = clamp(s.happiness + 2, 0, 100);
    s.energy = clamp(s.energy - EFFORT.inspectEnergy, 0, 100);
    addXp(s, 1);
    return { event: 'stole' };
  },

  tool: function (s) {
    // Using the pet as an actual tool earns its keep.
    if (s.treats < EFFORT.treatCap) s.treats += 1;
    s.happiness = clamp(s.happiness + 2, 0, 100);
    addXp(s, 2);
    return { event: 'helped' };
  },

  stash: function (s, payload) {
    var item = payload.item;
    if (!item || !item.url) return {};
    s.stash = s.stash.filter(function (x) { return x.url !== item.url; });
    s.stash.unshift(item);
    if (s.stash.length > 40) s.stash.length = 40;
    if (s.treats < EFFORT.treatCap) s.treats += 1;
    addXp(s, 2);
    return { event: 'stashed' };
  },

  clip: function (s, payload) {
    if (!s.settings.clipboardHistory) return { silent: true };
    var text = String(payload.text || '').slice(0, 600).trim();
    if (!text) return { silent: true };
    s.clips = (s.clips || []).filter(function (c) { return c.text !== text; });
    s.clips.unshift({
      text: text,
      title: String(payload.title || '').slice(0, 120),
      url: String(payload.url || '').slice(0, 400),
      at: Date.now()
    });
    if (s.clips.length > 30) s.clips.length = 30;
    return { silent: true };
  },

  forgetClip: function (s, payload) {
    s.clips = (s.clips || []).filter(function (c) { return c.text !== payload.text; });
    return { event: 'clipDropped' };
  },

  forgetClips: function (s) {
    s.clips = [];
    return { event: 'clipsCleared' };
  },

  unstash: function (s, payload) {
    s.stash = (s.stash || []).filter(function (x) { return x.url !== payload.url; });
    return { event: 'unstashed' };
  },

  /** Arriving somewhere. Builds a per-site bond over repeat visits. */
  visit: function (s, payload) {
    var host = String(payload.host || '').slice(0, 80);
    if (!host) return { silent: true };
    var site = s.memory.sites[host] || { visits: 0, bond: 0, first: Date.now() };
    site.visits += 1;
    site.bond = Math.min(100, site.bond + (site.visits < 10 ? 6 : 2));
    site.lastSeen = Date.now();
    s.memory.sites[host] = site;

    // Keep only the places actually worth remembering.
    var hosts = Object.keys(s.memory.sites);
    if (hosts.length > 60) {
      hosts.sort(function (a, b) {
        return s.memory.sites[a].lastSeen - s.memory.sites[b].lastSeen;
      });
      hosts.slice(0, hosts.length - 60).forEach(function (h) {
        delete s.memory.sites[h];
      });
    }
    return { silent: true };
  },

  /** Curiosity is spent by going and looking at something. */
  inspected: function (s) {
    s.energy = clamp(s.energy - EFFORT.inspectEnergy, 0, 100);
    if (s.memory.inspections == null) s.memory.inspections = 0;
    s.memory.inspections += 1;
    if (s.memory.inspections % 4 === 0 && s.treats < EFFORT.treatCap) s.treats += 1;
    s.needs.curiosity = clamp(s.needs.curiosity - 30, 0, 100);
    s.needs.confidence = clamp(s.needs.confidence + 0.5, 0, 100);
    addXp(s, 1);
    return { silent: true };
  },

  pos: function (s, payload) {
    if (typeof payload.xr === 'number' && typeof payload.yr === 'number') {
      s.pos = { xr: payload.xr, yr: payload.yr };
    }
    return { silent: true };
  },

  startTimer: function (s, payload) {
    var mins = Number(payload.minutes) ||
      (payload.phase === 'rest' ? s.settings.pomodoro.rest : s.settings.pomodoro.work);
    s.timer = {
      phase: payload.phase || 'work',
      endsAt: Date.now() + mins * MINUTE,
      round: (payload.phase === 'work' || !payload.phase)
        ? ((s.timer && s.timer.round) || 0) + 1
        : ((s.timer && s.timer.round) || 1)
    };
    scheduleTimer(s);
    return { event: 'timerStarted' };
  },

  stopTimer: function (s) {
    s.timer = null;
    if (api.alarms) api.alarms.clear('rk-timer');
    return { event: 'timerStopped' };
  },

  notify: function (s, payload) {
    if (api.notifications) {
      api.notifications.create({
        type: 'basic',
        iconUrl: api.runtime.getURL('icons/icon48.png'),
        title: String(payload.title || 'Ruckus'),
        message: String(payload.text || '')
      }).catch(function () {});
    }
    return { silent: true };
  },

  testNudge: function (s, payload) {
    var kind = payload.kind === 'move' ? 'move' : 'water';
    nudge(kind, kind === 'water' ? 'Water break. Go on.'
                                 : 'Stand up and stretch for a minute.', 'nudge');
    return { silent: true };
  },

  openTools: function () {
    api.tabs.create({ url: api.runtime.getURL('tools/tools.html') });
    return { silent: true };
  },

  nap: function (s) {
    s.asleep = true;
    return { event: 'napping' };
  },

  /** Playing is tiring, which is what makes the rest bar mean anything. */
  played: function (s, payload) {
    s.energy = clamp(s.energy - (Number(payload.effort) || 3), 0, 100);
    s.happiness = clamp(s.happiness + 2, 0, 100);
    return { silent: true };
  },

  wake: function (s) {
    s.asleep = false;
    s.energy = clamp(s.energy + 10, 0, 100);
    return { event: 'woke' };
  },

  search: function (s, payload) {
    s.searches += 1;
    var found = Math.max(0, payload.matches | 0);
    s.wordsFound += found > 0 ? 1 : 0;
    var gain = 2 + Math.min(5, found);
    if (s.treats < EFFORT.treatCap) s.treats += 1;
    s.energy = clamp(s.energy - 0.6, 0, 100);
    var r = addXp(s, gain);
    return { event: r.evolved ? 'evolved' : (r.levelledUp ? 'levelUp' : 'sniffed') };
  },

  shoo: function (s) {
    s.memory.shoos += 1;
    s.needs.confidence = clamp(s.needs.confidence - 6, 0, 100);
    s.happiness = clamp(s.happiness - 4, 0, 100);
    s.sulkUntil = Date.now() + (s.settings.shooMinutes || 3) * MINUTE;
    return { event: 'shooed' };
  },

  comeBack: function (s) {
    s.sulkUntil = 0;
    s.happiness = clamp(s.happiness + 3, 0, 100);
    return { event: 'returned' };
  },


  settings: function (s, payload) {
    s.settings = Object.assign({}, s.settings, payload.settings || {});
    scheduleReminders(s);
    return { event: 'settings' };
  },

  toggleMuteSite: function (s, payload) {
    var host = String(payload.host || '');
    if (!host) return {};
    var i = s.settings.mutedSites.indexOf(host);
    if (i >= 0) s.settings.mutedSites.splice(i, 1);
    else s.settings.mutedSites.push(host);
    return { event: 'settings' };
  },

  reset: function () {
    cache = defaultState();
    return { event: 'reset', replaced: true };
  }
};

function handle(msg) {
  return load().then(function (s) {
    tick(s);
    var fn = ACTIONS[msg.action];
    if (!fn) return { ok: false, error: 'unknown action' };
    var result = fn(s, msg.payload || {}) || {};
    if (result.replaced) s = cache;
    save();
    var view = decorate(s);
    if (msg.action !== 'get' && !result.silent) broadcast(view, result.event);
    return { ok: true, state: view, event: result.event || null };
  });
}

api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== 'RK_ACTION') return false;
  handle(msg).then(sendResponse, function (e) {
    sendResponse({ ok: false, error: String(e) });
  });
  return true; // async
});

// ---- nudges: water, movement, pomodoro ---------------------------------

function nudge(kind, text, sound) {
  api.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    return api.tabs.sendMessage(tab.id, {
      type: 'RK_NUDGE', kind: kind, text: text, sound: sound || 'nudge'
    });
  }).catch(function () {});
}

function scheduleTimer(s) {
  if (!api.alarms) return;
  api.alarms.clear('rk-timer');
  if (s.timer) {
    api.alarms.create('rk-timer', { when: s.timer.endsAt });
  }
}

function scheduleReminders(s) {
  if (!api.alarms) return;
  api.alarms.clear('rk-water');
  api.alarms.clear('rk-move');
  var w = s.settings.water, m = s.settings.move;
  // delayInMinutes as well as periodInMinutes, so the first one is predictable
  // instead of silently waiting a full period.
  if (w && w.on) {
    var wm = Math.max(1, w.every | 0);
    api.alarms.create('rk-water', { delayInMinutes: wm, periodInMinutes: wm });
  }
  if (m && m.on) {
    var mm = Math.max(1, m.every | 0);
    api.alarms.create('rk-move', { delayInMinutes: mm, periodInMinutes: mm });
  }
}

api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== 'RK_CAPTURE') return false;
  var opts = { format: 'png' };
  var p = sender && sender.tab && sender.tab.windowId != null
    ? api.tabs.captureVisibleTab(sender.tab.windowId, opts)
    : api.tabs.captureVisibleTab(opts);
  Promise.resolve(p).then(function (dataUrl) {
    sendResponse({ ok: true, dataUrl: dataUrl });
  }, function (e) {
    sendResponse({ ok: false, error: String((e && e.message) || e) });
  });
  return true;
});

if (api.commands && api.commands.onCommand) {
  api.commands.onCommand.addListener(function (command) {
    api.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      if (!tabs[0] || tabs[0].id == null) return;
      api.tabs.sendMessage(tabs[0].id, { type: 'RK_COMMAND', command: command })
        .catch(function () {});
    });
  });
}

if (api.alarms) {
  api.alarms.create('rk-tick', { periodInMinutes: 1 });
  api.alarms.onAlarm.addListener(function (a) {
    if (a.name === 'rk-water') {
      nudge('water', 'Water break. Go on.', 'nudge');
      return;
    }
    if (a.name === 'rk-move') {
      nudge('move', 'Stand up and stretch for a minute.', 'nudge');
      return;
    }
    if (a.name === 'rk-timer') {
      load().then(function (s) {
        if (!s.timer) return;
        var wasWork = s.timer.phase === 'work';
        var next = wasWork ? 'rest' : 'work';
        var mins = wasWork ? s.settings.pomodoro.rest : s.settings.pomodoro.work;
        s.timer = {
          phase: next,
          endsAt: Date.now() + mins * MINUTE,
          round: wasWork ? s.timer.round : s.timer.round + 1
        };
        scheduleTimer(s);
        save();
        nudge('pomodoro',
          wasWork ? 'Round done. Take ' + mins + ' minutes.'
                  : 'Break over. Back to it \u2014 ' + mins + ' minutes.',
          'done');
        broadcast(decorate(s), 'timerPhase');
      });
      return;
    }
    if (a.name !== 'rk-tick') return;
    load().then(function (s) {
      var before = { asleep: s.asleep, hungry: s.hunger < 25 };
      tick(s);
      save();
      if (before.asleep !== s.asleep || before.hungry !== (s.hunger < 25)) {
        broadcast(decorate(s), null);
      }
    });
  });
}

// ---- native right-click menu -------------------------------------------

var MENU = [
  ['rk-status', 'How is Ruckus?', ['page', 'selection', 'image']],
  ['rk-feed', 'Feed a treat', ['page', 'selection', 'image']],
  ['rk-pat', 'Give it a pat', ['page', 'selection', 'image']],
  ['rk-find', 'Find on page', ['page', 'selection']],
  ['rk-snip', 'Snip an area', ['page', 'selection', 'image']],
  ['rk-reader', 'Reader mode', ['page']],
  ['rk-link', 'Copy link to selection', ['selection']],
  ['rk-quote', 'Copy selection as quote', ['selection']],
  ['rk-stash', 'Bury this for later', ['page', 'selection']],
  ['rk-burrow', 'Open the burrow', ['page', 'selection', 'image']],
  ['rk-feed', 'Feed the pet', ['page']],
  ['rk-pomodoro', 'Start a pomodoro', ['page']],
  ['rk-call', 'Come here', ['page', 'selection', 'image']],
  ['rk-off-site', 'Turn off on this site', ['page', 'selection', 'image']],
  ['rk-off-all', 'Turn Ruckus off everywhere', ['page', 'selection', 'image']],
  ['rk-docs', 'Document tools\u2026', ['page', 'selection', 'image']]
];

function buildContextMenus() {
  if (!api.contextMenus) return;
  api.contextMenus.removeAll(function () {
    api.contextMenus.create({
      id: 'rk-root', title: 'Ruckus',
      contexts: ['page', 'selection', 'image']
    });
    MENU.forEach(function (m) {
      api.contextMenus.create({
        id: m[0], parentId: 'rk-root', title: m[1], contexts: m[2]
      });
    });
  });
}

if (api.contextMenus) {
  api.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === 'rk-off-site' || info.menuItemId === 'rk-off-all') {
      var host = '';
      try { host = new URL(info.pageUrl || '').hostname.replace(/^www\./, ''); } catch (_) {}
      handle({
        action: info.menuItemId === 'rk-off-all' ? 'settings' : 'toggleMuteSite',
        payload: info.menuItemId === 'rk-off-all'
          ? { settings: { enabled: false } } : { host: host }
      });
      return;
    }
    if (info.menuItemId === 'rk-docs') {
      api.tabs.create({ url: api.runtime.getURL('tools/tools.html') });
      return;
    }
    if (!tab || tab.id == null) return;
    api.tabs.sendMessage(tab.id, { type: 'RK_MENU', id: info.menuItemId })
      .catch(function () {});
  });
}

api.runtime.onInstalled.addListener(function () {
  load().then(function (s) { scheduleReminders(s); });
  buildContextMenus();
});

buildContextMenus();
load().then(function (s) { scheduleReminders(s); scheduleTimer(s); });
