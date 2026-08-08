# Custom sounds

Drop your own audio in this folder and Ruckus uses it instead of the built-in
square-wave blips. Anything you don't provide keeps using the blip, so you can
replace one cue or all eight.

## Filenames

Name the file after the cue. The folder is checked for `.ogg` first, then
`.mp3`, then `.wav` — the first one that loads wins.

| File | Plays when |
| --- | --- |
| `pat.ogg` | You pat the pet |
| `feed.ogg` | It eats a treat |
| `levelUp.ogg` | It levels up or evolves |
| `steal.ogg` | It pinches something off the page |
| `shoo.ogg` | You shoo it away |
| `nudge.ogg` | A water or move reminder fires |
| `done.ogg` | A pomodoro round ends |
| `tick.ogg` | Small confirmations, e.g. it starts begging |

So the full set is:

```
sounds/
  pat.ogg
  feed.ogg
  levelUp.ogg
  steal.ogg
  shoo.ogg
  nudge.ogg
  done.ogg
  tick.ogg
```

## Format

**Ogg Vorbis (`.ogg`) is the best choice for Firefox** — it is natively
supported, needs no licensing, and compresses short clips well. `.mp3` and
`.wav` also work.

Keep clips **short (under about 1.5 seconds)** and **quiet**. They are played at
the volume set in Settings, and long clips overlap awkwardly when the pet is
busy. Mono is fine and halves the file size.

Sample rate 44.1 kHz, roughly 96–128 kbps for ogg, is plenty.

## Where to find free sounds

Look for **CC0 / public domain** so there is nothing to attribute:

- **freesound.org** — filter the licence facet to *Creative Commons 0*
- **kenney.nl/assets** — the *Interface Sounds* and *UI Audio* packs are CC0 and
  suit a pixel pet very well
- **opengameart.org** — filter by CC0
- **sfxr / jfxr / ChipTone** — generate your own retro blips in the browser

## After adding files

Reload the extension (`about:debugging` → Reload) and then reload any open tabs.
To check what was picked up, open the page console and run:

```js
__ruckus.sounds()
// pat=file feed=file levelUp=blip steal=blip shoo=blip nudge=blip done=blip tick=blip
```

`=file` means your audio is in use; `=blip` means it fell back to the synth.
