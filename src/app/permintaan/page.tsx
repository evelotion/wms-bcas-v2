"use client";

import React, { useEffect, useState } from "react";
import { getDaftarFpp, getPermintaanFormData, createFppBaru } from "./actions";
import { getSession } from "@/app/login/actions"; // Panggil session
import { ClipboardList, CheckCircle, Clock, FilePlus, Trash2, ChevronDown, ChevronUp, Plus, X, Save, Lock, ClipboardPaste, PackageCheck, Archive, Truck } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

const STATUS_FPKB_LABEL: Record<string, { label: string; className: string }> = {
  MENUNGGU_ADJUSTMENT: { label: "Menunggu Adjustment", className: "bg-amber-100 text-amber-700" },
  MENUNGGU_SERAH_TERIMA: { label: "Menunggu Serah Terima", className: "bg-blue-100 text-blue-700" },
  SELESAI: { label: "Selesai", className: "bg-emerald-100 text-emerald-700" },
};

export default function RequisitionPage() {
  const [fppList, setFppList] = useState<any[]>([]);
  const [masterBarang, setMasterBarang] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State untuk Role Akses
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [userId, setUserId] = useState<string>("");

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fppItems, setFppItems] = useState([{ barangId: "", qty: 1, satuan: "" }]);

  // --- STATE PASTE EXCEL ---
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");

  useEffect(() => {
    fetchData();
    getSession().then((session) => {
      if (session) {
        setUserRole(session.role);
        setUserId(session.id);
      }
    });
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [requests, formData] = await Promise.all([
      getDaftarFpp(),
      getPermintaanFormData(),
    ]);
    setFppList(requests || []);
    setMasterBarang(formData.barang || []);
    setIsLoading(false);
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleAddFppItem = () => setFppItems([...fppItems, { barangId: "", qty: 1, satuan: "" }]);
  const handleRemoveFppItem = (index: number) => setFppItems(fppItems.filter((_, i) => i !== index));
  const handleFppItemChange = (index: number, field: string, value: any) => {
    const newItems = [...fppItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "barangId" && value) {
      const selectedBarang = masterBarang.find((b: any) => b.id === value);
      if (selectedBarang) newItems[index].satuan = selectedBarang.satuan || "";
    }
    setFppItems(newItems);
  };

  // --- FUNGSI PASTE EXCEL ---
  const processExcelData = () => {
    if (!bulkText.trim()) return;

    const rows = bulkText.split('\n');
    const newItems: any[] = [];
    const notFound: string[] = [];

    rows.forEach(row => {
      if (!row.trim()) return;
      const cols = row.split('\t');

      if (cols.length >= 2) {
        const identifier = cols[0].trim().toLowerCase();
        const qty = parseInt(cols[1].trim()) || 1;

        const found = masterBarang.find(b =>
          b.sku.toLowerCase() === identifier ||
          b.nama.toLowerCase() === identifier
        );

        if (found) {
          newItems.push({ barangId: found.id, qty, satuan: found.satuan });
        } else {
          notFound.push(cols[0].trim());
        }
      }
    });

    if (newItems.length > 0) {
      if (fppItems.length === 1 && fppItems[0].barangId === "") {
        setFppItems(newItems);
      } else {
        setFppItems([...fppItems, ...newItems]);
      }
      setBulkText("");
      setShowBulk(false);
    }

    if (notFound.length > 0) {
      alert(`Peringatan: ${notFound.length} barang tidak ditemukan di Master Data!\n\n${notFound.join(', ')}`);
    } else if (newItems.length > 0) {
      alert(`Berhasil menambahkan ${newItems.length} barang dari Excel!`);
    }
  };

  const handleSubmitNewFpp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validItems = fppItems.filter((item) => item.barangId !== "" && item.qty > 0);
    if (validItems.length === 0) return alert("Pilih minimal 1 barang beserta jumlahnya!");

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const headerData = {
      cabang: formData.get("cabang") as string,
      wilayah: formData.get("wilayah") as "JABODETABEK" | "NON_JABODETABEK",
      pic_nama: (formData.get("pic_nama") as string) || undefined,
      keterangan: (formData.get("keterangan") as string) || undefined,
    };

    const res = await createFppBaru(headerData, validItems, userId);

    if (res.success) {
      alert(`✅ FPP berhasil disimpan!\nNomor FPP: ${res.nomor_fpp}\nNomor FPKB otomatis: ${res.nomor_fpkb}\n\nFPKB sudah masuk ke antrean Admin Gudang.`);
      setIsModalOpen(false);
      setFppItems([{ barangId: "", qty: 1, satuan: "" }]);
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
            <h1 className="text-2xl font-bold text-slate-800">Daftar FPP</h1>
            <p className="text-sm text-slate-500">
              {userRole === "ADMIN"
                ? "Input form PDF cabang ke sistem — nomor FPP & FPKB otomatis, langsung masuk antrean Admin Gudang."
                : "Pantau status FPP dan FPKB yang sudah diterbitkan Staf. Proses adjustment dilakukan di halaman FPKB."}
            </p>
          </div>
        </div>

        {/* HANYA STAF (ADMIN) YANG BISA TAMBAH FPP */}
        {userRole === "ADMIN" && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all"
          >
            <FilePlus size={18} /> Input FPP Baru
          </button>
        )}
      </div>

      {/* TABLE FPP */}
      <div className="glass-panel flex flex-col rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Nomor FPP</th>
                <th className="px-6 py-4">Tgl Request</th>
                <th className="px-6 py-4">Cabang Pemohon</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">FPKB Terkait</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8">Memuat data...</td></tr>
              ) : fppList.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Belum ada dokumen FPP masuk.</td></tr>
              ) : (
                fppList.map((req: any) => (
                  <React.Fragment key={req.id}>
                    <tr onClick={() => toggleRow(req.id)} className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${expandedRow === req.id ? "bg-blue-50/50" : ""}`}>
                      <td className="px-6 py-4 font-bold text-slate-800">{req.nomor_fpp}</td>
                      <td className="px-6 py-4 text-slate-500">{new Date(req.createdAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {req.cabang}
                        <span className="text-xs font-normal text-slate-400 block">{req.wilayah === "JABODETABEK" ? "JABODETABEK" : "NON-JABODETABEK"}{req.pic_nama ? ` · PIC: ${req.pic_nama}` : ""}</span>
                      </td>
                      <td className="px-6 py-4">
                        {req.status === "OPEN" ? (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit">
                            <Clock size={12} /> OPEN
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit">
                            <CheckCircle size={12} /> CLOSED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600 font-semibold">{req.fpkbs?.length || 0}</td>
                      <td className="px-6 py-4 text-right">
                        {expandedRow === req.id ? <ChevronUp className="inline text-slate-400" /> : <ChevronDown className="inline text-slate-400" />}
                      </td>
                    </tr>

                    {expandedRow === req.id && (
                      <tr className="bg-slate-50/50 border-b-2 border-b-blue-100">
                        <td colSpan={6} className="px-6 py-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* RINCIAN BARANG DIMINTA */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Lock size={16} className="text-slate-400" /> Rincian Barang Diminta (Target FPP)
                              </h3>
                              <table className="w-full text-left text-sm">
                                <thead className="border-b border-slate-200 text-slate-500 text-xs">
                                  <tr>
                                    <th className="pb-2 font-medium">Item Barang</th>
                                    <th className="pb-2 font-medium w-24 text-center">Diminta</th>
                                    <th className="pb-2 font-medium w-24 text-center">Terpenuhi</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {req.details.map((d: any) => (
                                    <tr key={d.id} className="border-b border-slate-100 last:border-0">
                                      <td className="py-3">
                                        <div className="font-medium text-slate-800">{d.barang.nama}</div>
                                        <div className="text-xs text-slate-500">{d.barang.sku}</div>
                                      </td>
                                      <td className="py-3 text-center font-bold text-slate-600">{d.qty_diminta} {d.barang.satuan}</td>
                                      <td className="py-3 text-center font-bold text-emerald-600">{d.qty_terpenuhi} {d.barang.satuan}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* DAFTAR FPKB */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Truck size={16} className="text-blue-600" /> FPKB Terkait
                              </h3>
                              {req.fpkbs?.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">Belum ada FPKB.</p>
                              ) : (
                                <div className="space-y-2">
                                  {req.fpkbs.map((f: any) => {
                                    const s = STATUS_FPKB_LABEL[f.status] || { label: f.status, className: "bg-slate-100 text-slate-600" };
                                    return (
                                      <div key={f.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <span className="font-bold text-slate-700">FPKB #{f.nomor_fpkb}</span>
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${s.className}`}>{s.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {req.outstandings?.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                  <h4 className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Archive size={14} /> Outstanding Aktif
                                  </h4>
                                  <p className="text-xs text-slate-500">{req.outstandings.length} item masih menunggu diproses ulang. Kelola di halaman Outstanding.</p>
                                </div>
                              )}
                              {req.status === "CLOSED" && (
                                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-emerald-600 text-sm font-medium">
                                  <PackageCheck size={16} /> FPP ini sudah selesai/ditutup.
                                </div>
                              )}
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
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FilePlus className="text-blue-600" size={24} /> Form Input FPP Cabang
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-visible pb-24 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleSubmitNewFpp} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="md:col-span-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    Nomor FPP & FPKB akan digenerate otomatis oleh sistem setelah disimpan.
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cabang / Unit Kerja</label>
                    <input name="cabang" type="text" required placeholder="Contoh: KC Panakkukang" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Wilayah</label>
                    <select name="wilayah" required defaultValue="JABODETABEK" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white">
                      <option value="JABODETABEK">JABODETABEK</option>
                      <option value="NON_JABODETABEK">NON-JABODETABEK</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nama PIC (Pemohon) — opsional</label>
                    <input name="pic_nama" type="text" placeholder="Dikosongin dulu kalau belum ada" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Keterangan — opsional</label>
                    <input name="keterangan" type="text" placeholder="Catatan tambahan" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" />
                  </div>
                </div>

                {/* --- DETAIL BARANG --- */}
                <div>
                  <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                    <label className="block text-sm font-bold text-slate-800">Daftar Barang yang Diminta</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowBulk(!showBulk)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${showBulk ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                      >
                        <ClipboardPaste size={14} /> {showBulk ? "Tutup Paste Excel" : "Paste dari Excel"}
                      </button>
                      <button type="button" onClick={handleAddFppItem} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                        <Plus size={14} /> Tambah Baris
                      </button>
                    </div>
                  </div>

                  {/* AREA PASTE EXCEL */}
                  {showBulk && (
                    <div className="mb-4 bg-emerald-50 p-4 rounded-xl border border-emerald-200 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-xs text-emerald-700 mb-2 font-medium">
                        Copy 2 kolom dari Excel (Kolom 1: SKU atau Nama Barang, Kolom 2: Qty), lalu paste di bawah:
                      </p>
                      <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={`Contoh:\nSKU-001\t10\nKertas HVS\t5`}
                        className="w-full h-24 text-sm p-3 border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 mb-3 whitespace-pre"
                      />
                      <button
                        type="button"
                        onClick={processExcelData}
                        className="w-full bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
                      >
                        Proses Data Excel
                      </button>
                    </div>
                  )}

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
                            className="z-20"
                          />
                        </div>
                        <div className="w-24 shrink-0">
                          <input type="number" min="1" value={item.qty} onChange={(e) => handleFppItemChange(index, "qty", parseInt(e.target.value) || 1)} className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-center font-bold" required />
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
                    <Save size={18} /> {isSubmitting ? "Menyimpan Dokumen..." : "Simpan FPP (Auto-generate Nomor)"}
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
