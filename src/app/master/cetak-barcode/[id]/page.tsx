"use client";
import { useParams, useSearchParams } from "next/navigation";
import Barcode from "react-barcode";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
export default function CetakBarcodePage() {
  // Ambil parameter ID dari URL
  const params = useParams();
  const id = params.id as string;
  // Ambil query parameter (nama & sku) dari URL
  const searchParams = useSearchParams();
  const nama = searchParams.get("nama") || "Nama Barang";
  const sku = searchParams.get("sku") || "SKU-000";
  // Auto-print saat halaman diload (Opsional, kalau mau otomatis)
  // useEffect(() => {
  //   setTimeout(() => window.print(), 500);
  // }, []);
  const handlePrint = () => {
    window.print();
  };
  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white flex flex-col items-center">

      {/* PANEL KONTROL (Disembunyikan saat di-print) */}
      <div className="w-full max-w-2xl mb-8 flex justify-between items-center print:hidden bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/master" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium">
          <ArrowLeft size={20} /> Kembali ke Master
        </Link>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-600/30"
        >
          <Printer size={18} /> Cetak Barcode
        </button>
      </div>
      {/* KERTAS PREVIEW BARCODE (Area yang akan di-print) */}
      <div className="bg-white p-10 rounded-2xl shadow-lg print:shadow-none print:p-4 border border-slate-200 print:border-none flex flex-col items-center justify-center text-center max-w-md w-full">
        <div className="mb-6">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">BCA Syariah - Logistik</p>
          <h2 className="text-xl font-black text-slate-800 leading-tight">{nama}</h2>
        </div>
        <div className="bg-white p-4 rounded-xl inline-block">
          <Barcode
            value={sku}
            format="CODE128"
            width={2.5}
            height={100}
            displayValue={true}
            background="#ffffff"
            lineColor="#0f172a" // slate-900
            margin={0}
            fontSize={16}
            fontOptions="bold"
          />
        </div>
        <div className="mt-8 text-[10px] text-slate-400 font-mono">
          Ref ID: {id}
        </div>
      </div>
    </div>
  );
}
