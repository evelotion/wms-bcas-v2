"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

export interface FpkbPrintItem {
  kode: string;
  nama: string;
  jmlPack: string | number;
  jmlSatuan: string;
  hargaSatuan: number;
  total: number;
  realisasi: string; // Kosong ("") kalau FPKB belum diadjustment Admin Gudang
  keterangan: string;
}

export interface FpkbPrintData {
  nomorFpkb: string;
  noFpp: string;
  tglDokumen: string;
  tglRequest: string;
  cabang: string;
  pic: string;
  items: FpkbPrintItem[];
  grandTotal: number;
}

const formatRupiah = (angka: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(angka || 0);

const namaOrTitik = (nama?: string) => (nama && nama.trim() ? nama : "..................");

export default function FpkbPrintView({ data }: { data: FpkbPrintData }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fpkb-print-wrap">
      <div className="no-print toolbar">
        <Link href="/fpkb" className="btn-back"><ArrowLeft size={14} /> Kembali</Link>
        <button className="btn-print" onClick={() => window.print()}><Printer size={14} /> Cetak / Simpan PDF</button>
      </div>

      <div className="doc">
        <div className="kop">
          <img src="/logo-bca-syariah.png" style={{ height: "11mm", width: "auto" }} alt="BCA Syariah" />
        </div>
        <div className="title">FORM PERSETUJUAN KELUAR BARANG</div>
        <div className="subtitle">No. {data.nomorFpkb}</div>

        <div className="section-label">A. INFORMASI PERMINTAAN*</div>
        <div className="info-grid">
          <div className="info-col">
            <div className="info-row"><span className="lbl">Media Request</span><span className="val">FPP</span></div>
            <div className="info-row"><span className="lbl">No Dokumen</span><span className="val">{data.noFpp || "-"}</span></div>
            <div className="info-row"><span className="lbl">Tgl Dokumen</span><span className="val">{data.tglDokumen}</span></div>
            <div className="info-row"><span className="lbl">Cabang/Unit Kerja</span><span className="val">{data.cabang}</span></div>
          </div>
          <div className="info-col">
            <div className="info-row"><span className="lbl">Tgl Request</span><span className="val">{data.tglRequest}</span></div>
            <div className="info-row"><span className="lbl">PIC Unit Kerja</span><span className="val">{namaOrTitik(data.pic)}</span></div>
            <div className="info-row"><span className="lbl">Jenis Permintaan</span><span className="val">Existing</span></div>
            <div className="info-row"><span className="lbl">Ketersediaan</span><span className="val">[ V ] Ada&nbsp;&nbsp;&nbsp;[ ] Tidak Ada</span></div>
          </div>
        </div>

        <div className="section-label">B. DETAIL PERSETUJUAN BARANG*</div>
        <table>
          <thead>
            <tr>
              <th style={{ width: "4%" }}>No.</th>
              <th style={{ width: "9%" }}>Kode Barang</th>
              <th style={{ width: "22%" }}>Nama Barang</th>
              <th style={{ width: "7%" }}>Jml Pack</th>
              <th style={{ width: "9%" }}>Jml Satuan</th>
              <th style={{ width: "9%" }}>Harga Satuan</th>
              <th style={{ width: "11%" }}>Total</th>
              <th style={{ width: "9%" }}>Realisasi Pengiriman</th>
              <th style={{ width: "11%" }}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx}>
                <td className="c">{idx + 1}</td>
                <td className="c">{item.kode}</td>
                <td>{item.nama}</td>
                <td className="c">{item.jmlPack}</td>
                <td className="c">{item.jmlSatuan}</td>
                <td className="r">{formatRupiah(item.hargaSatuan)}</td>
                <td className="r">{formatRupiah(item.total)}</td>
                <td className="c">{item.realisasi}</td>
                <td className="c">{item.keterangan}</td>
              </tr>
            ))}
            <tr className="gt-row">
              <td colSpan={6} className="r">Grand Total</td>
              <td className="r">{formatRupiah(data.grandTotal)}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div className="sign-grid">
          <div className="sign-cell"><div className="role">Dibuat</div><div className="sub">(Staf)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
          <div className="sign-cell"><div className="role">Diverifikasi</div><div className="sub">(SPV Logistik)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
          <div className="sign-cell"><div className="role">Disetujui</div><div className="sub">(Ka Bid/Dept Logistik)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
        </div>

        <div className="section-label">C. INSTALASI &amp; SETUP</div>
        <div className="sign-grid">
          <div className="sign-cell"><div className="role">Menyerahkan*</div><div className="sub">(Logistik)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
          <div className="sign-cell"><div className="role">Diterima**</div><div className="sub">(IT Support)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
          <div className="sign-cell"><div className="role">Diserahkan**</div><div className="sub">(IT)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
          <div className="sign-cell"><div className="role">Diterima*</div><div className="sub">(Logistik)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
        </div>
        <div style={{ fontSize: "7px", marginTop: "2px" }}>Catatan IT :</div>

        <div className="section-label">D. PENGELUARAN &amp; SERAH TERIMA BARANG</div>
        <div className="sign-grid">
          <div className="sign-cell"><div className="role">Diserahkan</div><div className="sub">(Logistik)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
          <div className="sign-cell"><div className="role">Diterima</div><div className="sub">(User)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
          <div className="sign-cell"><div className="role">Diterima</div><div className="sub">(Ka Dept / Ka Satuan Kerja)</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
          <div className="sign-cell"><div className="role">Diterima</div><div className="sub">Ekspedisi/Kurir Eksternal</div><div className="nm">..................</div><div className="tgl">Tgl:</div></div>
        </div>
        <div style={{ fontSize: "7px", marginTop: "2px" }}>No. BAST : ..............................&nbsp;&nbsp;&nbsp;No. AIRWAYBILL : ..............................</div>

        <div className="ket">
          <b>Ketentuan :</b><br />
          *) Diisi oleh Logistik<br />
          **) Diisi oleh IT jika membutuhkan proses instalasi&amp;setup. Mohon dapat dituliskan N/A secara manual jika :<br />
          1. Kolom tanda tangan IT tidak diperlukan (Instalasi/Setup)<br />
          2. Kolom tanda tangan User, Ka Dept/Ka Satuan Kerja diproses via email menggunakan form BAST<br />
          3. Kolom tanda tangan Ekspedisi/Kurir Eksternal jika proses serah terima barang langsung ke User
        </div>
      </div>

      <style jsx global>{`
        @page { size: A4; margin: 12mm; }
        html, body { display: block !important; height: auto !important; overflow: auto !important; }
        .fpkb-print-wrap { font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: #000; background: #fff; min-height: 100vh; }
        .fpkb-print-wrap .toolbar { display: flex; gap: 10px; padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .fpkb-print-wrap .btn-back, .fpkb-print-wrap .btn-print { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; color: #334155; cursor: pointer; text-decoration: none; }
        .fpkb-print-wrap .btn-print { background: #2563eb; border-color: #2563eb; color: #fff; }
        .fpkb-print-wrap .doc { width: 186mm; margin: 8mm auto; }
        .fpkb-print-wrap * { box-sizing: border-box; }
        .fpkb-print-wrap .kop { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .fpkb-print-wrap .title { text-align: center; font-size: 12px; font-weight: bold; margin-top: 4px; }
        .fpkb-print-wrap .subtitle { text-align: center; font-size: 9px; font-style: italic; margin-bottom: 8px; }
        .fpkb-print-wrap .section-label { font-weight: bold; font-size: 8.5px; margin: 6px 0 3px; }
        .fpkb-print-wrap .info-grid { display: flex; gap: 20px; }
        .fpkb-print-wrap .info-col { flex: 1; }
        .fpkb-print-wrap .info-row { display: flex; margin-bottom: 2px; }
        .fpkb-print-wrap .info-row .lbl { width: 80px; }
        .fpkb-print-wrap .info-row .val { flex: 1; border-bottom: 0.5px solid #000; padding-left: 4px; }
        .fpkb-print-wrap table { width: 100%; border-collapse: collapse; margin-top: 2px; }
        .fpkb-print-wrap thead { display: table-header-group; }
        .fpkb-print-wrap tr { page-break-inside: avoid; }
        .fpkb-print-wrap th, .fpkb-print-wrap td { border: 0.5px solid #333; padding: 2px 3px; font-size: 7px; vertical-align: top; }
        .fpkb-print-wrap th { background: #e8e8e8; text-align: center; font-weight: bold; }
        .fpkb-print-wrap td.c { text-align: center; }
        .fpkb-print-wrap td.r { text-align: right; }
        .fpkb-print-wrap .gt-row td { font-weight: bold; }
        .fpkb-print-wrap .sign-grid { display: flex; margin-top: 6px; }
        .fpkb-print-wrap .sign-cell { flex: 1; border: 0.5px solid #333; padding: 3px; text-align: center; min-height: 70px; position: relative; }
        .fpkb-print-wrap .sign-cell .role { font-weight: bold; font-size: 7.5px; }
        .fpkb-print-wrap .sign-cell .sub { font-style: italic; font-size: 7px; }
        .fpkb-print-wrap .sign-cell .nm { position: absolute; bottom: 12px; left: 0; right: 0; font-weight: bold; text-decoration: underline; }
        .fpkb-print-wrap .sign-cell .tgl { position: absolute; bottom: 2px; left: 3px; font-size: 7px; }
        .fpkb-print-wrap .ket { font-size: 7px; margin-top: 6px; }
        .fpkb-print-wrap .ket b { font-size: 7.5px; }

        @media print {
          .no-print { display: none !important; }
          .fpkb-print-wrap .doc { margin: 0 auto; }
          html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
