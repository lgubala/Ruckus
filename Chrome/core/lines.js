/* Ruckus — EVERY line the pet says lives here. Nothing else contains text.
   Add, translate or replace freely; anything missing falls back gracefully. */
(function (global) {
  'use strict';

  var LINES = {

    // ---- moods, said while pottering about ----
    idle: {
      hungry:    ['My stomach is a 404.', 'Treat? Any treat.', 'I would eat a favicon.'],
      glum:      ['Been a bit quiet.', 'Pat me maybe.', 'I miss the good tabs.'],
      sleepy:    ['Five more minutes.', 'zzz', 'Screen too bright.'],
      delighted: ['Great tab.', 'This page smells nice.', 'Ready to sniff!'],
      content:   ['What are we reading?', 'Standing by.', 'I am supervising.']
    },

    // ---- thoughts, shown in the dotted bubble ----
    thought: {
      generic:   ['I wonder what that does.', 'Cosy page, this.', 'So many words.',
                  'Nobody is watching me.', 'I could nap here.'],
      morning:   ['Morning.', 'Slept well. Mostly.', 'Big day ahead?'],
      afternoon: ['Afternoon slump incoming.', 'Is it snack o\u2019clock?'],
      evening:   ['Getting dark out there.', 'One more page then.'],
      night:     ['You are still awake.', 'It is late, you know.', 'Sleep is free.']
    },

    // ---- genuinely useful things, said rarely ----
    tips: [
      'Ctrl+Shift+F is my search. Every one you do earns a treat.',
      'Right click anywhere for my menu \u2014 easier than catching me.',
      'Long press me for the same menu, plus the mischief list.',
      'Select some text and I can copy a link straight to it.',
      'Try "Bury this for later" \u2014 it all lands in my burrow.',
      'Anything you copy goes in my burrow too. Handy when you lose it.',
      'Double click me if I am in the way. I sulk, but only briefly.',
      'Snip an area gives you a PNG and puts it on your clipboard.',
      'Reader mode hides the clutter without changing the colours.',
      'Enter and Shift+Enter jump between search matches.',
      'Drag me somewhere if you want me out of the way.',
      'My treat jar takes drag and drop. Aim for my head.'
    ],

    // ---- break nudges ----
    breaks: ['Water. Go get some.', 'Look at something 6m away.',
             'Roll your shoulders back.', 'Stand up for a sec?'],

    // ---- the tools ----
    tools: {
      needSelection:  'Select some text first.',
      needQuote:      'Select something to quote.',
      linkCopied:     'Link copied. It jumps right to it.',
      quoteCopied:    'Quote copied with the source.',
      copiedAgain:    'Copied it again.',
      noClipboard:    "Couldn't reach the clipboard.",
      snipDone:       'Snipped. Saved and on your clipboard.',
      snipSaved:      'Snipped and saved.',
      snipEncodeFail: 'Snip failed while encoding.',
      snipDecodeFail: 'Snip failed while decoding.',
      snipHint:       'Drag to snip \u00b7 Esc to cancel',
      buried:         'Buried it. {n} in the stash.',
      buryFailed:     "Couldn't bury that.",
      noArticle:      "Can't find an article on this page.",
      readerOn:       'Reader mode. Menu again to put it back.',
      pageFacts:      '{words} words \u00b7 about {mins} min read'
    },

    // ---- menu labels ----
    labels: {
      feed:        'Feed a treat',
      find:        'Find on page',
      snip:        'Snip an area',
      linkTo:      'Link to selection',
      quote:       'Quote selection',
      reader:      'Reader mode',
      readerOff:   'Exit reader mode',
      bury:        'Bury this for later',
      burrow:      'Open the burrow',
      pageLength:  'How long is this page?',
      mischief:    'Mischief\u2026',
      zoomies:     'Do the zoomies',
      putBack:     'Put it all back',
      nap:         'Take a nap',
      wake:        'Wake up',
      pomodoro:    'Start a pomodoro',
      stopTimer:   'Stop the timer',
      leaveAlone:  'Leave me alone',
      back:        '\u2039 Back',
      surprise:    'Surprise me',
      comeHere:    'Come here'
    },

    // ---- the menu and its refusals ----
    menu: {
      nothingHere:   'Nothing here to do that with.',
      nothingWorth:  'Nothing worth taking.',
      nothingDoing:  'Nothing doing.',
      backLater:     'Back. Reload the tab if you don\u2019t see it.'
    },

    // ---- feeding milestones ----
    fed: {
      third:   'Third one today!',
      second:  'Second snack today.',
      nth:     '{ordinal} one today. Not that I count.',
      shameless:'{ordinal} today. I have no shame.',
      backAfterAWhile: 'You came back. And with food.'
    },

    pats: {
      milestone25:  'Twenty-fifth pat. I keep track.',
      milestone100: 'A hundred pats. We are basically family.',
      moreShoos:    'You shoo me more than you pat me, you know.',
      fondOfHere:   'Fine. I like it here anyway.'
    },

    // ---- the treat jar ----
    treats: {
      offered: ['Is that for me?', 'Yes. Yes please.', 'I have been very good.',
                'That one. That exact one.', 'Closer.'],
      asking:  ['Excuse me.', 'The jar is right here.', 'Just one?',
                'I am wasting away.', 'Look at me. Look.'],
      rattle:  ['*rattle*', 'Hear that? Empty-ish.', 'This jar opens, you know.'],
      empty:   ['Jar is empty. Search a page and I will refill it.']
    },

    // ---- reactions ----
    events: {
      fedFirst:  'My first ever treat. I will remember this.',
      fedAgain:  'Nom. Thanks.',
      patFirst:  'Oh. That was nice.',
      patted:    'Mrrp.',
      pattedFull:'Still full of pats.',
      levelUp:   'Level up!',
      noTreats:  'No treats left.',
      napping:   'Night.',
      returned:  'Alright, friends again.',
      stashed:   'Buried it.',
      shooed:    'Fine. Hmph.'
    },

    // ---- what it says about the page it is on ----
    page: {
      video:     ['Another one? Alright.', 'I like the loud bits.',
                  'Watch the whole thing this time.'],
      code:      ['Have you tried turning it off and on?',
                  'That indentation is a choice.', 'Commit before you break it.',
                  'Read the error. All of it.'],
      news:      ['Heavy stuff. Want a break after?', 'Check who wrote this.',
                  'Second source on that?'],
      shop:      ['Do you need it, or do you want it?',
                  'Sleep on it. It will still be there.', 'Check the delivery cost.'],
      social:    ['You said five minutes.', 'Nothing new since last time.',
                  'Scroll less, snack more.'],
      docs:      ['Actual work. Impressive.', 'Save it. Go on.'],
      reference: ['One more link and you are lost.', 'This is how the evening goes.'],
      search:    ['Try fewer words.', 'Page two never helps.'],
      generic:   ['What are we reading?', 'Anything good?'],
      familiar:  ['Here again.', 'Ah, this place.', 'You do like it here.'],
      firstTime: ['Somewhere new.', 'Not been here before.', "What's this place?"],
      longRead:  ['This is a long one. {min} minutes.',
                  '{min} minutes of reading here. Pace yourself.'],
      deep:      ['You are {pct}% down. Nearly there.', 'Still going. {pct}% in.'],
      stale:     ['We have been on this page a while.', 'Still here? Me too.']
    },

    // ---- what it does when settling in beside you ----
    activity: {
      typing:    'I am taking notes too.',
      watching:  'Move over, I brought snacks.',
      reading:   'Reading glasses on.',
      selecting: 'Shall I highlight that?',
      searching: 'On the scent.',
      music:     'This one is a banger.',
      shopping:  'Do you need it, though?',
      code:      'I will catch the bugs.',
      secure:    'Not looking. Promise.'
    },

    // ---- asking you about things ----
    ask: {
      button: ['What does this one do? Press it.', 'Go on. Press it. For science.',
               'I bet something happens.', 'This one looks important.'],
      photo:  ['Who is that?', 'What is this a picture of?',
               'I like this one. Explain it.'],
      word:   ['What does "{word}" mean?', '"{word}". Is that a real word?',
               'You lot and your long words. "{word}"?']
    },

    // ---- inspecting things, by element ----
    inspect: {
      IMG:    ['Who is that?', 'Nice picture.', 'I could take this.'],
      H1:     ['Big words.', 'Shouty, this bit.'],
      H2:     ['A heading. Riveting.'],
      BUTTON: ['What if I pressed it...', 'Tempting.'],
      A:      ['Where does this go?'],
      INPUT:  ['Type something. Go on.'],
      VIDEO:  ['Ooh, moving pictures.'],
      PRE:    ['Is that a bug in there?'],
      CODE:   ['Semicolon. Definitely missing.'],
      other:  ['Hmm.', 'Interesting.', 'What is this then.']
    },

    // ---- playing ----
    play: {
      ball:      ['Watch this.', 'Keepy-uppy.', 'Still got it.', 'Nearly had that.'],
      juggle:    ['Three at once. Almost.', 'Do not distract me.'],
      dance:     ['Cannot help it.', 'This is my song.', 'Look at me go.'],
      scrollbar: ['Good spot, this.', 'I live here now.', 'Comfy.'],
      zoomies:   ['ZOOM', 'wheee', 'cannot stop'],
      stumble:   ['oof', 'I meant to do that.', 'nothing to see here'],
      sneeze:    ['\u2026tchoo!'],
      critter:   ['Ooh, a bug.'],
      caught:    ['Got it!']
    },

    // ---- mischief ----
    mischief: {
      eyeing:   ['Ooh.', "What's this then...", 'Nobody will notice.'],
      taken:    ['Mine now.', 'Finders keepers.', 'You were not using this.',
                 'Just borrowing.', 'It followed me home.'],
      returned: ['Fine, have it back.', 'Here. Boring anyway.', 'Dropped it.'],
      nothing:  ['Nothing here to do that with.'],
      tilt:     ['Better like this.', 'Bit wonky now.', 'Straighten it yourself.'],
      flip:     ['Backwards is funnier.', 'Other way round.', 'Improved.'],
      scramble: ['Spell it now.', 'Oops.', 'Letters everywhere.'],
      topple:   ['It slipped.', 'Was not me.', 'Gravity.'],
      wheelbarrow: ['Right. Where does this go.'],
      dumped:   ['There.'],
      roadworks:['Roadworks.'],
      shelfdrop:['Oops. And oops.'],
      lamp:     ['Ooh, a switch.'],
      robbery:  ['This is a stick-up.'],
      robberyGo:['Nobody move.'],
      remorse:  ['Fine, I felt bad.']
    }
  };

  function pick(a) {
    if (!a || !a.length) return '';
    return a[Math.floor(Math.random() * a.length)];
  }

  /** get('page.news') -> a random line from that list. Safe if missing. */
  function get(path) {
    var node = LINES;
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length; i++) {
      if (node == null) return '';
      node = node[parts[i]];
    }
    if (typeof node === 'string') return node;
    return pick(node);
  }

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] != null ? vars[k] : '';
    });
  }

  global.RKLines = { LINES: LINES, get: get, pick: pick, fill: fill };
})(typeof globalThis !== 'undefined' ? globalThis : window);
