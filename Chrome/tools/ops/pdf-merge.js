/* Several PDFs -> one, in the order listed. */
RKDocTools.op({
  id: 'pdf-merge',
  title: 'Merge PDFs',
  group: 'Edit PDF',
  blurb: 'Join several PDFs end to end. Drag the list to reorder before running.',
  accept: 'application/pdf,.pdf',
  multiple: true,
  async run(ctx) {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();
    for (const file of ctx.files) {
      ctx.log('Adding ' + file.name);
      const src = await PDFDocument.load(await RKDocTools.util.bytes(file),
        { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    const out = await merged.save();
    return [{ name: 'merged.pdf', blob: new Blob([out], { type: 'application/pdf' }) }];
  }
});
