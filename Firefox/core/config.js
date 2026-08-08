/* Ruckus — every tunable number, in one place.
   Weights are relative: something at 40 is twice as likely as something at 20
   whenever both are eligible. Set a weight to 0 to switch a behaviour off. */
(function (global) {
  'use strict';

  var CONFIG = {

    // --- how often the pet considers doing anything (ms) ---
    timing: {
      thinkEvery:       4200,
      decideCooldown:   3000,
      mischiefCooldown: 20000,
      begCooldown:      90000,
      chatterGap:       50000,
      thoughtGap:       45000,
      microGap:         12000,
      tipGap:           420000,   // 7 minutes between useful tips
      holdLoot:         14000,
      critterLife:      30000,
      hoverGap:         2600,
      readingStillness: 12000,
      costumeMax:       25000     // hard deadline on any temporary costume
    },

    // --- how likely each self-directed behaviour is ---
    // Anything not listed uses the weight declared in its own plugin file.
    quirkWeights: {
      wander:           40,
      micro:            46,
      mischief:         null,   // null = use the plugin's own formula
      inspect:          null,
      chatter:          26,
      thought:          30,
      tip:              22,
      beg:              null,
      jar_poke:         26,
      zoomies:          14,
      critter:          14,
      sneeze:           7,
      ask_button:       20,
      ask_photo:        18,
      ask_word:         16,
      play_ball:        22,
      juggle:           14,
      dance:            12,
      sit_on_scrollbar: 10
    },

    // --- which pranks it favours ---
    trickWeights: {
      tilt:        3,
      scramble:    2,
      pinch_word:  2,
      pinch_image: 2,
      flip:        1.5,
      topple:      1,
      // set pieces: rarer, because they are a production
      wheelbarrow: 0.6,
      roadworks:   0.6,
      shelfdrop:   0.6,
      lamp:        0.6,
      robbery:     0.5
    },

    // --- how fast the pet's needs move (points per hour) ---
    // Bigger numbers mean the bars visibly move while you browse.
    drift: {
      hungerPerHour:     30,
      happinessPerHour:  20,
      energyAwakePerHour: 26,
      energyAsleepPerHour: 90,
      curiosityPerHour:  70,
      mischiefPerHour:   60,
      sleepBelow:        14,     // nods off under this much energy
      wakeAbove:         78,
      awayHours:         8       // longer than this counts as "you were out"
    },

    // --- what actions cost or give ---
    effort: {
      mischiefEnergy: 4,
      inspectEnergy:  1.5,
      zoomiesEnergy:  6,
      playEnergy:     3,
      patHappiness:   5,
      feedHunger:     28,
      treatCap:       20
    }
  };

  global.RKConfig = CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : window);
