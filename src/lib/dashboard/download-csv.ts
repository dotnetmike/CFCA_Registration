export const downloadBlobFile = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const downloadTextFile = (filename: string, content: string, mimeType = "text/csv;charset=utf-8") =>
  downloadBlobFile(filename, new Blob([content], { type: mimeType }))
