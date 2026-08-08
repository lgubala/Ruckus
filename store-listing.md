# Store listing copy

Paste-ready text for AMO and the Chrome Web Store.

---

## Name

Ruckus

## Tagline

Your browser's mischievous sidekick.

## Summary (AMO, 250 char max)

A pixel pet that lives in your browser. It sniffs out text with a prettier
Ctrl+F, keeps what you copy, and occasionally tilts a photo when you are not
looking. Includes offline PDF and Word tools. No accounts, no servers, nothing
uploaded.

## Short description (Chrome, 132 char max)

A pixel pet that lives in your browser: a prettier Ctrl+F, offline PDF and Word
tools, and a creature that misbehaves.

## Full description

Ruckus is your browser’s mischievous sidekick: a small pixel creature that
lives on your pages. It wanders your pages,
naps, chases bugs, and now and then pinches a word out of a paragraph and runs
off with it. Everything it takes, it gives back.

It is also useful.

FIND ON PAGE
Ctrl+Shift+F opens a finder with match counts, whole-word and regex options, and
a strip down the edge showing where every match sits. The pet trots over to each
one.

DOCUMENT TOOLS, OFFLINE
Merge, split, rotate and number PDFs. Turn images into a PDF or a Word document.
Pull pages out as images or text. Convert Word files to PDF or HTML. Fourteen
operations, all running in your own browser. Your files are never uploaded
anywhere, and it works with the network switched off.

THINGS IT KEEPS FOR YOU
Bury a page to read later. Anything you copy is remembered so you can find it
again. Both live in the burrow, one click away.

SMALL USEFUL THINGS
Snip an area of the page to a PNG. Copy a link that jumps straight to the text
you selected. Reader mode that hides the clutter without changing the colours.
Water and movement reminders, and a pomodoro timer.

IT NOTICES WHAT YOU ARE DOING
Typing? It sits beside your text box with a notebook. Watching a video? 3D
glasses and popcorn. On a password field it puts on a blindfold and turns its
back.

PRIVACY
No accounts, no servers, no analytics, no telemetry. The extension contains no
network code at all. Everything it remembers is stored on your machine and can
be wiped from the settings.

Free and open source, MIT licensed.

## Categories

AMO: Fun, Photos/Music/Videos
Chrome: Fun, Productivity

## Tags

pdf, productivity, pet, find, screenshot, clipboard, offline, open source

## Permission justifications (Chrome Web Store form)

**Host permission `<all_urls>`**
The pet is drawn as an overlay on web pages and the find-on-page feature reads
page text to locate matches. Both require access to page content on whichever
site the user is browsing, so the permission cannot be narrowed to a list.

**storage**
Saving the pet's state and the user's settings locally. No remote storage.

**tabs**
Detecting the active tab so exactly one pet exists rather than one per tab, and
`tabs.captureVisibleTab` for the user-initiated area screenshot.

**alarms**
Scheduling the water, movement and pomodoro reminders.

**contextMenus**
Adding the Ruckus submenu to the page right-click menu.

**notifications**
Showing a reminder when no suitable page is available to display it on.

**Remote code:** No. All code is included in the package.

**Data usage disclosure:** This extension does not collect or transmit any user
data. Clipboard history and per-site visit counts are stored locally on the
user's device only, are disclosed in the interface, and can be disabled and
erased by the user.

## Privacy policy URL

Point at PRIVACY.md in the repository, e.g.
https://github.com/yourname/ruckus/blob/main/PRIVACY.md

## Screenshots to capture

1. The pet on a real article, mid-mischief with a tilted image
2. The finder open with the match ribbon visible
3. The popup, Pet tab
4. The popup, Toolkit tab
5. The document tools page with a PDF loaded
