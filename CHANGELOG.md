# Changelog

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
