"use client";

import { useParams, useSearchParams } from "next/navigation";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { Printer, ArrowLeft, QrCode as QrCodeIcon, Barcode as BarcodeIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

type Ukuran = "kecil" | "sedang" | "besar";

const UKURAN_PRESET: Record<Ukuran, { label: string; dim: string; barcodeHeight: number; qrSize: number }> = {
  kecil: { label: "Kecil (40×20mm)", dim: "40mm x 20mm", barcodeHeight: 40, qrSize: 90 },
  sedang: { label: "Sedang (60×30mm)", dim: "60mm x 30mm", barcodeHeight: 60, qrSize: 120 },
  besar: { label: "Besar (80×50mm)", dim: "80mm x 50mm", barcodeHeight: 90, qrSize: 160 },
};

export default function CetakBarcodeClient() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const nama = searchParams.get("nama") || "Nama Barang";
  const sku = searchParams.get("sku") || "SKU-000";

  const [printType, setPrintType] = useState<"barcode" | "qrcode">("barcode");
  const [ukuran, setUkuran] = useState<Ukuran>("sedang");
  const [jumlahCopy, setJumlahCopy] = useState(1);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrUrl(`${window.location.origin}/master/detail/${id}`);
    }
  }, [id]);

  const handlePrint = () => window.print();

  if (!qrUrl) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <p className="font-bold">Memuat halaman cetak...</p>
        </div>
      </div>
    );
  }

  const preset = UKURAN_PRESET[ukuran];

  const Label = () => (
    <div className="bg-white flex flex-col items-center justify-center text-center p-6 border border-slate-200 rounded-xl print:border print:border-slate-300 print:rounded-none">
      <h2 className="text-base font-black text-slate-900 leading-tight mb-3">{nama}</h2>
      <div className="flex flex-col items-center justify-center">
        {printType === "barcode" ? (
          <Barcode
            value={sku}
            format="CODE128"
            width={2}
            height={preset.barcodeHeight}
            displayValue={true}
            background="#ffffff"
            lineColor="#000000"
            margin={0}
            fontSize={14}
            fontOptions="bold"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <QRCode value={qrUrl} size={preset.qrSize} bgColor="#ffffff" fgColor="#000000" level="M" />
            <span className="font-mono font-bold text-sm text-black tracking-wider uppercase mt-1">{sku}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white flex flex-col items-center gap-6">

      {/* TOOLBAR */}
      <div className="no-print w-full max-w-3xl glass-panel rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/master" className="p-2 bg-white rounded-xl shadow-sm text-slate-500 hover:text-blue-600 transition-colors shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-slate-800 truncate">Cetak Label Barang</h1>
        </div>
        <button
          onClick={handlePrint}
          className="shrink-0 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30"
        >
          <Printer size={18} /> Cetak
        </button>
      </div>

      {/* PANEL KONTROL */}
      <div className="no-print w-full max-w-3xl glass-panel rounded-2xl p-6 flex flex-col sm:flex-row flex-wrap gap-6">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tipe</p>
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setPrintType("barcode")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                printType === "barcode" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <BarcodeIcon size={16} /> Barcode
            </button>
            <button
              onClick={() => setPrintType("qrcode")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                printType === "qrcode" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <QrCodeIcon size={16} /> QR Code
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Ukuran Label</p>
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            {(Object.keys(UKURAN_PRESET) as Ukuran[]).map((key) => (
              <button
                key={key}
                onClick={() => setUkuran(key)}
                className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-all ${
                  ukuran === key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {UKURAN_PRESET[key].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Jumlah Copy</p>
          <input
            type="number"
            min={1}
            max={20}
            value={jumlahCopy}
            onChange={(e) => setJumlahCopy(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            className="w-24 bg-white/70 border border-slate-200 rounded-xl px-4 py-2 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm font-bold transition-all"
          />
        </div>
      </div>

      {/* PREVIEW CETAK */}
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl p-8 print:border-0 print:rounded-none print:p-0">
        {jumlahCopy > 1 ? (
          <div className="grid grid-cols-2 gap-4 print:gap-2">
            {Array.from({ length: jumlahCopy }).map((_, i) => (
              <Label key={i} />
            ))}
          </div>
        ) : (
          <Label />
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
          }
        }
      `}</style>
    </div>
  );
}
