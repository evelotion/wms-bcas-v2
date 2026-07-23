"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getDaftarFpp, getPermintaanFormData, createFppBaru } from "./actions";
import { getSession } from "@/app/login/actions"; // Panggil session
import {
  ClipboardList, CheckCircle2, Clock, Archive, FilePlus, Trash2, ChevronDown, ChevronUp,
  Plus, Save, Lock, ClipboardPaste, PackageCheck, Truck, Building2, Send,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

const STATUS_FPKB_LABEL: Record<string, { label: string; className: string }> = {
  MENUNGGU_ADJUSTMENT: { label: "Menunggu Adjustment", className: "bg-amber-50 text-amber-600 border-amber-100" },
  MENUNGGU_SERAH_TERIMA: { label: "Menunggu Serah Terima", className: "bg-blue-50 text-blue-600 border-blue-100" },
  SELESAI: { label: "Selesai", className: "bg-emerald-50 text-emerald-600 border-emerald-100" },
};

export default function RequisitionPage() {
  const [fppList, setFppList] = useState<any[]>([]);
  const [masterBarang, setMasterBarang] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [userId, setUserId] = useState<string>("");

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fppItems, setFppItems] = useState([{ barangId: "", qty: 1, satuan: "", satuanBesar: "", isiPerBesar: 1 }]);
  const [wilayah, setWilayah] = useState<"JABODETABEK" | "NON_JABODETABEK">("JABODETABEK");

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

  // ===== KPI =====
  const kpi = useMemo(() => {
    const now = new Date();
    const totalBulanIni = fppList.filter((f) => {
      const d = new Date(f.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const terproses = fppList.filter((f) => f.fpkbs?.some((fp: any) => fp.status === "SELESAI")).length;
    const menungguRealisasi = fppList.filter((f) =>
      f.fpkbs?.some((fp: any) => fp.status === "MENUNGGU_ADJUSTMENT" || fp.status === "MENUNGGU_SERAH_TERIMA")
    ).length;
    const tertutup = fppList.filter((f) => f.status === "CLOSED").length;
    return { totalBulanIni, terproses, menungguRealisasi, tertutup };
  }, [fppList]);

  const toggleRow = (id: string) => setExpandedRow(expandedRow === id ? null : id);

  const handleAddFppItem = () => setFppItems([...fppItems, { barangId: "", qty: 1, satuan: "", satuanBesar: "", isiPerBesar: 1 }]);
  const handleRemoveFppItem = (index: number) => setFppItems(fppItems.filter((_, i) => i !== index));
  const handleFppItemChange = (index: number, field: string, value: any) => {
    const newItems = [...fppItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "barangId" && value) {
      const selectedBarang = masterBarang.find((b: any) => b.id === value);
      if (selectedBarang) {
        newItems[index].satuan = selectedBarang.satuan || "";
        newItems[index].satuanBesar = selectedBarang.satuan_besar || selectedBarang.satuan || "";
        newItems[index].isiPerBesar = selectedBarang.isi_per_satuan_besar || 1;
      }
    }
    setFppItems(newItems);
  };

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
          newItems.push({
            barangId: found.id,
            qty,
            satuan: found.satuan || "",
            satuanBesar: found.satuan_besar || found.satuan || "",
            isiPerBesar: found.isi_per_satuan_besar || 1,
          });
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
    const validItems = fppItems
      .filter((item) => item.barangId !== "" && item.qty > 0)
      .map((item) => ({
        barangId: item.barangId,
        qty: item.qty * (item.isiPerBesar || 1), // konversi satuan besar -> satuan kecil (satu-satunya titik konversi)
      }));
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
      setFppItems([{ barangId: "", qty: 1, satuan: "", satuanBesar: "", isiPerBesar: 1 }]);
      setWilayah("JABODETABEK");
      (e.target as HTMLFormElement).reset();
      fetchData();
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  const totalQtyDiminta = fppItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalBarisValid = fppItems.filter((i) => i.barangId !== "").length;

  return (
    <div className="space-y-6">
      {/* ===== KPI STRIP ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total FPP Bulan Ini</p>
            <p className="text-2xl font-black text-slate-800">{kpi.totalBulanIni}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">FPP Terproses</p>
            <p className="text-2xl font-black text-slate-800">{kpi.terproses}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Menunggu Realisasi</p>
            <p className="text-2xl font-black text-slate-800">{kpi.menungguRealisasi}</p>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <Archive size={20} className="text-slate-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">FPP Tertutup</p>
            <p className="text-2xl font-black text-slate-800">{kpi.tertutup}</p>
          </div>
        </div>
      </div>

      {/* ===== FORM INPUT FPP (HANYA ADMIN/STAF) ===== */}
      {userRole === "ADMIN" && (
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-5">
            <FilePlus size={20} className="text-blue-600" /> Form Input FPP Cabang
          </h2>

          <form onSubmit={handleSubmitNewFpp}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* KOLOM KIRI: FIELDS */}
              <div className="lg:col-span-2 space-y-5">
                <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Lock size={13} className="text-blue-500 shrink-0" />
                  Nomor FPP &amp; FPKB akan digenerate otomatis oleh sistem setelah disimpan. Tanggal: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} (otomatis).
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Cabang / Unit Kerja</label>
                    <input name="cabang" type="text" required placeholder="Contoh: KC Panakkukang" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nama PIC (Opsional)</label>
                    <input name="pic_nama" type="text" placeholder="Dikosongin dulu kalau belum ada" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                  </div>
                </div>

                {/* WILAYAH TOGGLE */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Wilayah</label>
                  <input type="hidden" name="wilayah" value={wilayah} />
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWilayah("JABODETABEK")}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        wilayah === "JABODETABEK"
                          ? "border-blue-500 bg-blue-50/60 shadow-sm"
                          : "border-slate-200 bg-white/50 hover:border-slate-300"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${wilayah === "JABODETABEK" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                        <Building2 size={18} />
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${wilayah === "JABODETABEK" ? "text-blue-700" : "text-slate-600"}`}>JABODETABEK</p>
                        <p className="text-[11px] text-slate-400">Serah terima langsung</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWilayah("NON_JABODETABEK")}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        wilayah === "NON_JABODETABEK"
                          ? "border-blue-500 bg-blue-50/60 shadow-sm"
                          : "border-slate-200 bg-white/50 hover:border-slate-300"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${wilayah === "NON_JABODETABEK" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                        <Truck size={18} />
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${wilayah === "NON_JABODETABEK" ? "text-blue-700" : "text-slate-600"}`}>NON-JABODETABEK</p>
                        <p className="text-[11px] text-slate-400">Butuh BAST + airwaybill</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Keterangan (Opsional)</label>
                  <input name="keterangan" type="text" placeholder="Catatan tambahan" className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-sm transition-all" />
                </div>

                {/* DETAIL BARANG */}
                <div>
                  <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                    <label className="block text-sm font-bold text-slate-800">Daftar Barang yang Diminta</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowBulk(!showBulk)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${showBulk ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'}`}
                      >
                        <ClipboardPaste size={14} /> {showBulk ? "Tutup Paste Excel" : "Paste dari Excel"}
                      </button>
                      <button type="button" onClick={handleAddFppItem} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                        <Plus size={14} /> Tambah Barang
                      </button>
                    </div>
                  </div>

                  {showBulk && (
                    <div className="mb-4 bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-xs text-emerald-700 mb-2 font-medium">
                        Copy 2 kolom dari Excel (Kolom 1: SKU atau Nama Barang, Kolom 2: Qty), lalu paste di bawah:
                      </p>
                      <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={`Contoh:\nSKU-001\t10\nKertas HVS\t5`}
                        className="w-full h-24 text-sm p-3 bg-white border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3 whitespace-pre"
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

                  <div className="grid grid-cols-12 gap-2 px-1 mb-1.5">
                    <span className="col-span-6 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Barang</span>
                    <span className="col-span-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-center">Jumlah</span>
                    <span className="col-span-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-center">Satuan</span>
                    <span className="col-span-1"></span>
                  </div>
                  <div className="space-y-2.5">
                    {fppItems.map((item, index) => {
                      const isiPerBesar = item.isiPerBesar || 1;
                      const satuanTampil = isiPerBesar > 1 ? (item.satuanBesar || item.satuan) : item.satuan;
                      return (
                      <div key={index}>
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6 relative">
                            <SearchableSelect
                              name={`items[${index}][barangId]`}
                              options={masterBarang.map(b => ({ id: b.id, label: b.nama, sku: b.sku }))}
                              value={item.barangId}
                              onChange={(val) => handleFppItemChange(index, "barangId", val)}
                              placeholder="Ketik SKU atau Nama Barang..."
                              className="z-20"
                            />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="1" value={item.qty} onChange={(e) => handleFppItemChange(index, "qty", parseInt(e.target.value) || 1)} className="w-full bg-white/70 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm text-center font-bold transition-all" required />
                          </div>
                          <div className="col-span-3">
                            <span className="block w-full text-center text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 truncate">
                              {satuanTampil || "—"}
                            </span>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            {fppItems.length > 1 && (
                              <button type="button" onClick={() => handleRemoveFppItem(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={16}/>
                              </button>
                            )}
                          </div>
                        </div>
                        {item.barangId && isiPerBesar > 1 && (
                          <p className="text-[11px] text-blue-600 mt-1 ml-1">
                            1 {item.satuanBesar} = {isiPerBesar.toLocaleString('id-ID')} {item.satuan} &rarr; total: {(Number(item.qty || 0) * isiPerBesar).toLocaleString('id-ID')} {item.satuan}
                          </p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* KOLOM KANAN: SUMMARY + SUBMIT */}
              <div className="lg:col-span-1">
                <div className="glass-panel rounded-2xl p-5 sticky top-4 space-y-4 bg-blue-50/30">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                    <ClipboardList size={16} className="text-blue-600" /> Ringkasan
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Jenis Barang</span>
                      <span className="font-black text-slate-800 text-lg">{totalBarisValid}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total Qty <span className="text-[10px] normal-case text-slate-400">(satuan besar per barang)</span></span>
                      <span className="font-black text-slate-800 text-lg">{totalQtyDiminta}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Wilayah</span>
                      <span className="font-bold text-blue-700 text-xs">{wilayah === "JABODETABEK" ? "JABODETABEK" : "NON-JABODETABEK"}</span>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-70">
                    <Save size={18} /> {isSubmitting ? "Menyimpan..." : "Simpan FPP"}
                  </button>
                  <p className="text-[11px] text-slate-400 text-center">Nomor FPP &amp; FPKB otomatis, langsung masuk antrean Admin Gudang.</p>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ===== PANEL HISTORY ===== */}
      <div className="glass-panel rounded-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200/60 bg-white/40">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Archive size={20} className="text-blue-600" /> Riwayat FPP
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {userRole === "ADMIN"
              ? "Status keseluruhan FPP yang sudah diterbitkan."
              : "Pantau status FPP dan FPKB yang sudah diterbitkan Staf."}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Nomor FPP</th>
                <th className="px-6 py-4">Nomor FPKB</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Cabang</th>
                <th className="px-6 py-4 text-center">Wilayah</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Memuat data...</td></tr>
              ) : fppList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <ClipboardList className="h-12 w-12 text-slate-300 mb-3" />
                      <p className="font-bold text-slate-600 text-base">Belum Ada Dokumen FPP</p>
                      <p className="text-xs mt-1">FPP yang masuk dari cabang akan tampil di sini.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                fppList.map((req: any) => (
                  <React.Fragment key={req.id}>
                    <tr
                      className={`transition-all cursor-pointer ${expandedRow === req.id ? "bg-blue-50/40 shadow-sm" : "hover:bg-white/60 hover:shadow-sm"}`}
                      onClick={() => toggleRow(req.id)}
                    >
                      <td className="px-6 py-4 font-bold text-slate-800">{req.nomor_fpp}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {req.fpkbs?.length > 0 ? (
                          <>
                            #{req.fpkbs[0].nomor_fpkb}
                            {req.fpkbs.length > 1 && (
                              <span className="ml-1.5 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                +{req.fpkbs.length - 1} lainnya
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{new Date(req.createdAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{req.cabang}</p>
                        {req.pic_nama && <p className="text-[11px] text-slate-400">PIC: {req.pic_nama}</p>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-indigo-50 text-indigo-600 border-indigo-100">
                          {req.wilayah === "JABODETABEK" ? <Building2 size={11} /> : <Send size={11} />}
                          {req.wilayah === "JABODETABEK" ? "JABODETABEK" : "NON-JABODETABEK"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {req.status === "OPEN" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-600 border-amber-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> OPEN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-600 border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> CLOSED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-lg transition-colors">
                          {expandedRow === req.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </td>
                    </tr>

                    {expandedRow === req.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="p-0">
                          <div className="px-6 py-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* RINCIAN BARANG DIMINTA */}
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                                  <Lock size={14} className="text-slate-400" /> Rincian Barang Diminta (Target FPP)
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
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                                  <Truck size={14} className="text-blue-600" /> FPKB Terkait
                                </h3>
                                {req.fpkbs?.length === 0 ? (
                                  <p className="text-sm text-slate-400 italic">Belum ada FPKB.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {req.fpkbs.map((f: any) => {
                                      const s = STATUS_FPKB_LABEL[f.status] || { label: f.status, className: "bg-slate-100 text-slate-600 border-slate-200" };
                                      return (
                                        <div key={f.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                          <span className="font-bold text-slate-700 text-sm">FPKB #{f.nomor_fpkb}</span>
                                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${s.className}`}>{s.label}</span>
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
    </div>
  );
}
