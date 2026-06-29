"use client";

import React, { useEffect, useState } from "react";
import { getDaftarPermintaan, approvePermintaan, getPermintaanFormData, createFppBaru } from "./actions";
import { Prisma } from "@prisma/client";
import { generateFPKB } from "@/lib/generateFpkb";
import { ClipboardList, CircleCheck as CheckCircle, Clock, FilePlus, Trash2, CreditCard as Edit3, ChevronRight, Plus, X, Save } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

type PermintaanWithDetails = Prisma.Permintaan_HeaderGetPayload<{
  include: { details: { include: { barang: true } } }
}>;
type MasterBarang = Prisma.Master_BarangGetPayload<{}>;

export default function RequisitionPage() {
  const [permintaanList, setPermintaanList] = useState<PermintaanWithDetails[]>([]);
  const [masterBarang, setMasterBarang] = useState<MasterBarang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // State untuk modal adjustment
  const [activeReq, setActiveReq] = useState<PermintaanWithDetails | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

  // === STATE UNTUK MODAL INPUT FPP BARU ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fppItems, setFppItems] = useState([{ barangId: "", qty: 1 }]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [requests, formData] = await Promise.all([
      getDaftarPermintaan(),
      getPermintaanFormData()
    ]);
    setPermintaanList(requests as PermintaanWithDetails[] || []);
    setMasterBarang(formData.barang || []);
    setIsLoading(false);
  };

  // --- LOGIC MODAL ADJUSTMENT ---
  const openAdjustment = (req: PermintaanWithDetails) => {
    setActiveReq(req);
    const initAdj: Record<string, number> = {};
    req.details.forEach(d => { initAdj[d.id] = d.qty_diminta; });
    setAdjustments(initAdj);
  };

  const closeAdjustment = () => {
    setActiveReq(null);
    setAdjustments({});
  };

  const handleQtyChange = (detailId: string, value: number) => {
    setAdjustments(prev => ({ ...prev, [detailId]: Math.max(0, value) }));
  };

  const handleDeleteItem = (detailId: string) => {
    setAdjustments(prev => ({ ...prev, [detailId]: 0 }));
  };

  const handleApprove = async () => {
    if (!activeReq) return;
    if (!confirm("Proses FPKB ini? Barang yang dihapus/dikurangi akan masuk ke Outstanding.")) return;
    setProcessingId(activeReq.id);

    const formattedAdjustments = Object.entries(adjustments).map(([id, val]) => ({
      detailId: id, qtyDisetujui: val
    }));

    const res = await approvePermintaan(activeReq.id, formattedAdjustments);

    if (res.success && res.rawDetails) {
      alert(`Approval Berhasil! Nomor FPKB: ${res.nomor_fpkb}`);

      const approvedItems = res.rawDetails.filter((d: any) => d.qty_disetujui > 0);
      let grandTotal = 0;

      const pdfItems = approvedItems.map((d: any) => {
        const harga = d.harga_satuan || 0;
        const totalBarang = d.qty_disetujui * harga;
        grandTotal += totalBarang;
        return {
          kode: d.barang?.sku || "N/A",
          nama: d.barang?.nama || "Item Unknown",
          jumlahPack: d.qty_disetujui,
          jumlahSatuan: `${d.qty_disetujui} ${d.barang?.satuan || 'Pcs'}`,
          hargaSatuan: harga,
          total: totalBarang,
          keterangan: ""
        };
      });

      generateFPKB({
        nomorFpkb: res.nomor_fpkb || "DRAFT-FPKB",
        noFpp: activeReq.nomor_fpp,
        tglRequest: new Date(activeReq.createdAt).toLocaleDateString("id-ID"),
        cabang: activeReq.cabang,
        pic: activeReq.pic_nama || "PIC Cabang",
        items: pdfItems,
        grandTotal: grandTotal,
        pembuat: "Admin Gudang"
      });

      closeAdjustment();
      fetchData();
    } else {
      alert("Error: " + res.error);
    }
    setProcessingId(null);
  };

  // --- LOGIC SUBMIT FPP BARU ---
  const handleAddFppItem = () => {
    setFppItems([...fppItems, { barangId: "", qty: 1 }]);
  };

  const handleRemoveFppItem = (index: number) => {
    setFppItems(fppItems.filter((_, i) => i !== index));
  };

  const handleFppItemChange = (index: number, field: string, value: any) => {
    const newItems = [...fppItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFppItems(newItems);
  };

  const handleSubmitNewFpp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validItems = fppItems.filter(item => item.barangId !== "" && item.qty > 0);
    if (validItems.length === 0) {
      alert("Pilih minimal 1 barang beserta jumlahnya!");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const headerData = {
      nomor_fpp: formData.get("nomor_fpp") as string,
      cabang: formData.get("cabang") as string,
      pic_nama: formData.get("pic_nama") as string,
    };

    const res = await createFppBaru(headerData, validItems);

    if (res.success) {
      alert("✅ Dokumen FPP berhasil disimpan sebagai DRAFT!");
      setIsModalOpen(false);
      setFppItems([{ barangId: "", qty: 1 }]);
      fetchData();
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full space-y-6 pb-10">

      {/* HEADER */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-blue-500">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Requisition Form</h1>
            <p className="text-sm text-slate-500">Klik FPP untuk review barang, edit nominal, dan cetak FPKB.</p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-white border border-slate-200 shadow-sm text-blue-600 hover:text-blue-700 hover:border-blue-300 font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
        >
          <FilePlus size={18} /> Input No. FPP Baru
        </button>
      </div>

      {/* TABLE FPP */}
      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Nomor FPP</th>
                <th className="px-6 py-4">Tgl Request</th>
                <th className="px-6 py-4">Cabang Pemohon</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8">Memuat data...</td></tr>
              ) : permintaanList.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Belum ada dokumen FPP masuk.</td></tr>
              ) : (
                permintaanList.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => openAdjustment(req)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-slate-800">{req.nomor_fpp}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(req.createdAt).toLocaleDateString('id-ID')}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{req.cabang} <span className="text-xs font-normal text-slate-400 block">PIC: {req.pic_nama}</span></td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><Clock size={12}/> PENDING</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="inline text-slate-400" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ADJUSTMENT FPP */}
      {activeReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Edit3 className="text-blue-600" size={22}/> Review & Adjustment
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{activeReq.nomor_fpp} — {activeReq.cabang}</p>
              </div>
              <button onClick={closeAdjustment} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              <table className="w-full text-left text-sm mb-4">
                <thead className="border-b border-slate-200 text-slate-500 text-xs">
                  <tr>
                    <th className="pb-2 font-medium">Item Barang</th>
                    <th className="pb-2 font-medium w-28 text-center">Permintaan</th>
                    <th className="pb-2 font-medium w-32 text-center">Disetujui (Adj)</th>
                    <th className="pb-2 font-medium w-16 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReq.details.map((d: any) => {
                    const isDeleted = adjustments[d.id] === 0;
                    return (
                      <tr key={d.id} className={`border-b border-slate-100 last:border-0 ${isDeleted ? 'opacity-40 bg-slate-50' : ''}`}>
                        <td className="py-3">
                          <div className={`font-medium ${isDeleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>{d.barang.nama}</div>
                          <div className="text-xs text-slate-500">{d.barang.sku}</div>
                        </td>
                        <td className="py-3 text-center font-bold text-slate-600">{d.qty_diminta}</td>
                        <td className="py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={d.qty_diminta}
                            value={adjustments[d.id]}
                            onChange={(e) => handleQtyChange(d.id, parseInt(e.target.value) || 0)}
                            disabled={isDeleted}
                            className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700 bg-slate-50 disabled:bg-slate-200"
                          />
                        </td>
                        <td className="py-3 text-center">
                          {!isDeleted ? (
                            <button
                              onClick={() => handleDeleteItem(d.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus / Masuk Outstanding"
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-orange-600">Terhapus</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={handleApprove}
                disabled={processingId === activeReq.id}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
              >
                {processingId === activeReq.id ? <Clock size={16} className="animate-spin"/> : <CheckCircle size={16}/>}
                Generate FPKB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INPUT FPP BARU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FilePlus className="text-blue-600" size={24}/> Form Input FPP Cabang
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              <form onSubmit={handleSubmitNewFpp} className="space-y-6">

                {/* Informasi Dokumen */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nomor Dokumen FPP</label>
                    <input name="nomor_fpp" type="text" required placeholder="Contoh: 154/FPP/LOG/2026" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cabang / Unit Kerja</label>
                    <input name="cabang" type="text" required placeholder="Contoh: KC Panakkukang" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nama PIC (Pemohon)</label>
                    <input name="pic_nama" type="text" required placeholder="Contoh: Dwi Bagus Hastomo" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" />
                  </div>
                </div>

                {/* Detail Barang */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-bold text-slate-800">Daftar Barang yang Diminta</label>
                    <button type="button" onClick={handleAddFppItem} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                      <Plus size={14}/> Tambah Baris
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fppItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-1 relative">
                          <SearchableSelect
                            name={`items[${index}][barangId]`}
                            options={masterBarang.map(b => ({ id: b.id, label: b.nama, sku: b.sku }))}
                            value={item.barangId}
                            onChange={(val) => handleFppItemChange(index, "barangId", val)}
                            placeholder="Ketik SKU atau Nama Barang..."
                          />
                        </div>
                        <div className="w-24 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleFppItemChange(index, "qty", parseInt(e.target.value) || 1)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-center font-bold"
                            required
                          />
                        </div>
                        {fppItems.length > 1 && (
                          <button type="button" onClick={() => handleRemoveFppItem(index)} className="shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={18}/>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-md shadow-blue-500/30 disabled:opacity-70">
                    <Save size={18} /> {isSubmitting ? "Menyimpan Dokumen..." : "Simpan FPP ke Antrean (Draft)"}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
