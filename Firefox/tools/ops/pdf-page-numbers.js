/* Stamp page numbers along the bottom. */
RKDocTools.op({
  id: 'pdf-page-numbers',
  title: 'Add page numbers',
  group: 'Edit PDF',
  blurb: 'Stamp a number on every page.',
  accept: 'application/pdf,.pdf',
  multiple: false,
  options: [
    { id: 'where', label: 'Position', type: 'select', default: 'bc',
      choices: [['bl', 'Bottom left'], ['bc', 'Bottom centre'], ['br', 'Bottom right']] },
    { id: 'size', label: 'Size (pt)', type: 'number', default: 10 },
    { id: 'from', label: 'Start at', type: 'number', default: 1 }
  ],
  async run(ctx) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const doc = await PDFDocument.load(await util.bytes(file), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = Number(ctx.options.size) || 10;
    const start = Number(ctx.options.from) || 1;

    doc.getPages().forEach(function (page, i) {
      const label = String(start + i);
      const w = font.widthOfTextAtSize(label, size);
      const { width } = page.getSize();
      const x = ctx.options.where === 'bl' ? 36
        : ctx.options.where === 'br' ? width - 36 - w
        : (width - w) / 2;
      page.drawText(label, { x, y: 24, size, font, color: rgb(0.25, 0.25, 0.3) });
    });
    ctx.log('Numbered ' + doc.getPageCount() + ' pages');
    return [{ name: util.stem(file.name) + '-numbered.pdf',
              blob: new Blob([await doc.save()], { type: 'application/pdf' }) }];
  }
});
