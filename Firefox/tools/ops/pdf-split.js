/* Pull out a page range, or burst every page into its own file. */
RKDocTools.op({
  id: 'pdf-split',
  title: 'Split / extract pages',
  group: 'Edit PDF',
  blurb: 'Keep a range like 1-3, 7, 10- , or split every page into its own PDF.',
  accept: 'application/pdf,.pdf',
  multiple: false,
  options: [
    { id: 'mode', label: 'Mode', type: 'select', default: 'range',
      choices: [['range', 'Extract a range'], ['each', 'One file per page']] },
    { id: 'range', label: 'Pages', type: 'text', default: '1-', placeholder: '1-3, 7, 10-' }
  ],
  async run(ctx) {
    const { PDFDocument } = PDFLib;
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const src = await PDFDocument.load(await util.bytes(file), { ignoreEncryption: true });
    const total = src.getPageCount();
    const stem = util.stem(file.name);

    if (ctx.options.mode === 'each') {
      const out = [];
      for (let i = 0; i < total; i++) {
        ctx.log('Page ' + (i + 1) + ' of ' + total);
        const one = await PDFDocument.create();
        const [p] = await one.copyPages(src, [i]);
        one.addPage(p);
        out.push({ name: stem + '-p' + (i + 1) + '.pdf',
                   blob: new Blob([await one.save()], { type: 'application/pdf' }) });
      }
      return out;
    }

    const want = util.parseRange(ctx.options.range, total);
    if (!want.length) throw new Error('That range selects no pages (document has ' + total + ').');
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, want);
    pages.forEach(p => out.addPage(p));
    ctx.log('Kept ' + want.length + ' of ' + total + ' pages');
    return [{ name: stem + '-pages.pdf',
              blob: new Blob([await out.save()], { type: 'application/pdf' }) }];
  }
});
