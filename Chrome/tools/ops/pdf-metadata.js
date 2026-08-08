/* Read and rewrite the document properties. */
RKDocTools.op({
  id: 'pdf-metadata',
  title: 'Edit PDF details',
  group: 'Edit PDF',
  blurb: 'Change the title, author, subject and keywords stored in the file.',
  accept: 'application/pdf,.pdf',
  multiple: false,
  options: [
    { id: 'title', label: 'Title', type: 'text', default: '' },
    { id: 'author', label: 'Author', type: 'text', default: '' },
    { id: 'subject', label: 'Subject', type: 'text', default: '' },
    { id: 'keywords', label: 'Keywords (comma separated)', type: 'text', default: '' }
  ],
  async inspect(file) {
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()),
      { ignoreEncryption: true });
    return {
      title: doc.getTitle() || '', author: doc.getAuthor() || '',
      subject: doc.getSubject() || '', keywords: (doc.getKeywords() || '')
    };
  },
  async run(ctx) {
    const { PDFDocument } = PDFLib;
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const doc = await PDFDocument.load(await util.bytes(file), { ignoreEncryption: true });
    const o = ctx.options;
    if (o.title) doc.setTitle(o.title);
    if (o.author) doc.setAuthor(o.author);
    if (o.subject) doc.setSubject(o.subject);
    if (o.keywords) doc.setKeywords(o.keywords.split(',').map(s => s.trim()).filter(Boolean));
    doc.setModificationDate(new Date());
    return [{ name: util.stem(file.name) + '-tagged.pdf',
              blob: new Blob([await doc.save()], { type: 'application/pdf' }) }];
  }
});
