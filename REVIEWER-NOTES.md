# Notes for reviewers

Thank you for taking the time. This document is here to make verification quick.

## Layout

`Chrome/` and `Firefox/` are complete, self-contained copies of the extension,
differing only in the manifest (V3 and V2 respectively). Reviewing either one
covers the whole product.

## Summary

- **No remote code.** The extension never contacts a network. No analytics, no
  telemetry, no accounts, no eval, no remotely-hosted scripts.
- **No minified first-party code.** Everything under `Chrome/` and `Firefox/` is plain, readable,
  commented JavaScript exactly as written. There is no build step and no bundler.
- **Five minified files, all unmodified third-party libraries.** They are
  byte-identical to their published npm releases; hashes below.

## The bundled libraries

Every file in `vendor/` is a verbatim copy of a published release. None has been
modified, concatenated or re-minified.

| File | Package | Licence | Size | SHA-256 |
| --- | --- | --- | --- | --- |
| `pdf-lib.min.js` | pdf-lib@1.17.1 | MIT | 512 KB | `0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f` |
| `pdfjs.min.js` | pdfjs-dist@3.11.174 | Apache-2.0 | 312 KB | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` |
| `pdfjs.worker.min.js` | pdfjs-dist@3.11.174 | Apache-2.0 | 1061 KB | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` |
| `mammoth.browser.min.js` | mammoth@1.12.0 | BSD-2-Clause | 620 KB | `5d4c0e7c9165d70b78f789c5274a2c7846d9e1c06ec19b69afa6ef45f789a3b9` |
| `docx.iife.js` | docx@9.7.1 | MIT | 1097 KB | `d5ec4f5a8b99740845974f5f6f020d6e5b1b6c27026195befc67eb37035c84c7` |

Full licence texts are in `vendor/licenses/`.

### Reproducing them

```bash
npm install pdf-lib@1.17.1 pdfjs-dist@3.11.174 mammoth@1.12.0 docx@9.7.1
cp node_modules/pdf-lib/dist/pdf-lib.min.js \
   vendor/pdf-lib.min.js
cp node_modules/pdfjs-dist/build/pdf.min.js \
   vendor/pdfjs.min.js
cp node_modules/pdfjs-dist/build/pdf.worker.min.js \
   vendor/pdfjs.worker.min.js
cp node_modules/mammoth/mammoth.browser.min.js \
   vendor/mammoth.browser.min.js
cp node_modules/docx/dist/index.iife.js \
   vendor/docx.iife.js
```

Then compare, for example:

```bash
sha256sum vendor/pdf-lib.min.js
```

The hashes above should match exactly.

## What each library is for

| Library | Used by | Purpose |
| --- | --- | --- |
| pdf-lib | `tools/ops/*.js` | Creating and editing PDFs locally |
| pdf.js | `pdf-to-images`, `pdf-to-text` | Rendering and text extraction |
| mammoth | `docx-to-html`, `docx-to-pdf` | Reading .docx |
| docx | `images-to-docx`, `text-to-docx` | Writing .docx |

All document processing happens in the user's own tab. No file is transmitted.

## Permissions, and why each is required

| Permission | Required for |
| --- | --- |
| `<all_urls>` | The pet is an overlay drawn on pages, and the find-on-page feature searches page text. It cannot work on a subset of sites. |
| `storage` | The pet's state and the user's settings, locally |
| `tabs` | Detecting the active tab so exactly one pet exists instead of one per tab; and `tabs.captureVisibleTab` for the user-initiated area screenshot |
| `alarms` | Water, movement and pomodoro reminders |
| `contextMenus` | The right-click menu |
| `notifications` | Reminders when no page is available to display them on |

## Privacy-relevant behaviour, disclosed

Two features touch user content. Both are local, both are disclosed in the UI,
and both can be switched off.

1. **Clipboard history** (`content/tools.js`). If enabled, text the user
   copies on a page is stored locally so they can find it again. Off switch:
   Toolkit &rarr; Clipboard. A wipe button is provided. It is never transmitted.
2. **Per-site visit counts** (`background.js`, action `visit`). At most 60
   hostnames with a visit tally, so the pet can say "here again" on a familiar
   site. No URLs, no page contents, no titles.

`PRIVACY.md` covers this in user-facing language.

## The extension modifies page content

This is deliberate and is the point of the product: the pet occasionally tilts an
image, hides a word, or scatters the letters of a heading. **Every modification
is reversible and reverted.** Originals are hidden rather than removed, and each
change records exactly how to undo itself. The page returns byte-for-byte identical after a run. The behaviour can be disabled
entirely: Pet &rarr; "Let it steal things off the page".

## Verifying there is no network code

```bash
grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|http://\|https://" \
  Firefox/ --exclude-dir=vendor
```

The only matches are `runtime.getURL()` calls loading the extension's own
bundled files. 

