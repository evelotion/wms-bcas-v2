import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface FPKBData {
  referensi: string;
  tujuan: string;
  keterangan: string;
  qty: number;
  barangNama: string;
  barangSku: string;
  instruksiPicker: string[];
}

export const generateFPKB = (data: FPKBData) => {
  const doc = new jsPDF();

  // Header Dokumen
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BUKTI PENGELUARAN BARANG (FPKB)", 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`No. Referensi : ${data.referensi}`, 14, 30);
  doc.text(`Tujuan/Cabang : ${data.tujuan}`, 14, 36);
  doc.text(`Tanggal Cetak : ${new Date().toLocaleString("id-ID")}`, 14, 42);

  // Tabel Barang Keluar
  autoTable(doc, {
    startY: 50,
    head: [["Kode / SKU", "Nama Barang Terkait", "Qty Keluar", "Keterangan Tujuan"]],
    body: [
      [data.barangSku, data.barangNama, `${data.qty} Pcs`, data.keterangan]
    ],
    theme: "grid",
    headStyles: { fillColor: [234, 88, 12] }, // Warna Orange sesuai tema Outbound
    styles: { fontSize: 9 },
  });

  // Tabel Instruksi Pengambilan (Audit Trail Internal)
  const yAfterTable = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Audit Trail Lokasi Pengambilan (FIFO):", 14, yAfterTable);
  
  autoTable(doc, {
    startY: yAfterTable + 4,
    body: data.instruksiPicker.map((instruksi) => [instruksi]),
    theme: "plain",
    styles: { fontSize: 8, fontStyle: "italic", textColor: [100, 100, 100] },
  });

  // Tanda Tangan
  const finalY = (doc as any).lastAutoTable.finalY + 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  doc.text("Pemohon/Penerima,", 25, finalY, { align: "center" });
  doc.text("Disetujui Oleh (SPV),", 105, finalY, { align: "center" });
  doc.text("Diserahkan (IT/Gudang),", 185, finalY, { align: "center" });

  doc.text("(...................................)", 25, finalY + 25, { align: "center" });
  doc.text("(...................................)", 105, finalY + 25, { align: "center" });
  doc.text("(...................................)", 185, finalY + 25, { align: "center" });

  // Eksekusi Download
  doc.save(`${data.referensi}_FPKB.pdf`);
};