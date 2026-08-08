/* Images -> a Word document, one per page. */
RKDocTools.op({
  id: 'images-to-docx',
  title: 'Images to Word',
  group: 'Documents',
  blurb: 'Drop JPG or PNG files into a .docx, one image per page.',
  accept: 'image/jpeg,image/png',
  multiple: true,
  options: [
    { id: 'width', label: 'Image width (pt)', type: 'number', default: 450 },
    { id: 'caption', label: 'Caption each with its filename', type: 'check', default: false }
  ],
  async run(ctx) {
    const D = docx;
    const width = Number(ctx.options.width) || 450;
    const children = [];

    for (let i = 0; i < ctx.files.length; i++) {
      const file = ctx.files[i];
      ctx.log('Placing ' + file.name);
      const buf = await file.arrayBuffer();
      const dims = await new Promise(function (resolve, reject) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = function () {
          URL.revokeObjectURL(url);
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Bad image: ' + file.name)); };
        img.src = url;
      });
      const height = Math.round(width * (dims.h / dims.w));

      children.push(new D.Paragraph({
        children: [new D.ImageRun({ data: buf, transformation: { width, height } })]
      }));
      if (ctx.options.caption) {
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: file.name, italics: true, size: 18 })]
        }));
      }
      if (i < ctx.files.length - 1) {
        children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
      }
    }

    const doc = new D.Document({ sections: [{ children }] });
    const blob = await D.Packer.toBlob(doc);
    return [{ name: 'images.docx', blob }];
  }
});
