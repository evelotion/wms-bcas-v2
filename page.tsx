import { prisma } from './prisma';
import { notFound } from 'next/navigation';

// Ini adalah tipe props untuk halaman dengan parameter dinamis dan query
interface CetakBarcodePageProps {
  params: {
    id: string; // Ini adalah segmen dinamis [id] dari URL
  };
  searchParams: {
    nama?: string; // Ini adalah query ?nama=...
    sku?: string;  // Ini adalah query ?sku=...
  };
}

export default async function CetakBarcodePage({ params, searchParams }: CetakBarcodePageProps) {
  const { id } = params;
  const { nama, sku } = searchParams;

  // Ambil data barang dari database untuk memastikan barangnya ada
  const barang = await prisma.master_Barang.findUnique({
    where: { id },
  });

  // Jika barang dengan ID tersebut tidak ditemukan di database, tampilkan 404
  if (!barang) {
    notFound();
  }

  // Jika nama dan SKU tidak ada di URL, kita bisa ambil dari data barang
  const displayName = nama || barang.nama;
  const displaySku = sku || barang.sku;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Cetak Barcode</h1>
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <div className="text-center">
          <p className="text-lg font-semibold">{displayName}</p>
          <p className="text-gray-600 mb-4">{displaySku}</p>

          {/* 
            Di sini lo bisa pasang komponen barcode, misalnya pakai react-barcode.
            Contoh: <Barcode value={displaySku} /> 
          */}
          <div className="flex justify-center items-center h-24 bg-gray-100 border-dashed border-2 my-4">
            <p className="text-gray-500">Tempat Komponen Barcode</p>
          </div>
        </div>
      </div>
    </div>
  );
}