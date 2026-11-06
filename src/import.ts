export async function importArticle(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('File exceeds 20 MB.');
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  if (ext === 'txt') return file.text();
  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    return (await mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()})).value;
  }
  if (ext !== 'pdf') throw new Error('Choose a TXT, DOCX, or PDF file.');
  const pdf = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdf.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdf.getDocument({data: await file.arrayBuffer()});
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const {items} = await page.getTextContent();
      const lines: {text:string; y:number; height:number; right:number; closed:boolean}[] = [];
      for (const item of items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const [,,,,x,y] = item.transform;
        const line = lines.at(-1);
        if (!line || line.closed || Math.abs(line.y - y) > 2) {
          lines.push({text:item.str,y,height:item.height || 12,right:x + item.width,closed:item.hasEOL});
        } else {
          const gap = x - line.right;
          line.text += (gap > 1 && !line.text.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : '') + item.str;
          line.right = x + item.width;
          line.closed = item.hasEOL;
        }
      }
      pages.push(lines.map((line,j) => {
        const prev = lines[j - 1];
        return (prev ? Math.abs(line.y - prev.y) > Math.max(line.height,prev.height) * 1.65 ? '\n\n' : '\n' : '') + line.text.trim();
      }).join(''));
    }
    const result = pages.filter(Boolean).join('\n\n');
    if (!result.trim()) throw new Error('This PDF has no selectable text. Run OCR before importing.');
    return result;
  } finally {
    await task.destroy();
  }
}
