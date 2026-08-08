/* Word -> PDF. Text and structure only: this reflows the document rather than
   reproducing Word's layout, so use it for readable output, not for artwork. */
RKDocTools.op({
  id: 'docx-to-pdf',
  title: 'Word to PDF',
  group: 'Documents',
  blurb: 'Lay a .docx out as a clean text PDF. Reflows the content \u2014 it does not reproduce Word\u2019s exact layout.',
  accept: '.docx',
  multiple: false,
  options: [
    { id: 'size', label: 'Page size', type: 'select', default: 'a4',
      choices: [['a4', 'A4'], ['letter', 'US Letter']] },
    { id: 'font', label: 'Body size (pt)', type: 'number', default: 11 }
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const util = RKDocTools.util;
    const file = ctx.files[0];

    const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    res.messages.forEach(m => ctx.log(m.message));

    // Turn the HTML into a flat list of blocks we can lay out.
    // Parsed with DOMParser rather than assigned to innerHTML: the document is
    // inert, no scripts or images can run from it, and no markup reaches a live
    // node. We only ever read textContent back out.
    const parsed = new DOMParser().parseFromString(res.value, 'text/html');
    const blocks = [];
    parsed.body.querySelectorAll('h1,h2,h3,h4,p,li,blockquote').forEach(function (el) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const tag = el.tagName.toLowerCase();
      blocks.push({
        text: (tag === 'li' ? '\u2022  ' : '') + text,
        heading: /^h[1-4]$/.test(tag) ? parseInt(tag[1], 10) : 0
      });
    });
    if (!blocks.length) throw new Error('That document appears to be empty.');

    const SIZES = { a4: [595.28, 841.89], letter: [612, 792] };
    const [pw, ph] = SIZES[ctx.options.size] || SIZES.a4;
    const margin = 56;
    const body = Number(ctx.options.font) || 11;

    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.TimesRoman);
    const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
    let page = doc.addPage([pw, ph]);
    let y = ph - margin;

    function newPage() { page = doc.addPage([pw, ph]); y = ph - margin; }

    blocks.forEach(function (b) {
      const size = b.heading ? body + (5 - b.heading) * 2.5 : body;
      const font = b.heading ? bold : regular;
      const lead = size * 1.45;
      const lines = util.wrap(util.safeText(b.text), font, size, pw - margin * 2);

      if (b.heading) y -= lead * 0.5;
      lines.forEach(function (line) {
        if (y - lead < margin) newPage();
        page.drawText(line, { x: margin, y: y - size, size, font,
                              color: rgb(0.12, 0.12, 0.15) });
        y -= lead;
      });
      y -= lead * 0.35;
    });

    ctx.log('Laid out ' + blocks.length + ' blocks over ' + doc.getPageCount() + ' pages');
    return [{ name: util.stem(file.name) + '.pdf',
              blob: new Blob([await doc.save()], { type: 'application/pdf' }) }];
  }
});
