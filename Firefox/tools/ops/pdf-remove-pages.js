/* Drop pages from a PDF. */
RKDocTools.op({
  id: 'pdf-remove-pages',
  title: 'Delete pages',
  group: 'Edit PDF',
  blurb: 'Remove the pages you list and keep everything else.',
  accept: 'application/pdf,.pdf',
  multiple: false,
  options: [
    { id: 'range', label: 'Pages to delete', type: 'text', default: '', placeholder: '2, 5-7' }
  ],
  async run(ctx) {
    const { PDFDocument } = PDFLib;
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const doc = await PDFDocument.load(await util.bytes(file), { ignoreEncryption: true });
    const total = doc.getPageCount();
    const drop = util.parseRange(ctx.options.range, total).sort((a, b) => b - a);
    if (!drop.length) throw new Error('Nothing selected to delete.');
    if (drop.length >= total) throw new Error('That would delete every page.');
    drop.forEach(i => doc.removePage(i));
    ctx.log('Removed ' + drop.length + ' page(s)');
    return [{ name: util.stem(file.name) + '-trimmed.pdf',
              blob: new Blob([await doc.save()], { type: 'application/pdf' }) }];
  }
});
