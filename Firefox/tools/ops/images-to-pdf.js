/* JPG/PNG -> a single PDF, one image per page. */
RKDocTools.op({
  id: 'images-to-pdf',
  title: 'Images to PDF',
  group: 'Create PDF',
  blurb: 'Combine JPG and PNG files into one PDF, one image per page.',
  accept: 'image/jpeg,image/png',
  multiple: true,
  options: [
    { id: 'size', label: 'Page size', type: 'select', default: 'fit',
      choices: [['fit', 'Fit each page to the image'], ['a4', 'A4 portrait'],
                ['letter', 'US Letter']] },
    { id: 'margin', label: 'Margin (pt)', type: 'number', default: 0 }
  ],
  async run(ctx) {
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.create();
    const SIZES = { a4: [595.28, 841.89], letter: [612, 792] };
    const margin = Number(ctx.options.margin) || 0;

    for (const file of ctx.files) {
      ctx.log('Embedding ' + file.name);
      const bytes = await RKDocTools.util.bytes(file);
      const img = /png$/i.test(file.type) || /\.png$/i.test(file.name)
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);

      if (ctx.options.size === 'fit') {
        const page = doc.addPage([img.width + margin * 2, img.height + margin * 2]);
        page.drawImage(img, { x: margin, y: margin, width: img.width, height: img.height });
      } else {
        const [pw, ph] = SIZES[ctx.options.size] || SIZES.a4;
        const page = doc.addPage([pw, ph]);
        const box = { w: pw - margin * 2, h: ph - margin * 2 };
        const scale = Math.min(box.w / img.width, box.h / img.height);
        const w = img.width * scale, h = img.height * scale;
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      }
    }

    const out = await doc.save();
    return [{ name: 'images.pdf', blob: new Blob([out], { type: 'application/pdf' }) }];
  }
});
