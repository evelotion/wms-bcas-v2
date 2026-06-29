"use client";

import { useParams, useSearchParams } from "next/navigation";
import Barcode from "react-barcode";
import QRCode from "react-qr-code"; // Library baru untuk QR
import { Printer, ArrowLeft, QrCode as QrCodeIcon, Barcode as BarcodeIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function CetakBarcodePage() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const nama = searchParams.get("nama") || "Nama Barang";
  const sku = searchParams.get("sku") || "SKU-000";

  // State buat nentuin mau nampilin apa
  const [printType, setPrintType] = useState<"barcode" | "qrcode">("barcode");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white flex flex-col items-center">

      {/* PANEL KONTROL (Disembunyikan saat di-print) */}
      <div className="w-full max-w-3xl mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden bg-white p-4 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-4">
        <Link href="/master" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium">
          <ArrowLeft size={20} /> Kembali
        </Link>

        {/* TOGGLE BARCODE / QR CODE */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setPrintType("barcode")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${printType === "barcode" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <BarcodeIcon size={18} /> Barcode
          </button>
          <button
            onClick={() => setPrintType("qrcode")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${printType === "qrcode" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <QrCodeIcon size={18} /> QR Code
          </button>
        </div>

        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-600/30"
        >
          <Printer size={18} /> Cetak {printType === 'barcode' ? 'Barcode' : 'QR'}
        </button>
      </div>

      {/* KERTAS PREVIEW (Area yang akan di-print) */}
      <div className="bg-white p-10 rounded-2xl shadow-lg print:shadow-none print:p-4 border border-slate-200 print:border-none flex flex-col items-center justify-center text-center max-w-md w-full">
        <div className="mb-6">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">BCA Syariah - Logistik</p>
          <h2 className="text-xl font-black text-slate-800 leading-tight">{nama}</h2>
        </div>

        <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center w-full min-h-[160px]">
          {printType === "barcode" ? (
            <Barcode
              value={sku}
              format="CODE128"
              width={2.5}
              height={90}
              displayValue={true}
              background="#ffffff"
              lineColor="#0f172a"
              margin={0}
              fontSize={16}
              fontOptions="bold"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 animate-in zoom-in duration-300">
              <QRCode
                value={sku}
                size={160}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H" // High error correction
              />
              <span className="font-mono font-bold text-lg text-slate-800 tracking-wider uppercase mt-2">
                {sku}
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 text-[10px] text-slate-400 font-mono">
          Ref ID: {id}
        </div>
      </div>

    </div>
  );
}
