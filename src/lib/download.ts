/**
 * Hands a file to the browser without a server: an object URL and a click on a
 * link that never appears on screen.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(contents: string, filename: string, type: string): void {
  downloadBlob(new Blob([contents], { type }), filename);
}
