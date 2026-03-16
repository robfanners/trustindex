import { jsPDF } from "jspdf";

type CertificateData = {
  title: string;
  statement: string;
  verificationId: string;
  orgName: string;
  attestedBy: string;
  attestedAt: string;
  validUntil: string | null;
  trustScore: number | null;
  chainTxHash: string | null;
  chainStatus: string;
};

export function generateTrustCertificate(data: CertificateData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(22, 163, 106); // Verisum green
  doc.setLineWidth(1.5);
  doc.rect(10, 10, w - 20, h - 20);
  doc.setLineWidth(0.5);
  doc.rect(13, 13, w - 26, h - 26);

  // Header
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text("VERISUM", w / 2, 28, { align: "center" });

  doc.setFontSize(24);
  doc.setTextColor(30, 30, 30);
  doc.text("AI Governance Trust Certificate", w / 2, 42, { align: "center" });

  // Divider line
  doc.setDrawColor(22, 163, 106);
  doc.setLineWidth(0.8);
  doc.line(w / 2 - 40, 48, w / 2 + 40, 48);

  // Organisation
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text(data.orgName, w / 2, 62, { align: "center" });

  // Title
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text(data.title, w / 2, 72, { align: "center" });

  // Statement (wrapped)
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const lines = doc.splitTextToSize(data.statement, w - 80);
  doc.text(lines, w / 2, 84, { align: "center", maxWidth: w - 80 });

  // Trust Score badge (if available)
  const metaY = 120;
  if (data.trustScore !== null) {
    doc.setFontSize(11);
    doc.setTextColor(22, 163, 106);
    doc.text(`Trust Score: ${data.trustScore}/100`, w / 2, metaY, {
      align: "center",
    });
  }

  // Metadata grid
  const gridY = metaY + 14;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);

  const leftCol = w / 2 - 60;
  const rightCol = w / 2 + 10;

  doc.text("Verification ID:", leftCol, gridY);
  doc.setTextColor(30, 30, 30);
  doc.text(data.verificationId, leftCol, gridY + 5);

  doc.setTextColor(120, 120, 120);
  doc.text("Attested by:", rightCol, gridY);
  doc.setTextColor(30, 30, 30);
  doc.text(data.attestedBy, rightCol, gridY + 5);

  doc.setTextColor(120, 120, 120);
  doc.text("Date:", leftCol, gridY + 14);
  doc.setTextColor(30, 30, 30);
  doc.text(
    new Date(data.attestedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    leftCol,
    gridY + 19
  );

  if (data.validUntil) {
    doc.setTextColor(120, 120, 120);
    doc.text("Valid until:", rightCol, gridY + 14);
    doc.setTextColor(30, 30, 30);
    doc.text(
      new Date(data.validUntil).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      rightCol,
      gridY + 19
    );
  }

  // Chain anchoring status
  if (data.chainStatus === "anchored" && data.chainTxHash) {
    doc.setFontSize(8);
    doc.setTextColor(22, 163, 106);
    doc.text(
      `Blockchain anchored: ${data.chainTxHash.slice(0, 18)}...`,
      w / 2,
      gridY + 32,
      { align: "center" }
    );
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Verify at app.verisum.org/verify/${data.verificationId}`,
    w / 2,
    h - 20,
    { align: "center" }
  );

  return doc;
}
