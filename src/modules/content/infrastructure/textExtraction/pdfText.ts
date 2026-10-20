import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

/** Text of every page, in order. A scanned PDF (images only) comes back empty. */
export async function pdfText(data: ArrayBuffer): Promise<string> {
  // pdf.js 6 tears a document down through its loading task.
  const task = getDocument({ data })
  const pdf = await task.promise

  try {
    const pages: string[] = []

    for (let number = 1; number <= pdf.numPages; number++) {
      const content = await (await pdf.getPage(number)).getTextContent()
      pages.push(
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join(''),
      )
    }

    return pages.join('\n\n')
  } finally {
    await task.destroy()
  }
}
