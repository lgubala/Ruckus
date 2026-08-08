# Privacy policy

**Ruckus collects nothing, sends nothing, and has no servers.**

There is no analytics, no telemetry, no crash reporting, no accounts, and no
network code anywhere in the extension. There is no network code anywhere in the source.

## What is stored, and where

Everything lives in your browser's local extension storage, on your machine
only. Nothing syncs.

| Stored | Why |
| --- | --- |
| The pet's name, colour, stats and level | So it persists between sessions |
| Which sites you have visited, and a visit count per site | So it can say "here again" on familiar pages |
| Pages you explicitly bury | The stash in the Toolkit tab |
| Text you copy, if you leave that switch on | The clipboard history in the burrow |
| Your settings | Obvious |

## The two you should know about

**Clipboard history is off-limits by choice.** If enabled, text you copy on a
page is kept locally so you can find it again. It never leaves your machine, but
if you copy passwords on web pages, turn it off: *Toolkit &rarr; Clipboard &rarr;
Remember what I copy*. **Forget copied text** wipes it.

**Site history is a visit count, not a log.** The pet keeps at most sixty
hostnames with a visit tally and a timestamp. No URLs, no page contents, no
titles.

## Permissions, and why each is needed

| Permission | Why |
| --- | --- |
| `<all_urls>` | The pet walks around on pages and the finder searches them |
| `storage` | Saving the above |
| `tabs` | Knowing which tab is in front, so there is one pet and not one per tab |
| `alarms` | Water, movement and pomodoro reminders |
| `contextMenus` | The right-click menu |
| `notifications` | Reminders when no page is visible |

Screenshots use `tabs.captureVisibleTab` on your explicit action only; the image
is cropped in the page and handed to you as a download. It is never transmitted.

## Removing everything

*Pet &rarr; Start over* resets the pet and clears its memory. Uninstalling the
extension removes all stored data.
