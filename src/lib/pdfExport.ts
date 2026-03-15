// ---------------------------------------------------------------------------
// Client-side PDF export utility
// ---------------------------------------------------------------------------
// Dynamically imports html2canvas + jsPDF so they're only loaded when needed.

export async function exportElementToPdf(
  elementId: string,
  filename: string,
  onProgress?: (stage: "capturing" | "generating" | "done") => void
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  onProgress?.("capturing");

  const { default: html2canvas } = await import("html2canvas");
  const { default: jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  onProgress?.("generating");

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = 210; // A4 width mm
  const pageHeight = 297; // A4 height mm
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  let yOffset = 0;

  // First page
  pdf.addImage(imgData, "PNG", margin, margin, contentWidth, imgHeight);
  yOffset += pageHeight - margin * 2;

  // Additional pages if content overflows
  while (yOffset < imgHeight) {
    pdf.addPage();
    pdf.addImage(
      imgData,
      "PNG",
      margin,
      margin - yOffset,
      contentWidth,
      imgHeight
    );
    yOffset += pageHeight - margin * 2;
  }

  pdf.save(filename);
  onProgress?.("done");
}

// ---------------------------------------------------------------------------
// PNG export — captures an element as a PNG image
// ---------------------------------------------------------------------------

export async function exportElementToPng(
  elementId: string,
  filename: string,
  onProgress?: (stage: "capturing" | "done") => void
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  onProgress?.("capturing");

  const { default: html2canvas } = await import("html2canvas");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  // Convert canvas to blob and trigger download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onProgress?.("done");
  }, "image/png");
}
