/* Turn pages the right way up. */
RKDocTools.op({
  id: 'pdf-rotate',
  title: 'Rotate pages',
  group: 'Edit PDF',
  blurb: 'Rotate every page, or just the ones you list.',
  accept: 'application/pdf,.pdf',
  multiple: false,
  options: [
    { id: 'angle', label: 'Turn by', type: 'select', default: '90',
      choices: [['90', '90\u00B0 clockwise'], ['180', '180\u00B0'], ['270', '90\u00B0 anticlockwise']] },
    { id: 'range', label: 'Pages (blank = all)', type: 'text', default: '', placeholder: '1-4' }
  ],
  async run(ctx) {
    const { PDFDocument, degrees } = PDFLib;
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const doc = await PDFDocument.load(await util.bytes(file), { ignoreEncryption: true });
    const total = doc.getPageCount();
    const want = ctx.options.range.trim()
      ? util.parseRange(ctx.options.range, total)
      : doc.getPageIndices();
    const by = parseInt(ctx.options.angle, 10);

    want.forEach(function (i) {
      const page = doc.getPage(i);
      page.setRotation(degrees((page.getRotation().angle + by) % 360));
    });
    ctx.log('Rotated ' + want.length + ' page(s) by ' + by + '\u00B0');
    return [{ name: util.stem(file.name) + '-rotated.pdf',
              blob: new Blob([await doc.save()], { type: 'application/pdf' }) }];
  }
});
