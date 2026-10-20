export function downloadSave(text: string, savedAt: string): void {
  const blob = new Blob([text], { type: 'application/json' }), url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `mini-factorio-save-${savedAt.slice(0, 16).replace('T', '-').replace(':', '')}.json`
  try { document.body.append(anchor); anchor.click() }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 0) }
}
