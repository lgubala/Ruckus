/* Word -> HTML or plain text, styles and all. */
RKDocTools.op({
  id: 'docx-to-html',
  title: 'Word to HTML / text',
  group: 'Documents',
  blurb: 'Convert a .docx into clean HTML, or strip it down to plain text.',
  accept: '.docx',
  multiple: false,
  options: [
    { id: 'as', label: 'Output', type: 'select', default: 'html',
      choices: [['html', 'HTML'], ['text', 'Plain text']] }
  ],
  async run(ctx) {
    const util = RKDocTools.util;
    const file = ctx.files[0];
    const buf = await file.arrayBuffer();
    const stem = util.stem(file.name);

    if (ctx.options.as === 'text') {
      const res = await mammoth.extractRawText({ arrayBuffer: buf });
      res.messages.forEach(m => ctx.log(m.message));
      return [{ name: stem + '.txt',
                blob: new Blob([res.value], { type: 'text/plain;charset=utf-8' }) }];
    }

    const res = await mammoth.convertToHtml({ arrayBuffer: buf });
    res.messages.forEach(m => ctx.log(m.message));
    const page = '<!doctype html>\n<html><head><meta charset="utf-8">\n' +
      '<title>' + stem.replace(/[<>&]/g, '') + '</title>\n' +
      '<style>body{max-width:44rem;margin:3rem auto;padding:0 1rem;' +
      'font:16px/1.65 Georgia,serif;color:#222}img{max-width:100%}' +
      'table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.4rem}</style>\n' +
      '</head><body>\n' + res.value + '\n</body></html>\n';
    return [{ name: stem + '.html', blob: new Blob([page], { type: 'text/html;charset=utf-8' }) }];
  }
});
