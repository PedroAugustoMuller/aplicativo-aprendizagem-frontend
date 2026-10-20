import JSZip from 'jszip'

const SLIDE = /^ppt\/slides\/slide(\d+)\.xml$/

/** Text of a .pptx, slide by slide in presentation order. PowerPoint always writes the `a:` prefix. */
export async function pptxText(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data)
  const slides = Object.keys(zip.files)
    .map((name) => SLIDE.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => Number(a[1]) - Number(b[1]))

  const texts: string[] = []

  for (const match of slides) {
    const entry = zip.file(match[0])
    const text = entry === null ? '' : slideText(await entry.async('string'))

    if (text !== '') {
      texts.push(text)
    }
  }

  return texts.join('\n\n')
}

export function slideText(xml: string): string {
  return [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
    .map((paragraph) => [...(paragraph[1] ?? '').matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((run) => decode(run[1] ?? '')).join(''))
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n')
}

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
