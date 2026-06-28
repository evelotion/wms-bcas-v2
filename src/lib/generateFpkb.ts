import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface FPKBItem {
  kode: string;
  nama: string;
  jumlahPack: number | string; // Pakai string biar bisa diisi "-" kalau kosong
  jumlahSatuan: string;
  hargaSatuan: number;
  total: number;
  keterangan: string;
}

export interface FPKBData {
  nomorFpkb: string;
  noFpp?: string;
  tglRequest: string;
  cabang: string;
  pic: string;
  items: FPKBItem[];
  grandTotal: number;
  pembuat: string;
}

const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(angka);
};

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
  
  // Kolom Kiri
  doc.text("Media Request", 14, 42);      doc.text(": FPP", 45, 42);
  doc.text("No Dokumen", 14, 47);         doc.text(`: ${data.noFpp || '-'}`, 45, 47);
  doc.text("Tgl Dokumen", 14, 52);        doc.text(`: ${data.tglRequest}`, 45, 52);
  doc.text("Cabang/Unit Kerja", 14, 57);  doc.text(`: ${data.cabang}`, 45, 57);

  // Kolom Kanan
  doc.text("Tgl Request", 120, 42);       doc.text(`: ${data.tglRequest}`, 150, 42);
  doc.text("PIC Unit Kerja", 120, 47);    doc.text(`: ${data.pic}`, 150, 47);
  doc.text("Jenis Permintaan", 120, 52);  doc.text(`: [ X ] Existing`, 150, 52);
  doc.text("Ketersediaan", 120, 57);      doc.text(`: [ X ] Ada   [ ] Tidak Ada`, 150, 57);

  // --- B. DETAIL PERSETUJUAN BARANG ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("B. DETAIL PERSETUJUAN BARANG", 14, 67);

  const tableBody = data.items.map((item, index) => [
    index + 1,
    item.kode,
    item.nama,
    item.jumlahPack || "-",
    item.jumlahSatuan,
    formatRupiah(item.hargaSatuan),
    formatRupiah(item.total),
    item.keterangan || "",
  ]);

  // Baris Grand Total
  tableBody.push([
    "", "", "", "", "", "Grand Total", formatRupiah(data.grandTotal), ""
  ]);

  autoTable(doc, {
    startY: 72,
    head: [["No.", "Kode Barang", "Nama Barang", "Jumlah Pack", "Jumlah Satuan", "Harga Satuan", "Total", "Keterangan"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' }, // Header tabel warna abu-abu
    styles: { fontSize: 8, cellPadding: 2, textColor: 0 },
    columnStyles: {
      0: { halign: 'center' },
      3: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    didParseCell: function(cellData) {
      if (cellData.row.index === tableBody.length - 1) {
        cellData.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // --- AREA TANDA TANGAN ---
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  
  // Baris 1
  doc.text("Dibuat", 25, finalY);
  doc.text("(User)", 25, finalY + 4);
  doc.text(data.pembuat, 25, finalY + 25);

  doc.text("Menyerahkan", 75, finalY);
  doc.text("(Logistik)", 75, finalY + 4);
  doc.text("(.......................)", 75, finalY + 25);

  doc.text("Diverifikasi", 125, finalY);
  doc.text("(SPV Logistik)", 125, finalY + 4);
  doc.text("(.......................)", 125, finalY + 25);

  doc.text("Disetujui", 175, finalY);
  doc.text("(Ka Bid/Dept Logistik)", 175, finalY + 4);
  doc.text("(.......................)", 175, finalY + 25);

  // Eksekusi Download
  const safeFilename = data.nomorFpkb.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  doc.save(`${safeFilename}.pdf`);
};