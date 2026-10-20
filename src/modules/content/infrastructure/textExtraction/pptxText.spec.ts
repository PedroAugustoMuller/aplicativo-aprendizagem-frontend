import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { pptxText, slideText } from '@/modules/content/infrastructure/textExtraction/pptxText'

const slide = (...paragraphs: string[][]) =>
  `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="x"><p:cSld><p:spTree>${paragraphs
    .map((runs) => `<a:p>${runs.map((run) => `<a:r><a:t>${run}</a:t></a:r>`).join('')}</a:p>`)
    .join('')}</p:spTree></p:cSld></p:sld>`

async function deck(slides: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip()
  Object.entries(slides).forEach(([name, xml]) => zip.file(`ppt/slides/${name}`, xml))
  zip.file('ppt/slides/_rels/slide1.xml.rels', '<Relationships/>')

  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('pptxText', () => {
  it('joins runs into paragraphs and decodes entities', () => {
    expect(slideText(slide(['Ácidos ', 'e bases'], ['pH &lt; 7 &amp; &#233;cido']))).toBe('Ácidos e bases\npH < 7 & écido')
  })

  it('reads slides in numeric order, not name order', async () => {
    const data = await deck({ 'slide10.xml': slide(['Dez']), 'slide2.xml': slide(['Dois']), 'slide1.xml': slide(['Um']) })

    expect(await pptxText(data)).toBe('Um\n\nDois\n\nDez')
  })

  it('skips empty slides', async () => {
    const data = await deck({ 'slide1.xml': slide(['Um']), 'slide2.xml': slide() })

    expect(await pptxText(data)).toBe('Um')
  })
})
