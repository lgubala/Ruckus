# Changelog

## 1.3.1

- **Fixed the popup flickering between two layouts.** The mobile styles were
  behind `@media (max-width: 560px)`, but a desktop popup is only 300px wide, so
  the query matched there too. The larger mobile layout made the popup wider,
  which unmatched the query, which made it narrow again. They now key off
  `pointer: coarse`, which is true on a phone and false on a desktop whatever
  the width.

## 1.3.0

- **Fixed a crash that broke almost everything.** `panel` was used but never
  declared, so `boot()` threw partway and the message listener inside it never
  registered. That single line explains the dead context menu, Ruckus not
  reappearing when re-enabled, and the missing debug handle. The failure was
  swallowed by a try/catch, which is why nothing appeared in the console.
- **Popup scrolls.** Firefox caps a popup near 600px; the Toolkit tab is taller
  than that, so it was clipped with no way to reach the rest.
- **Settings page added.** Android has no toolbar popup, so Settings &rarr;
  Add-ons &rarr; Ruckus &rarr; Settings was a dead end. It now opens the full
  interface, reusing the popup rather than duplicating it.
- **The long-press menu fits the screen.** It was anchored to the pet and ran
  off the bottom of a phone; it now centres and scrolls when it cannot fit.
- **Dragging Ruckus somewhere keeps him there** for 20 seconds instead of
  walking straight back to the floor.
- **Mischief intensity slider** &mdash; Quiet, Mild, Normal, Absolute ham. It
  scales both how often he misbehaves and the gap between pranks; Quiet stops
  it entirely.
- Brand in the popup still said PET PIXEL; removed a duplicate menu entry

## 1.2.0

- **Character card in the page.** On Android the toolbar popup is three taps
  deep in Settings, which is no good for a glance. The same information now
  opens over the page from the right-click menu, the pet's own menu, or
  *How is Ruckus?*
- **Richer right-click menu**, since on a phone it is the quickest route to
  anything: status, feed, pat, find, snip, reader mode, burrow, document tools,
  come here, and the two off switches
- **Popup redesigned as a character profile** — soft dark card, glow behind the
  sprite, gradient stat bars with numbers, pill buttons, round colour dots
- The off switches moved into the profile card

## 1.1.0 — mobile

- **Added the viewport meta tag.** Without it Firefox for Android rendered the
  popup at desktop scale, as an unreadable strip in the corner. Everything below
  follows from finally being able to see it.
- Popup fills the screen under 560px, with larger type and finger-sized targets
- The finder was a fixed 358px pinned 24px from the right, which pushed it off a
  phone screen and wrapped the query onto its own line. It now spans the width.
- **Two new off switches** — *Off on this site* and *Turn Ruckus off* — in the
  popup and on the right-click menu
- **Area snip works on touch.** The drag was being stolen by page scrolling, and
  the download link was removed before Android had finished with it, so nothing
  was ever saved. There is now also a one-tap *Whole screen* button.
- Smaller sprite and more bottom clearance on phones; hover reactions no longer
  fire on tap; larger tap targets throughout

## 1.0.0

- Renamed to **Ruckus** — your browser's mischievous sidekick
- The pet is simply called Ruckus; the rename field is gone
- Installs from before the rename keep their level, memory and settings
- Prepared for publishing: MIT licence, privacy policy, reviewer notes and
  third-party attribution with verifiable hashes
- Declared `data_collection_permissions: none` for AMO
- Replaced the one `innerHTML` assignment with `DOMParser`
- Told pdf.js `isEvalSupported: false`, since extension pages forbid `new Function`

## 0.4.0

- Document tools: 14 offline operations for PDF, Word, images and text
- Popup split into a Pet tab and a Toolkit tab
- CSS split into modules for both the popup and the in-page overlay

## 0.3.0

- Settings now apply whether or not the pet is on screen
- Sound pack failures can no longer take down the content script

## 0.2.0

- Everything is a plugin: one file per prank, one file per behaviour
- `lines.js` holds every line of dialogue; `config.js` every weight and timing
- One pet, colour-only customisation, no growth stages

## 0.1.0

- The pet, mischief, the finder, treats, reminders and the burrow
