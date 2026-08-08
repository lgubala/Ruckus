/* Pull the text layer out. Scanned pages have none — this will not OCR. */
RKDocTools.op({
  id: 'pdf-to-text',
  title: 'PDF to text',
  group: 'Convert from PDF',
  blurb: 'Extract the text layer. Scanned pages contain no text and come out blank.',
  accept: 'application/pdf,.pdf',
  multiple: false,
  options: [
    { id: 'breaks', label: 'Mark page breaks', type: 'check', default: true }
  ],
  async run(ctx) {
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const pdf = await pdfjsLib.getDocument({ data: await util.bytes(file) }).promise;
    let all = '';
    let empty = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      ctx.log('Reading page ' + i + ' of ' + pdf.numPages);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let last = null;
      let text = '';
      content.items.forEach(function (item) {
        if (last !== null && Math.abs(item.transform[5] - last) > 2) text += '\n';
        text += item.str;
        last = item.transform[5];
      });
      if (!text.trim()) empty++;
      if (ctx.options.breaks && i > 1) all += '\n\n--- page ' + i + ' ---\n\n';
      all += text;
    }
    if (empty === pdf.numPages) {
      ctx.log('No text found on any page \u2014 this looks like a scan.');
    }
    return [{ name: util.stem(file.name) + '.txt',
              blob: new Blob([all], { type: 'text/plain;charset=utf-8' }) }];
  }
});
