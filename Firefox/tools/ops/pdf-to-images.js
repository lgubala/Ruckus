/* Render each page to PNG or JPG. */
RKDocTools.op({
  id: 'pdf-to-images',
  title: 'PDF to images',
  group: 'Convert from PDF',
  blurb: 'Render every page to a PNG or JPG at the scale you choose.',
  accept: 'application/pdf,.pdf',
  multiple: false,
  options: [
    { id: 'format', label: 'Format', type: 'select', default: 'png',
      choices: [['png', 'PNG'], ['jpeg', 'JPG']] },
    { id: 'scale', label: 'Scale', type: 'select', default: '2',
      choices: [['1', '1x (screen)'], ['2', '2x'], ['3', '3x (print-ish)']] },
    { id: 'range', label: 'Pages (blank = all)', type: 'text', default: '', placeholder: '1-5' }
  ],
  async run(ctx) {
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const pdf = await pdfjsLib.getDocument({
      data: await util.bytes(file),
      // Extension pages forbid `new Function`. Telling pdf.js up front
      // avoids it probing and falling over; it has slower pure-JS paths.
      isEvalSupported: false
    }).promise;
    const total = pdf.numPages;
    const want = ctx.options.range.trim()
      ? util.parseRange(ctx.options.range, total)
      : Array.from({ length: total }, (_, i) => i);
    const scale = Number(ctx.options.scale) || 2;
    const type = 'image/' + ctx.options.format;
    const ext = ctx.options.format === 'jpeg' ? 'jpg' : 'png';
    const stem = util.stem(file.name);
    const out = [];

    for (const i of want) {
      ctx.log('Rendering page ' + (i + 1) + ' of ' + total);
      const page = await pdf.getPage(i + 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (ctx.options.format === 'jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, type, 0.92));
      out.push({ name: stem + '-p' + (i + 1) + '.' + ext, blob });
    }
    return out;
  }
});
