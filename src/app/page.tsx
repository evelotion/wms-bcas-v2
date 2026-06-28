"use client";

import { useSearchParams, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function CetakBarcodePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const nama = searchParams.get('nama');
  const sku = searchParams.get('sku');

  // Arahkan QR Code ke URL produksi Vercel
  const baseUrl = 'https://wms-bcas-v2.vercel.app';
  const qrUrl = `${baseUrl}/produk/${id}`;

  useEffect(() => {
    // Menunggu gambar QR dirender lalu trigger print
    setTimeout(() => {
      window.print();
    }, 500);
  }, []);

  if (!id || !nama || !sku) {
    return <div className="flex items-center justify-center h-screen">Memuat data...</div>;
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none; }
        }
        @page {
          size: 70mm 30mm; /* Ukuran stiker, sesuaikan jika perlu */
          margin: 0;
        }
      `}</style>
      <div className="no-print p-4 text-center text-slate-600 bg-slate-100">
        <p>Halaman ini akan otomatis tercetak. Jika tidak, tekan Ctrl/Cmd + P.</p>
        <p className="text-xs">Pastikan printer label Anda sudah terkonfigurasi dengan benar.</p>
      </div>
      <div className="w-[70mm] h-[30mm] p-2 flex items-center gap-2 font-sans bg-white">
        <div className="flex-shrink-0">
          <QRCodeSVG value={qrUrl} size={95} includeMargin={true} />
        </div>
        <div className="flex flex-col justify-center overflow-hidden">
          <p className="text-sm font-bold leading-tight truncate">{nama}</p>
          <p className="text-xs text-slate-600 font-mono bg-slate-100 px-1 py-0.5 rounded w-fit mt-1">{sku}</p>
        </div>
      </div>
    </>
  );
}