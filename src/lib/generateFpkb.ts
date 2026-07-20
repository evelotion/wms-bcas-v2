import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface FPKBItem {
  kode: string;
  nama: string;
  jumlahPack: number | string;
  jumlahSatuan: string;
  hargaSatuan: number;
  total: number;
  realisasiPack?: number | string; // Kosong = belum di-adjustment Admin Gudang
  realisasiSatuan?: string;
  keterangan: string;
}

export interface FPKBData {
  nomorFpkb: string;
  noFpp?: string;
  tglRequest: string;
  cabang: string;
  pic?: string; // Dikosongin dulu kalau data belum valid
  items: FPKBItem[];
  grandTotal: number;
  // Semua nama penandatangan OPSIONAL - dikosongin (garis titik-titik) kalau nggak diisi
  pembuat?: string;
  verifikator?: string;
  penyetuju?: string;
  penyerahLogistik?: string;
}

const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(angka);
};

const namaOrTitik = (nama?: string) => (nama && nama.trim() ? nama : "..........................");

export const generateFPKB = (data: FPKBData) => {
  const doc = new jsPDF("p", "mm", "a4");

  // --- KOP SURAT ---
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BCAsyariah", 14, 20);

  doc.setFontSize(12);
  doc.text("FORM PERSETUJUAN KELUAR BARANG", 105, 20, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`No. ${data.nomorFpkb}`, 105, 25, { align: "center" });

  // --- A. INFORMASI PERMINTAAN ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("A. INFORMASI PERMINTAAN", 14, 35);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text("Media Request", 14, 42);      doc.text(`: FPP`, 45, 42);
  doc.text("No Dokumen (FPP)", 14, 47);   doc.text(`: ${data.noFpp || '-'}`, 45, 47);
  doc.text("Tgl Dokumen", 14, 52);        doc.text(`: ${data.tglRequest}`, 45, 52);
  doc.text("Cabang/Unit Kerja", 14, 57);  doc.text(`: ${data.cabang}`, 45, 57);

  doc.text("Tgl Request", 120, 42);       doc.text(`: ${data.tglRequest}`, 145, 42);
  doc.text("PIC Unit Kerja", 120, 47);    doc.text(`: ${namaOrTitik(data.pic)}`, 145, 47);
  doc.text("Jenis Permintaan", 120, 52);  doc.text(`: Existing`, 145, 52);
  doc.text("Ketersediaan", 120, 57);      doc.text(`: [ V ] Ada     [   ] Tidak Ada`, 145, 57);

  // --- B. DETAIL PERSETUJUAN BARANG (+ kolom Realisasi) ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("B. DETAIL PERSETUJUAN BARANG*", 14, 67);

  const tableBody = data.items.map((item, index) => [
    index + 1,
    item.kode,
    item.nama,
    item.jumlahPack || "-",
    item.jumlahSatuan,
    formatRupiah(item.hargaSatuan),
    formatRupiah(item.total),
    item.realisasiPack ?? "",
    item.realisasiSatuan ?? "",
    item.keterangan || "",
  ]);

  tableBody.push(["", "", "", "", "", "Grand Total", formatRupiah(data.grandTotal), "", "", ""]);

  autoTable(doc, {
    startY: 70,
    head: [["No.", "Kode Barang", "Nama Barang", "Jml Pack", "Jml Satuan", "Harga Satuan", "Total", "Realisasi Pack", "Realisasi Satuan", "Keterangan"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 1.5, textColor: 0, lineColor: [150, 150, 150] },
    columnStyles: {
      0: { halign: 'center' },
      3: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'center' },
      8: { halign: 'center' },
    },
    didParseCell: function (cellData) {
      if (cellData.row.index === tableBody.length - 1) {
        cellData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 10;

  if (currentY > 180) {
    doc.addPage();
    currentY = 20;
  }

  // --- C. PENGELUARAN & SERAH TERIMA BARANG ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("C. PENGELUARAN & SERAH TERIMA BARANG", 14, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.rect(14, currentY + 3, 182, 35);

  doc.text("Diserahkan", 20, currentY + 8);
  doc.text("(Logistik/Admin Gudang)", 20, currentY + 12);
  doc.text("Tgl:", 20, currentY + 26);
  doc.text(namaOrTitik(data.penyerahLogistik), 20, currentY + 32);

  doc.text("Diterima", 90, currentY + 8);
  doc.text("(Penerima/Cabang)", 90, currentY + 12);
  doc.text("Tgl:", 90, currentY + 26);
  doc.text("..........................", 90, currentY + 32);

  doc.text("No. BAST : ..............................................", 140, currentY + 8);
  doc.text("No. AWB   : ..............................................", 140, currentY + 16);

  // --- TANDA TANGAN APPROVAL ---
  currentY += 45;

  doc.text("Dibuat", 20, currentY);
  doc.text("(Staf)", 20, currentY + 4);
  doc.text("Tgl:", 20, currentY + 15);
  doc.text(namaOrTitik(data.pembuat), 20, currentY + 25);

  doc.text("Diverifikasi", 80, currentY);
  doc.text("(SPV Logistik)", 80, currentY + 4);
  doc.text("Tgl:", 80, currentY + 15);
  doc.text(namaOrTitik(data.verifikator), 80, currentY + 25);

  doc.text("Disetujui", 140, currentY);
  doc.text("(Ka Bid/Dept Logistik)", 140, currentY + 4);
  doc.text("Tgl:", 140, currentY + 15);
  doc.text(namaOrTitik(data.penyetuju), 140, currentY + 25);

  // --- KETENTUAN ---
  currentY += 32;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Ketentuan:", 14, currentY);

  doc.setFont("helvetica", "normal");
  doc.text("*) Kolom Realisasi diisi Admin Gudang sesuai stok yang benar-benar dikeluarkan.", 14, currentY + 4);
  doc.text("Kolom Realisasi kosong berarti FPKB ini belum melalui proses adjustment.", 14, currentY + 8);

  const safeFilename = data.nomorFpkb.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  doc.save(`FPKB_${safeFilename}.pdf`);
};
