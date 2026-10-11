/** 读取上传的简历或经历材料，统一返回文字或可读的错误说明 */
export async function readMaterial(file: File): Promise<{ text: string; note?: string } | { error: string }> {
  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const { extractPdfText } = await import('./pdf')
      const text = await extractPdfText(file)
      if (text.replace(/\s/g, '').length < 20) return { error: '这个 PDF 里读不到文字，可能是扫描件或图片。请打开原文件，复制文字后粘贴进来。' }
      return { text, note: `已从 ${file.name} 读出文字` }
    }
    if (/\.(txt|md|markdown)$/i.test(file.name) || file.type.startsWith('text/')) return { text: await file.text(), note: `已读取 ${file.name}` }
    return { error: '目前支持文字型 PDF、TXT 和 Markdown。Word 文件请另存为 PDF，或直接复制文字粘贴。' }
  } catch {
    return { error: '文件没有读成功。可以改为粘贴文字，内容不会丢。' }
  }
}

export const MATERIAL_ACCEPT = '.pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown'
