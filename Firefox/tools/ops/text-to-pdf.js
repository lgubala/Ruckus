/* Plain text or Markdown-ish notes -> a tidy PDF. */
RKDocTools.op({
  id: 'text-to-pdf',
  title: 'Text to PDF',
  group: 'Create PDF',
  blurb: 'Turn .txt, .md or .csv into a readable PDF.',
  accept: '.txt,.md,.csv,.log,text/plain',
  multiple: false,
  options: [
    { id: 'size', label: 'Page size', type: 'select', default: 'a4',
      choices: [['a4', 'A4'], ['letter', 'US Letter']] },
    { id: 'font', label: 'Size (pt)', type: 'number', default: 11 },
    { id: 'mono', label: 'Monospaced', type: 'check', default: false }
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const text = await file.text();

    const SIZES = { a4: [595.28, 841.89], letter: [612, 792] };
    const [pw, ph] = SIZES[ctx.options.size] || SIZES.a4;
    const margin = 56;
    const size = Number(ctx.options.font) || 11;

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(ctx.options.mono
      ? StandardFonts.Courier : StandardFonts.Helvetica);
    let page = doc.addPage([pw, ph]);
    let y = ph - margin;
    const lead = size * 1.5;

    util.wrap(util.safeText(text), font, size, pw - margin * 2).forEach(function (line) {
      if (y - lead < margin) { page = doc.addPage([pw, ph]); y = ph - margin; }
      page.drawText(line, { x: margin, y: y - size, size, font, color: rgb(0.1, 0.1, 0.13) });
      y -= lead;
    });

    ctx.log(doc.getPageCount() + ' page(s)');
    return [{ name: util.stem(file.name) + '.pdf',
              blob: new Blob([await doc.save()], { type: 'application/pdf' }) }];
  }
});
