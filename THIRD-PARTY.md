# Third-party libraries

Ruckus bundles four libraries in `Chrome/vendor/` and `Firefox/vendor/`. Every one is:

- an **official release, copied verbatim from npm** &mdash; not modified, not
  re-bundled, not transpiled
- **permissively licensed** and compatible with this project's MIT licence
- used **entirely offline**; the extension makes no network requests at all

Full licence texts are in `vendor/licenses/`.

| Library | Version | Licence | npm | Bundled as |
| --- | --- | --- | --- | --- |
| pdf-lib | 1.17.1 | MIT | `pdf-lib@1.17.1` | `pdf-lib.min.js` |
| pdf.js | 3.11.174 | Apache-2.0 | `pdfjs-dist@3.11.174` | `pdfjs.min.js`, `pdfjs.worker.min.js` |
| mammoth | 1.12.0 | BSD-2-Clause | `mammoth@1.12.0` | `mammoth.browser.min.js` |
| docx | 9.7.1 | MIT | `docx@9.7.1` | `docx.iife.js` |

## Reproducing the vendor directory

These commands produce byte-identical files to the ones shipped:

```bash
npm install pdf-lib@1.17.1 pdfjs-dist@3.11.174 mammoth@1.12.0 docx@9.7.1

cp node_modules/pdf-lib/dist/pdf-lib.min.js        Firefox/vendor/pdf-lib.min.js
cp node_modules/pdfjs-dist/build/pdf.min.js        vendor/pdfjs.min.js
cp node_modules/pdfjs-dist/build/pdf.worker.min.js vendor/pdfjs.worker.min.js
cp node_modules/mammoth/mammoth.browser.min.js     vendor/mammoth.browser.min.js
cp node_modules/docx/dist/index.iife.js            vendor/docx.iife.js
```

Then check them:

```bash
./verify-vendor.sh
```

## SHA-256

```
d5ec4f5a8b99740845974f5f6f020d6e5b1b6c27026195befc67eb37035c84c7  docx.iife.js
5d4c0e7c9165d70b78f789c5274a2c7846d9e1c06ec19b69afa6ef45f789a3b9  mammoth.browser.min.js
0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f  pdf-lib.min.js
5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946  pdfjs.min.js
feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b  pdfjs.worker.min.js
```

## Why these are minified

They are shipped exactly as their authors publish them. Substituting a
self-built or re-minified copy would make the files *harder* to verify, not
easier: as published, the checksums above can be matched against npm directly.
