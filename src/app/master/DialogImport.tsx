"use client";

import { useState, useRef } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { importDataAwal } from "./import-actions";

export default function DialogImport({ onRefresh }: { onRefresh: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FUNGSI KHUSUS BACA FORMAT PRN BCA SYARIAH (DARI V1 LO BRO!)
  const parsePRN = (text: string) => {
    const lines = text.split('\n');
    let isDataMode = false;
    
    // FIX: Tambahin ': any[]' biar TypeScript nggak error implicit any array
    const parsedData: any[] = []; 

    for (let line of lines) {
      if (line.startsWith('---')) {
        isDataMode = true;
        continue;
      }
      if (line.includes('Total') || line.startsWith('===')) {
        isDataMode = false;
        continue;
      }

      if (isDataMode && line.trim().length > 20) {
        const kode_barang = line.substring(4, 15).trim();
        const nama_barang = line.substring(16, 45).trim();
        const satuan = line.substring(46, 56).trim();
        const nomorator = line.substring(57, 86).trim();
        const stok_min = parseInt(line.substring(87, 96).replace(/,/g, '')) || 0;
        const stok = parseInt(line.substring(97, 107).replace(/,/g, '')) || 0;
        const harga_satuan = parseFloat(line.substring(108, 122).replace(/,/g, '')) || 0;
        const supplier = line.substring(137).trim();

        if (kode_barang && nama_barang) {
          parsedData.push({
            kode_barang, nama_barang, satuan, nomorator, stok_min, stok, harga_satuan, supplier
          });
        }
      }
    }
    return parsedData;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      let formattedData: any[] = [];

      // CEK APAKAH FILE PRN ATAU EXCEL
      if (file.name.toUpperCase().endsWith('.PRN')) {
        const textData = await file.text();
        formattedData = parsePRN(textData);
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        let headerRowIndex = -1;
        for (let i = 0; i < rawData.length; i++) {
          if (!rawData[i]) continue;
          const rowString = rawData[i].map(String).join(" ").toLowerCase();
          if (rowString.includes("kode") && rowString.includes("nama")) {
            headerRowIndex = i; break;
          }
        }

        if (headerRowIndex !== -1) {
          const headers = rawData[headerRowIndex].map(h => h ? String(h).trim().toLowerCase() : "");
          const colIdx = {
            kode: headers.findIndex(h => h.includes("kode")),
            nama: headers.findIndex(h => h.includes("nama")),
            satuan: headers.findIndex(h => h.includes("satuan")),
            stok: headers.findIndex(h => h.includes("jumlah") || h.includes("stok")),
            stok_min: headers.findIndex(h => h.includes("min")),
            harga: headers.findIndex(h => h.includes("harga")),
            kondisi: headers.findIndex(h => h.includes("kondisi")),
            keterangan: headers.findIndex(h => h.includes("keterangan") || h.includes("nomorator")),
            supplier: headers.findIndex(h => h.includes("supplier") || h.includes("vendor"))
          };

          for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            const kodeVal = colIdx.kode >= 0 ? row[colIdx.kode] : null;
            const namaVal = colIdx.nama >= 0 ? row[colIdx.nama] : null;
            if (!kodeVal || !namaVal) continue; 
            
            let ketVal = "";
            if (colIdx.keterangan >= 0 && row[colIdx.keterangan]) ketVal += row[colIdx.keterangan];
            if (colIdx.kondisi >= 0 && row[colIdx.kondisi]) ketVal += (ketVal ? " - " : "") + row[colIdx.kondisi];

            formattedData.push({
              kode_barang: String(kodeVal).trim().toUpperCase(),
              nama_barang: String(namaVal).trim(),
              satuan: colIdx.satuan >= 0 && row[colIdx.satuan] ? String(row[colIdx.satuan]).trim() : "Pcs",
              stok: colIdx.stok >= 0 ? (Number(row[colIdx.stok]) || 0) : 0,
              stok_min: colIdx.stok_min >= 0 ? (Number(row[colIdx.stok_min]) || 0) : 0,
              harga_satuan: colIdx.harga >= 0 ? (Number(row[colIdx.harga]) || 0) : 0,
              nomorator: ketVal.trim(),
              supplier: colIdx.supplier >= 0 && row[colIdx.supplier] ? String(row[colIdx.supplier]).trim() : ""
            });
          }
        }
      }

      if (formattedData.length === 0) {
        alert("❌ Data kosong atau format tidak dikenali!");
        setLoading(false);
        return;
      }

      const res = await importDataAwal(formattedData);
      
      if (res.success) {
        alert(`✅ ${res.count} Barang (PRN/Excel) berhasil diproses ke Master & Ledger!`);
        setIsOpen(false);
        onRefresh(); // Refresh tabel master
      } else {
        alert("❌ " + res.error);
      }
    } catch (error) {
      alert("❌ Gagal memproses file.");
      console.error(error);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; 
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30">
        <FileUp size={18} /> Import .PRN / Excel
      </button>

      {/* FIX: Ubah z-50 jadi z-[100] biar pop-up nggak ketutup card tabel */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileUp className="text-emerald-600"/> Import Saldo Awal
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-8">
              <div 
                className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors cursor-pointer group"
                onClick={() => !loading && fileInputRef.current?.click()}
              >
                {loading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
                ) : (
                  <FileUp className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 mb-3 transition-colors" />
                )}
                <p className="text-sm font-bold text-slate-700">{loading ? "Memproses Data..." : "Klik untuk pilih file"}</p>
                <p className="text-xs text-slate-400 mt-1 text-center">Mendukung format .PRN (Sistem Legacy BCA Syariah) atau .XLSX</p>
                
                <input ref={fileInputRef} type="file" accept=".xlsx, .xls, .csv, .prn, .PRN" className="hidden" onChange={handleFileUpload} disabled={loading} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}