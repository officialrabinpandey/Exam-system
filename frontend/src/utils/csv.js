// Converts an array of flat objects to a CSV string and triggers a download.
// Client-side only — no backend round trip needed since the data is already
// loaded in the page.
export function downloadCsv(filename, rows, headers) {
  if (!rows || rows.length === 0) return;

  const cols = headers || Object.keys(rows[0]);
  const escapeCell = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    cols.map(escapeCell).join(","),
    ...rows.map((row) => cols.map((col) => escapeCell(row[col])).join(",")),
  ];

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
