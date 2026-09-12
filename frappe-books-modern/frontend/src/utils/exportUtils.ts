/**
 * Utility functions for exporting financial reports to Excel/CSV and PDF.
 */

export function exportToCSV(filename: string, headers: string[], rows: (string | number | boolean)[][]) {
  const csvLines = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  ]
  const csvContent = '\uFEFF' + csvLines.join('\r\n') // BOM for Excel encoding support

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportToPDF(reportTitle: string) {
  const originalTitle = document.title
  document.title = `${reportTitle} - Financial Report`
  window.print()
  document.title = originalTitle
}
