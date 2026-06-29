"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  getDaftarPermintaan,
  approvePermintaan,
  getPermintaanFormData,
  createFppBaru,
} from "./actions";
import { Prisma } from "@prisma/client";
import { generateFPKB } from "@/lib/generateFpkb";
import {
  ClipboardList,
  CheckCircle,
  Clock,
  FilePlus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Save,
  Search,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

type PermintaanWithDetails = Prisma.Permintaan_HeaderGetPayload<{
  include: { details: { include: { barang: true } } };
}>;
type MasterBarang = Prisma.Master_BarangGetPayload<{}>;

export default function RequisitionPage() {
  const [permintaanList, setPermintaanList] = useState<PermintaanWithDetails[]>(
    [],
  );
  const [masterBarang, setMasterBarang] = useState<MasterBarang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

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
      getPermintaanFormData(),
    ]);
    setPermintaanList((requests as PermintaanWithDetails[]) || []);
    setMasterBarang(formData.barang || []);
    setIsLoading(false);
  };

  const toggleRow = (id: string, details: any[]) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
      const initAdj: Record<string, number> = {};
      details.forEach((d) => {
        initAdj[d.id] = d.qty_diminta;
      });
      setAdjustments(initAdj);
    }
  };

  const handleQtyChange = (detailId: string, value: number) => {
    setAdjustments((prev) => ({ ...prev, [detailId]: Math.max(0, value) }));
  };

  const handleDeleteItem = (detailId: string) => {
    setAdjustments((prev) => ({ ...prev, [detailId]: 0 }));
  };

  const handleApprove = async (req: any) => {
    if (
      !confirm(
        "Proses FPKB ini? Barang yang dihapus/dikurangi akan masuk ke Outstanding.",
      )
    )
      return;
    setProcessingId(req.id);

    const formattedAdjustments = Object.entries(adjustments).map(
      ([id, val]) => ({
        detailId: id,
        qtyDisetujui: val,
      }),
    );

    const res = await approvePermintaan(req.id, formattedAdjustments);

    if (res.success && res.rawDetails) {
      alert(`Approval Berhasil! Nomor FPKB: ${res.nomor_fpkb}`);

      const approvedItems = res.rawDetails.filter(
        (d: any) => d.qty_disetujui > 0,
      );
      let grandTotal = 0;

      const pdfItems = approvedItems.map((d: any) => {
        const harga = d.harga_satuan || 0;
        const totalBarang = d.qty_disetujui * harga;
        grandTotal += totalBarang;
        return {
          kode: d.barang?.sku || "N/A",
          nama: d.barang?.nama || "Item Unknown",
          jumlahPack: d.qty_disetujui,
          jumlahSatuan: `${d.qty_disetujui} ${d.barang?.satuan || "Pcs"}`,
          hargaSatuan: harga,
          total: totalBarang,
          keterangan: "",
        };
      });

      generateFPKB({
        nomorFpkb: res.nomor_fpkb || "DRAFT-FPKB",
        tglRequest: new Date(req.createdAt).toLocaleDateString("id-ID"),
        cabang: req.cabang,
        pic: req.pic_nama || "PIC Cabang",
        items: pdfItems,
        grandTotal: grandTotal,
        pembuat: "Admin Gudang",
      });

      setExpandedRow(null);
      fetchData();
    } else {
      alert("Error: " + res.error);
    }
    setProcessingId(null);
  };

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

    const validItems = fppItems.filter(
      (item) => item.barangId !== "" && item.qty > 0,
    );
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
            <h1 className="text-2xl font-bold text-slate-800">
              Requisition Form
            </h1>
            <p className="text-sm text-slate-500">
              Klik FPP untuk review barang, edit nominal, dan cetak FPKB.
            </p>
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
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    Memuat data...
                  </td>
                </tr>
              ) : permintaanList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    Belum ada dokumen FPP masuk.
                  </td>
                </tr>
              ) : (
                permintaanList.map((req) => (
                  <React.Fragment key={req.id}>
                    <tr
                      onClick={() => toggleRow(req.id, req.details)}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${expandedRow === req.id ? "bg-blue-50/50" : ""}`}
                    >
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {req.nomor_fpp}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(req.createdAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {req.cabang}{" "}
                        <span className="text-xs font-normal text-slate-400 block">
                          PIC: {req.pic_nama}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit">
                          <Clock size={12} /> PENDING
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {expandedRow === req.id ? (
                          <ChevronUp className="inline text-slate-400" />
                        ) : (
                          <ChevronDown className="inline text-slate-400" />
                        )}
                      </td>
                    </tr>

                    {expandedRow === req.id && (
                      <tr className="bg-slate-50/50 border-b-2 border-b-blue-100">
                        <td colSpan={5} className="px-6 py-6">
                          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                              <Edit3 size={16} className="text-blue-600" />{" "}
                              Review & Adjustment Item
                            </h3>
                            <table className="w-full text-left text-sm mb-4">
                              <thead className="border-b border-slate-200 text-slate-500 text-xs">
                                <tr>
                                  <th className="pb-2 font-medium">
                                    Item Barang
                                  </th>
                                  <th className="pb-2 font-medium w-32 text-center">
                                    Permintaan
                                  </th>
                                  <th className="pb-2 font-medium w-32 text-center">
                                    Disetujui (Adj)
                                  </th>
                                  <th className="pb-2 font-medium w-16 text-center">
                                    Aksi
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {req.details.map((d: any) => {
                                  const isDeleted = adjustments[d.id] === 0;
                                  return (
                                    <tr
                                      key={d.id}
                                      className={`border-b border-slate-100 last:border-0 ${isDeleted ? "opacity-40 bg-slate-50" : ""}`}
                                    >
                                      <td className="py-3">
                                        <div
                                          className={`font-medium ${isDeleted ? "line-through text-slate-400" : "text-slate-800"}`}
                                        >
                                          {d.barang.nama}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {d.barang.sku}
                                        </div>
                                      </td>
                                      <td className="py-3 text-center font-bold text-slate-600">
                                        {d.qty_diminta}
                                      </td>
                                      <td className="py-3 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          max={d.qty_diminta}
                                          value={adjustments[d.id]}
                                          onChange={(e) =>
                                            handleQtyChange(
                                              d.id,
                                              parseInt(e.target.value) || 0,
                                            )
                                          }
                                          disabled={isDeleted}
                                          className="w-20 px-2 py-1 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700 bg-slate-50 disabled:bg-slate-200"
                                        />
                                      </td>
                                      <td className="py-3 text-center">
                                        {!isDeleted ? (
                                          <button
                                            onClick={() =>
                                              handleDeleteItem(d.id)
                                            }
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Hapus / Masuk Outstanding"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        ) : (
                                          <span className="text-xs font-semibold text-orange-600">
                                            Terhapus
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="flex justify-end pt-2 border-t border-slate-100">
                              <button
                                onClick={() => handleApprove(req)}
                                disabled={processingId === req.id}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/30 disabled:opacity-50 flex items-center gap-2"
                              >
                                {processingId === req.id ? (
                                  <Clock size={16} className="animate-spin" />
                                ) : (
                                  <CheckCircle size={16} />
                                )}
                                Generate FPKB
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INPUT FPP BARU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FilePlus className="text-blue-600" size={24} /> Form Input FPP
                Cabang
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Hapus overflow-hidden agar dropdown tidak terpotong, ganti overflow-y-visible */}
            <div className="p-6 overflow-visible pb-24 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleSubmitNewFpp} className="space-y-6">
                {/* Informasi Dokumen */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Nomor Dokumen FPP
                    </label>
                    <input
                      name="nomor_fpp"
                      type="text"
                      required
                      placeholder="Contoh: 154/FPP/LOG/2026"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cabang / Unit Kerja
                    </label>
                    <input
                      name="cabang"
                      type="text"
                      required
                      placeholder="Contoh: KC Panakkukang"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Nama PIC (Pemohon)
                    </label>
                    <input
                      name="pic_nama"
                      type="text"
                      required
                      placeholder="Contoh: Dwi Bagus Hastomo"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* Detail Barang */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-bold text-slate-800">
                      Daftar Barang yang Diminta
                    </label>
                    <button
                      type="button"
                      onClick={handleAddFppItem}
                      className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus size={14} /> Tambah Baris
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fppItems.map((item, index) => {
                      // Temukan master barang terpilih untuk mendapatkan satuan
                      const selectedBarang = masterBarang.find(
                        (b) => b.id === item.barangId,
                      );
                      const satuan = selectedBarang
                        ? selectedBarang.satuan
                        : "Unit";

                      return (
                        <div
                          key={index}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative"
                          style={{ zIndex: 50 - index }} // Mencegah dropdown tertimpa baris bawahnya
                        >
                          <div className="flex-1 relative">
                            <SearchableSelect
                              name={`items[${index}][barangId]`}
                              options={masterBarang.map((b) => ({
                                id: b.id,
                                label: b.nama,
                                sku: b.sku,
                              }))}
                              value={item.barangId}
                              onChange={(val) =>
                                handleFppItemChange(index, "barangId", val)
                              }
                              placeholder="Ketik SKU atau Nama Barang..."
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Input Qty + Label Satuan Otomatis */}
                            <div className="w-48 shrink-0 flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 bg-white">
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) =>
                                  handleFppItemChange(
                                    index,
                                    "qty",
                                    parseInt(e.target.value) || 1,
                                  )
                                }
                                className="w-full px-3 py-2 outline-none text-sm text-center font-bold min-w-0"
                                required
                              />
                              <span className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 border-l border-slate-300 h-full flex items-center justify-center min-w-[4.5rem] whitespace-nowrap uppercase">
                                {satuan}
                              </span>
                            </div>

                            {/* Tombol Hapus Baris */}
                            {fppItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFppItem(index)}
                                className="shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Hapus Baris"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-md shadow-blue-500/30 disabled:opacity-70"
                  >
                    <Save size={18} />{" "}
                    {isSubmitting
                      ? "Menyimpan Dokumen..."
                      : "Simpan FPP ke Antrean (Draft)"}
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
