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

export interface MiniMutasi {
  id: string;
  tipe: string; // TipeMutasi enum sebagai string
  qty: number; // signed
  referensi: string | null;
  keterangan: string | null;
  tanggal: string; // ISO
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
  recentMutasi: MiniMutasi[];
}