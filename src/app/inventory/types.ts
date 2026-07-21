export interface Lokasi {
  gudang: string;
  rak: string;
  lorong: string;
}

export interface BatchBarang {
  id: string;
  qty_sisa: number;
  harga_satuan: number; // <-- Tambahan
  tanggal_masuk: string | null;
  lokasi: Lokasi | null;
}

export interface InventoryItem {
  id: string;
  sku: string;
  nama: string;
  kategori: string;
  satuan: string;
  satuan_besar: string | null;
  isi_per_satuan_besar: number;
  batas_minimum: number;
  totalStok: number;
  totalNilai: number; // <-- Tambahan (Total Aset = Qty * Harga per Batch)
  batch_Barang: BatchBarang[];
}