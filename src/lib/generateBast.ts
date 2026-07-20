import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface BASTItem {
  kode: string;
  nama: string;
  qty: number;
  unit?: string;
  spesifikasi?: string;
  keterangan: string;
}

export interface BASTData {
  nomorBast: string;
  namaPenerima?: string; // Dikosongin dulu kalau data belum valid
  noDokumenFpkb: string;
  tglDokumen: string;
  cabang: string;
  jenisAset?: string; // default "Non Aktiva"
  items: BASTItem[];
  namaMenyerahkan?: string; // Admin Gudang
  jabatanMenyerahkan?: string;
}

const namaOrTitik = (nama?: string) => (nama && nama.trim() ? nama : "..........................");

// Dibuat otomatis dari data Realisasi di FPKB yang sama - dipanggil setelah
// Admin Gudang selesai adjustment, khusus buat cabang NON_JABODETABEK.
export const generateBAST = (data: BASTData) => {
  const doc = new jsPDF("p", "mm", "a4");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BCAsyariah", 14, 20);

  doc.setFontSize(14);
  doc.text("BERITA ACARA SERAH TERIMA BARANG", 105, 30, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text(`No. ${data.nomorBast}`, 105, 36, { align: "center" });
  doc.setFont("helvetica", "normal");

  // --- A. INFORMASI PENERIMA ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("A. INFORMASI PENERIMA", 14, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Nama", 14, 55);                 doc.text(`: ${namaOrTitik(data.namaPenerima)}`, 55, 55);
  doc.text("No Dokumen & Tanggal", 14, 61);  doc.text(`: ${data.noDokumenFpkb}`, 55, 61);
  doc.text("Perihal", 14, 67);               doc.text(`: Barang Cetakan`, 55, 67);

  doc.text("Tgl Dokumen Diterima", 120, 55); doc.text(`: ${data.tglDokumen}`, 165, 55);
  doc.text("Cabang/Unit Kerja", 120, 61);    doc.text(`: ${data.cabang}`, 165, 61);
  doc.text("Jenis Aset", 120, 67);           doc.text(`: ${data.jenisAset || "Non Aktiva"}`, 165, 67);

  // --- B. DETAIL BARANG ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("B. DETAIL BARANG YANG DISERAHKAN", 14, 77);

  const tableBody = data.items.map((item, index) => [
    index + 1,
    item.kode,
    item.nama,
    item.qty,
    item.unit || "",
    item.spesifikasi || "",
    item.keterangan || "",
  ]);

  autoTable(doc, {
    startY: 80,
    head: [["No", "Kode Barang", "Nama Barang", "Qty", "Unit", "Spesifikasi", "Keterangan"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8, cellPadding: 2, textColor: 0, lineColor: [150, 150, 150] },
    columnStyles: { 0: { halign: 'center' }, 3: { halign: 'center' } },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 12;

  // --- C. PERNYATAAN PENERIMA ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("C. PERNYATAAN PENERIMA", 14, currentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Saya bertanggung jawab atas barang yang diterima, dan memastikan barang sudah dicheck dan diterima dalam keadaan baik.", 14, currentY + 6);

  // --- D. SERAH TERIMA BARANG ---
  currentY += 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("D. SERAH TERIMA BARANG", 14, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Tanggal :", 20, currentY + 8);
  doc.text("Tanggal :", 115, currentY + 8);

  doc.rect(14, currentY + 12, 85, 40);
  doc.rect(110, currentY + 12, 85, 40);

  doc.setFont("helvetica", "bold");
  doc.text("Menyerahkan", 45, currentY + 18, { align: "center" });
  doc.text("Menerima", 152, currentY + 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.text(namaOrTitik(data.namaMenyerahkan), 45, currentY + 40, { align: "center" });
  doc.text(data.jabatanMenyerahkan || "Staff Gudang", 45, currentY + 45, { align: "center" });

  doc.text("..........................", 152, currentY + 40, { align: "center" });

  const safeFilename = data.nomorBast.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  doc.save(`BAST_${safeFilename}.pdf`);
};
