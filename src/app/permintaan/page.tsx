"use client";

import { useEffect, useState } from "react";
import { getPermintaanFormData, createPermintaan, getDaftarPermintaan, approvePermintaan, getOutstandingList } from "./actions";
import { generateFPKB } from "@/lib/generateFpkb";
import { ClipboardList, CheckCircle, Clock, AlertCircle, FilePlus, ChevronLeft, ChevronRight, UploadCloud, Archive, FileText } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

export default function RequisitionFulfillmentPage() {
  const [activeTab, setActiveTab] = useState<"requisition" | "outstanding">("requisition");
  
  const [barangList, setBarangList] = useState<any[]>([]);
  const [selectedBarangId, setSelectedBarangId] = useState("");
  
  const [permintaanList, setPermintaanList] = useState<any[]>([]);
  const [outstandingList, setOutstandingList] = useState<any[]>([]); // State untuk Tab B
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // === STATE PAGINATION ===
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    // Panggil actions secara paralel, termasuk data Outstanding
    const [formOptions, requests, outstandings] = await Promise.all([
      getPermintaanFormData(),
      getDaftarPermintaan(),
      getOutstandingList()
    ]);
    
    // Map data barang biar cocok sama props SearchableSelect { id, label, sku }
    const formattedBarang = ((formOptions as any).barang || []).map((b: any) => ({
      id: b.id,
      label: b.nama,
      sku: b.sku
    }));
    
    setBarangList(formattedBarang);
    setPermintaanList(requests || []);
    setOutstandingList(outstandings || []);
    setIsLoading(false);
  };

  // === LOGIC PAGINATION ===
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = permintaanList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(permintaanList.length / itemsPerPage);

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  // === SUBMIT MANUAL ITEM ===
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formElement = e.currentTarget; 
    const formData = new FormData(formElement); 
    
    const res = await createPermintaan(formData);
    
    if (res.success) {
      alert("✅ Permintaan berhasil dibuat! Menunggu Approval SPV.");
      formElement.reset(); 
      setSelectedBarangId(""); 
      fetchData();
    } else {
      alert("❌ " + res.error);
    }
    setIsSubmitting(false);
  };

  // === APPROVE & GENERATE FPKB ===
  const handleApprove = async (id: string) => {
    if (!confirm("Approve FPP ini & jalankan FIFO?")) return;
    
    setProcessingId(id);
    const res = await approvePermintaan(id);
    
    if (res.success) {
      const instruksi = res.instruksi || [];
      if (instruksi.length > 0) {
        alert("✅ Approval Berhasil! FPKB Siap dicetak.");
      } else {
        alert("⚠️ Approval selesai, tapi tidak ada stok yang bisa ditarik (100% OUTSTANDING).");
      }

      const reqData = permintaanList.find(r => r.id === id);
      if (reqData && instruksi.length > 0) {
        generateFPKB({
          referensi: res.nomor_fpkb || reqData.nomor_fpp, // Pake nomor FPKB resmi
          tujuan: reqData.cabang,
          keterangan: reqData.keterangan || `Fulfillment Request Cabang`,
          qty: reqData.details[0]?.qty_disetujui || reqData.details[0]?.qty_diminta || 0,
          barangNama: reqData.details[0]?.barang?.nama || "Item Requisition",
          barangSku: reqData.details[0]?.barang?.sku || "SKU",
          instruksiPicker: instruksi
        });
      }

      fetchData(); // Refresh UI untuk update tab Requisition dan Outstanding
    } else {
      alert("❌ " + res.error);
    }
    setProcessingId(null);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED' || status === 'FULFILLED') return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle size={12}/> {status}</span>;
    if (status === 'PENDING' || status === 'DRAFT') return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><Clock size={12}/> PENDING</span>;
    if (status === 'OUTSTANDING') return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold flex items-center gap-1 w-fit"><AlertCircle size={12}/> OUTSTANDING</span>;
    return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-bold w-fit">{status}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      
      {/* HEADER PANEL */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-blue-500">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Requisition & Fulfillment</h1>
            <p className="text-sm text-slate-500">Kelola form FPP cabang, validasi stok, dan cetak FPKB.</p>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex bg-white/40 p-1 rounded-xl w-fit backdrop-blur-md border border-white/50">
        <button 
          onClick={() => setActiveTab("requisition")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 ${
            activeTab === "requisition" 
              ? "bg-white text-blue-700 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          }`}
        >
          <FileText size={16} /> Data Requisition
        </button>
        <button 
          onClick={() => setActiveTab("outstanding")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 ${
            activeTab === "outstanding" 
              ? "bg-white text-orange-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          }`}
        >
          <Archive size={16} /> Outstanding
        </button>
      </div>

      {/* TAB A: REQUISITION */}
      {activeTab === "requisition" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* PANEL KIRI: Upload & Input Manual */}
          <div className="lg:col-span-1 glass-panel p-6 rounded-2xl h-fit space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <UploadCloud size={18} className="text-blue-600"/> Upload FPP Cabang
              </h2>
              <div className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-xl p-6 text-center hover:bg-blue-50 transition-colors cursor-pointer group">
                <UploadCloud size={32} className="mx-auto text-blue-400 group-hover:text-blue-600 transition-colors mb-2" />
                <p className="text-sm font-medium text-blue-700">Tarik File Excel FPP</p>
                <p className="text-xs text-slate-500 mt-1">Sistem akan otomatis membaca item</p>
              </div>
            </div>

            <div className="border-t border-slate-200/50 pt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FilePlus size={16} className="text-slate-600"/> Input Item Manual
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tujuan / Cabang</label>
                  <input name="cabang" type="text" required placeholder="Contoh: KCP Jatinegara" className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama PIC Pemohon</label>
                  <input name="pic_nama" type="text" required placeholder="Contoh: Budi Santoso" className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Barang</label>
                  <SearchableSelect 
                    name="barangId"
                    options={barangList} 
                    value={selectedBarangId} 
                    onChange={setSelectedBarangId} 
                    placeholder="Ketik SKU atau Nama Barang..." 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Qty Diminta</label>
                    <input name="qty" type="number" min="1" required className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
                  <textarea name="keterangan" rows={2} className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"></textarea>
                </div>
                <button type="submit" disabled={isSubmitting || !selectedBarangId} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-70">
                  {isSubmitting ? "Memproses..." : "Tambahkan ke Waiting List"}
                </button>
              </form>
            </div>
          </div>

          {/* PANEL KANAN: Tabel Menunggu Approval */}
          <div className="lg:col-span-2 glass-panel flex flex-col rounded-2xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-white/40">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle size={18} className="text-blue-600"/> Waiting List FPKB
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">No. FPP / Tgl</th>
                    <th className="px-6 py-4">Cabang</th>
                    <th className="px-6 py-4">Detail Barang</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Aksi (SPV)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {isLoading ? (
                    <tr><td colSpan={5} className="text-center py-8">Memuat data...</td></tr>
                  ) : permintaanList.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Belum ada request masuk.</td></tr>
                  ) : (
                    currentItems.map((req) => (
                      <tr key={req.id} className="hover:bg-white/40">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{req.nomor_fpp}</div>
                          <div className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString('id-ID')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-700">{req.cabang}</div>
                          <div className="text-xs text-slate-500">PIC: {req.pic_nama}</div>
                        </td>
                        <td className="px-6 py-4">
                          {req.details.map((d: any) => (
                            <div key={d.id} className="mb-2 last:mb-0 border-b border-slate-200/50 pb-1 last:border-0 last:pb-0">
                              <div className="font-medium text-blue-700 text-xs">{d.barang.nama}</div>
                              <div className="text-xs flex justify-between mt-1 w-32">
                                <span>Minta: <b className="text-slate-800">{d.qty_diminta}</b></span>
                                <span>Dapat: <b className="text-emerald-600">{d.qty_disetujui}</b></span>
                              </div>
                            </div>
                          ))}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                        <td className="px-6 py-4 text-center">
                          {req.status === 'PENDING' || req.status === 'DRAFT' ? (
                            <button 
                              onClick={() => handleApprove(req.id)}
                              disabled={processingId === req.id}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md shadow-emerald-500/30 disabled:opacity-50"
                            >
                              {processingId === req.id ? "Proses..." : "Generate FPKB"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Selesai</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* FOOTER PAGINATION */}
            {!isLoading && permintaanList.length > 0 && (
              <div className="p-4 border-t border-white/40 bg-white/20 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
                <div className="text-sm text-slate-500">
                  Menampilkan <span className="font-semibold text-slate-800">{indexOfFirstItem + 1}</span> - <span className="font-semibold text-slate-800">{Math.min(indexOfLastItem, permintaanList.length)}</span> dari <span className="font-semibold text-slate-800">{permintaanList.length}</span> data
                </div>
                <div className="flex gap-2">
                  <button onClick={prevPage} disabled={currentPage === 1} className="p-2 rounded-lg border border-white/40 bg-white/50 text-slate-600 hover:bg-white disabled:opacity-50 transition-all">
                    <ChevronLeft size={18} />
                  </button>
                  <div className="px-4 py-2 rounded-lg bg-blue-50/50 text-blue-700 font-semibold border border-blue-100 text-sm">
                    Hal {currentPage} / {totalPages}
                  </div>
                  <button onClick={nextPage} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-white/40 bg-white/50 text-slate-600 hover:bg-white disabled:opacity-50 transition-all">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB B: OUTSTANDING */}
      {activeTab === "outstanding" && (
        <div className="glass-panel flex flex-col rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="p-6 pb-4 border-b border-white/40">
             <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Archive size={18} className="text-orange-600"/> Daftar Barang Outstanding
             </h2>
             <p className="text-sm text-slate-500 mt-1">Barang yang belum terpenuhi dari Form Cabang (FPP) sebelumnya.</p>
           </div>
           
           {outstandingList.length === 0 ? (
             <div className="p-12 flex flex-col items-center justify-center text-slate-400 text-sm bg-white/20">
                <Archive size={48} className="text-slate-300 mb-3" />
                Belum ada data outstanding saat ini.
             </div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                 <thead className="bg-slate-100/50 text-slate-600 uppercase text-xs font-semibold">
                   <tr>
                     <th className="px-6 py-4">Tgl Outstanding</th>
                     <th className="px-6 py-4">No. FPP Asal</th>
                     <th className="px-6 py-4">Cabang</th>
                     <th className="px-6 py-4">Detail Barang</th>
                     <th className="px-6 py-4 text-right">Qty Kurang</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/40">
                   {outstandingList.map((out) => (
                     <tr key={out.id} className="hover:bg-white/40">
                       <td className="px-6 py-4 text-slate-500">{new Date(out.createdAt).toLocaleDateString('id-ID')}</td>
                       <td className="px-6 py-4 font-bold text-slate-800">{out.header.nomor_fpp}</td>
                       <td className="px-6 py-4 text-slate-700">{out.header.cabang}</td>
                       <td className="px-6 py-4">
                         <div className="font-medium text-blue-700">{out.barang.nama}</div>
                         <div className="text-xs text-slate-500">{out.barang.sku}</div>
                       </td>
                       <td className="px-6 py-4 text-right">
                         <span className="font-bold text-red-600 text-base">{out.qty_sisa}</span>
                         <span className="text-xs text-slate-500 ml-1">{out.barang.satuan}</span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      )}

    </div>
  );
}