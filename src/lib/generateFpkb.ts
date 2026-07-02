import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface FPKBItem {
  kode: string;
  nama: string;
  jumlahPack: number | string;
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
  doc.text("Media Request", 14, 42);      doc.text(`: FPP`, 45, 42);
  doc.text("No Dokumen", 14, 47);         doc.text(`: ${data.noFpp || '-'}`, 45, 47);
  doc.text("Tgl Dokumen", 14, 52);        doc.text(`: ${data.tglRequest}`, 45, 52);
  doc.text("Cabang/Unit Kerja", 14, 57);  doc.text(`: ${data.cabang}`, 45, 57);

  // Kolom Kanan
  doc.text("Tgl Request", 120, 42);       doc.text(`: ${data.tglRequest}`, 145, 42);
  doc.text("PIC Unit Kerja", 120, 47);    doc.text(`: ${data.pic}`, 145, 47);
  doc.text("Jenis Permintaan", 120, 52);  doc.text(`: Existing`, 145, 52);
  
  // Checkbox Ketersediaan (V for checked)
  doc.text("Ketersediaan", 120, 57);      
  doc.text(`: [ V ] Ada     [   ] Tidak Ada`, 145, 57);

  // --- B. DETAIL PERSETUJUAN BARANG ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("B. DETAIL PERSETUJUAN BARANG*", 14, 67); // Tambah asterisk

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

  tableBody.push(["", "", "", "", "", "Grand Total", formatRupiah(data.grandTotal), ""]);

  autoTable(doc, {
    startY: 70,
    head: [["No.", "Kode Barang", "Nama Barang", "Jumlah Pack", "Jumlah Satuan", "Harga Satuan", "Total", "Keterangan"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8, cellPadding: 2, textColor: 0, lineColor: [150, 150, 150] },
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

  let currentY = (doc as any).lastAutoTable.finalY + 10;

  // Cek apakah sisa halaman cukup untuk blok Tanda Tangan (butuh sekitar 100mm)
  if (currentY > 180) {
    doc.addPage();
    currentY = 20;
  }

  // --- C. INSTALASI & SETUP ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("C. INSTALASI & SETUP", 14, currentY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  // Kotak C
  doc.rect(14, currentY + 3, 182, 25);
  doc.text("Menyerahkan", 20, currentY + 8);
  doc.text("(Logistik)", 20, currentY + 12);
  doc.text("Tgt:", 20, currentY + 20);
  doc.text("Ikbal Kurnia", 20, currentY + 26); // Hardcode sesuai contoh / bisa diganti dinamis

  doc.text("Diterima**", 70, currentY + 8);
  doc.text("(IT Support)", 70, currentY + 12);
  doc.text("Tgt:", 70, currentY + 20);
  doc.text("..........................", 70, currentY + 26);

  doc.text("Catatan IT:", 120, currentY + 8);

  // --- D. PENGELUARAN & SERAH TERIMA BARANG ---
  currentY += 35;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("D. PENGELUARAN & SERAH TERIMA BARANG", 14, currentY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  // Kotak D
  doc.rect(14, currentY + 3, 182, 35);
  
  doc.text("Diserahkan", 20, currentY + 8);
  doc.text("(Logistik)", 20, currentY + 12);
  doc.text("Tgt:", 20, currentY + 26);
  doc.text("Ikbal Kurnia", 20, currentY + 32);

  doc.text("Diserahkan**", 70, currentY + 8);
  doc.text("(IT)", 70, currentY + 12);
  doc.text("Tgt:", 70, currentY + 26);
  doc.text("..........................", 70, currentY + 32);

  doc.text("No. BAST : ..............................................", 120, currentY + 12);

  // --- TANDA TANGAN APPROVAL (Bawah Kotak) ---
  currentY += 45;
  
  // Dibuat
  doc.text("Dibuat", 20, currentY);
  doc.text("(User)", 20, currentY + 4);
  doc.text("Tgl:", 20, currentY + 15);
  doc.text(data.pembuat, 20, currentY + 25);

  // Diverifikasi
  doc.text("Diverifikasi", 80, currentY);
  doc.text("(SPV Logistik)", 80, currentY + 4);
  doc.text("Tgt:", 80, currentY + 15);
  doc.text("Novianti Siswandi", 80, currentY + 25);

  // Disetujui
  doc.text("Disetujui", 140, currentY);
  doc.text("(Ka Bid/Dept Logistik)", 140, currentY + 4);
  doc.text("Tgt:", 140, currentY + 15);
  doc.text("Dian .....................", 140, currentY + 25);

  // --- KETENTUAN (FOOTNOTE) ---
  currentY += 32;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Ketentuan:", 14, currentY);
  
  doc.setFont("helvetica", "normal");
  doc.text("*) Diisi oleh Logistik", 14, currentY + 4);
  doc.text("**) Diisi oleh IT jika membutuhkan proses instalasi & setup", 14, currentY + 8);
  doc.text("Mohon dapat dituliskan N/A secara manual jika :", 14, currentY + 12);
  doc.text("1. Kolom tanda tangan IT tidak diperlukan (Instalasi/Setup)", 14, currentY + 16);

  // Eksekusi Download
  const safeFilename = data.nomorFpkb.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  doc.save(`${safeFilename}.pdf`);
};