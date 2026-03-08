function triggerBlobDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function buildHtmlDocument(title, bodyHtml) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 24px; color: #111827; }
    h1, h2, h3 { margin-top: 16px; }
    pre { white-space: pre-wrap; word-break: break-word; }
    ul { margin-left: 18px; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

export function exportRichTextDocument({
  filenameBase,
  format,
  plainText,
  markdownText,
  htmlBody,
  title,
}) {
  const safeBase = String(filenameBase || "download")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "download";
  const safeTitle = String(title || filenameBase || "AfyaLink Export");
  const htmlDoc = buildHtmlDocument(safeTitle, htmlBody || `<pre>${String(plainText || "")}</pre>`);

  if (format === "pdf") {
    const win = window.open("", "_blank");
    if (!win) {
      throw new Error("Pop-up blocked. Allow pop-ups to export as PDF.");
    }
    win.document.open();
    win.document.write(htmlDoc);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 120);
    return;
  }

  if (format === "md") {
    triggerBlobDownload(
      `${safeBase}.md`,
      new Blob([markdownText || plainText || ""], { type: "text/markdown;charset=utf-8" }),
    );
    return;
  }

  if (format === "html") {
    triggerBlobDownload(
      `${safeBase}.html`,
      new Blob([htmlDoc], { type: "text/html;charset=utf-8" }),
    );
    return;
  }

  if (format === "doc") {
    triggerBlobDownload(
      `${safeBase}.doc`,
      new Blob([htmlDoc], { type: "application/msword;charset=utf-8" }),
    );
    return;
  }

  triggerBlobDownload(
    `${safeBase}.txt`,
    new Blob([plainText || ""], { type: "text/plain;charset=utf-8" }),
  );
}
