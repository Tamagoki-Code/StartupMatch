import * as pdfjsLib from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url"

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// Mirrors extract_text_from_pdf_bytes() from the Python prototype — best
// effort, returns "" (not a throw) on any extraction failure so callers can
// surface a friendly "couldn't read this PDF" message.
export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise
    const pages: string[] = []

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ")
      if (text.trim()) pages.push(text)
    }

    return pages.join("\n")
  } catch {
    return ""
  }
}
