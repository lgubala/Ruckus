/* Plain text -> Word, one paragraph per line. Pairs with "PDF to text". */
RKDocTools.op({
  id: 'text-to-docx',
  title: 'Text to Word',
  group: 'Documents',
  blurb: 'Turn a .txt file into a .docx. Handy straight after PDF to text.',
  accept: '.txt,.md,.csv,text/plain',
  multiple: false,
  options: [
    { id: 'size', label: 'Body size (pt)', type: 'number', default: 11 }
  ],
  async run(ctx) {
    const D = docx;
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const text = await file.text();
    const half = (Number(ctx.options.size) || 11) * 2;   // docx uses half-points

    const children = text.split(/\r?\n/).map(function (line) {
      return new D.Paragraph({
        children: [new D.TextRun({ text: line, size: half })]
      });
    });

    const doc = new D.Document({ sections: [{ children }] });
    ctx.log(children.length + ' paragraphs');
    return [{ name: util.stem(file.name) + '.docx', blob: await D.Packer.toBlob(doc) }];
  }
});
