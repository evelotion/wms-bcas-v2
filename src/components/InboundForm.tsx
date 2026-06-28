'use client';

import { useState, useEffect } from 'react';

// Tipe data ini hanya contoh, sesuaikan dengan data master barang lo
interface MasterBarang {
  id: string;
  nama: string;
}

interface InboundFormProps {
  products: MasterBarang[]; // Lo perlu passing data master barang ke sini
}

export default function InboundForm({ products }: InboundFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [lastSerial, setLastSerial] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Efek ini akan berjalan setiap kali user memilih produk yang berbeda
  useEffect(() => {
    if (!selectedProductId) {
      setLastSerial(null);
      return;
    }

    const fetchLastSerial = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/master/last-serial/${selectedProductId}`);
        if (!response.ok) throw new Error('Gagal memuat data');
        const data = await response.json();
        setLastSerial(data.last_serial);
      } catch (error) {
        console.error(error);
        setLastSerial('Gagal memuat');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLastSerial();
  }, [selectedProductId]);

  return (
    <form className="space-y-4">
      <div>
        <label htmlFor="product" className="block text-sm font-medium text-gray-700">Pilih Produk</label>
        <select
          id="product"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
        >
          <option value="">-- Pilih Barang --</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.nama}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nomorator_awal" className="block text-sm font-medium text-gray-700">Nomorator Awal</label>
          <input type="text" name="nomorator_awal" id="nomorator_awal" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
        <div>
          <label htmlFor="nomorator_akhir" className="block text-sm font-medium text-gray-700">Nomorator Akhir</label>
          <input type="text" name="nomorator_akhir" id="nomorator_akhir" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
      </div>
      
      {selectedProductId && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
          {isLoading ? (
            <p>Memuat nomorator terakhir...</p>
          ) : (
            <p>Info: Nomorator terakhir untuk produk ini adalah <strong>{lastSerial || 'Belum ada'}</strong></p>
          )}
        </div>
      )}

      <div className="pt-4">
        <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
          Simpan Inbound
        </button>
      </div>
    </form>
  );
}