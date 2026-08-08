/* Ruckus — chatter.
 * Reads the page shallowly (host, title, headings, counts) and says something
 * that fits. Nothing leaves the machine; it never sees page text beyond what it
 * needs to pick a line. */
(function (global) {
  'use strict';


  var L = global.RKLines;

  function createChatter(o) {
    var arrived = Date.now();
    var said = 0;
    var lastSaid = 0;
    var toldLong = false;
    var toldDeep = false;
    var facts = null;

    function host() { return location.hostname.replace(/^www\./, ''); }

    /** A rough guess at what kind of page this is. */
    function kindOf() {
      var h = host();
      var path = location.pathname;

      if (/youtube|vimeo|twitch|netflix|dailymotion/.test(h)) return 'video';
      if (/github|gitlab|stackoverflow|stackexchange|codepen|npmjs|developer\.mozilla/.test(h)) return 'code';
      if (/wikipedia|wikimedia|fandom|britannica/.test(h)) return 'reference';
      if (/twitter|x\.com|facebook|instagram|reddit|mastodon|bsky|tiktok|linkedin/.test(h)) return 'social';
      if (/docs\.google|notion|figma|office|sharepoint|overleaf/.test(h)) return 'docs';
      if (/amazon|ebay|aliexpress|etsy|alza|mall\.|heureka|shop/.test(h)) return 'shop';
      if (/^\/search/.test(path) || /google\.|duckduckgo|bing\.|ecosia/.test(h)) return 'search';

      if (document.querySelector('article, [itemprop="articleBody"], .article-body')) return 'news';
      if (document.querySelector('meta[property="og:type"][content="article"]')) return 'news';
      if (document.querySelector('input[type="password"]')) return 'quiet';
      return 'generic';
    }

    function measure() {
      if (facts) return facts;
      var words = 0;
      try {
        words = (document.body.innerText || '').trim().split(/\s+/).length;
      } catch (_) {}
      facts = {
        kind: kindOf(),
        words: words,
        minutes: Math.max(1, Math.round(words / 220)),
        title: (document.title || '').trim()
      };
      return facts;
    }

    function scrolledPercent() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      if (max < 200) return 0;
      return Math.round((window.scrollY / max) * 100);
    }

    function speak(text, ms) {
      said++;
      lastSaid = Date.now();
      o.say(text, ms || 4200);
    }

    /** Called occasionally from the pet's idle loop. */
    function maybeSay() {
      if (!o.enabled()) return false;
      var now = Date.now();
      if (now - lastSaid < 50000) return false;

      var f = measure();
      if (f.kind === 'quiet') return false;      // a login page; keep quiet

      // Something specific first, if there is anything specific to say.
      if (!toldLong && f.minutes >= 8 && now - arrived > 12000) {
        toldLong = true;
        speak(L.fill(L.get('page.longRead'), { min: f.minutes }), 5200);
        return true;
      }
      var pct = scrolledPercent();
      if (!toldDeep && pct >= 60) {
        toldDeep = true;
        speak(L.fill(L.get('page.deep'), { pct: pct }), 4200);
        return true;
      }
      if (now - arrived > 20 * 60000 && Math.random() < 0.4) {
        speak(L.get('page.stale'));
        return true;
      }

      if (Math.random() > 0.55) return false;
      speak(L.get('page.' + f.kind) || L.get('page.generic'));
      return true;
    }


    /** A one-off greeting shortly after landing on a page. */
    function greet() {
      if (!o.enabled()) return;
      var f = measure();
      if (f.kind === 'quiet') return;
      setTimeout(function () {
        if (said !== 0) return;
        var bond = o.bond ? o.bond() : null;
        if (bond && bond.visits > 15 && Math.random() < 0.6) {
          speak(L.get('page.familiar'));
        } else if (bond && bond.visits <= 1 && Math.random() < 0.5) {
          speak(L.get('page.firstTime'));
        } else if (f.kind !== 'generic') {
          speak(L.get('page.' + f.kind) || L.get('page.generic'));
        }
      }, 6000 + Math.random() * 6000);
    }

    return {
      maybeSay: maybeSay,
      greet: greet,
      kind: function () { return measure().kind; },
      facts: measure
    };
  }

  global.RKChatter = { create: createChatter };
})(typeof globalThis !== 'undefined' ? globalThis : window);
