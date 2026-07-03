import dynamic from "next/dynamic";

const CetakBarcodeClient = dynamic(() => import("./CetakBarcodeClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-slate-500 font-bold">Memuat halaman cetak...</div>
    </div>
  ),
});

export async function generateStaticParams() {
  return [];
}

export default function CetakBarcodePage() {
  return <CetakBarcodeClient />;
}
