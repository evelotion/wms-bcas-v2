"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

export interface BastPrintItem {
  kode: string;
  nama: string;
  qty: number | string;
  unit: string;
  spesifikasi?: string;
  keterangan: string;
}

export interface BastPrintData {
  nomorBast: string;
  namaPenerima: string;
  noDokumenFpkb: string;
  tglDokumen: string;
  cabang: string;
  jenisAset: string;
  items: BastPrintItem[];
  namaMenyerahkan: string;
  jabatanMenyerahkan: string;
}

const namaOrTitik = (nama?: string) => (nama && nama.trim() ? nama : "..................");

export default function BastPrintView({ data }: { data: BastPrintData }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bast-print-wrap">
      <div className="no-print toolbar">
        <Link href="/fpkb" className="btn-back"><ArrowLeft size={14} /> Kembali</Link>
        <button className="btn-print" onClick={() => window.print()}><Printer size={14} /> Cetak / Simpan PDF</button>
      </div>

      <div className="doc">
        <div className="kop">
          <img src="/logo-bca-syariah.png" style={{ height: "11mm", width: "auto" }} alt="BCA Syariah" />
        </div>
        <div className="title">BERITA ACARA SERAH TERIMA BARANG</div>
        <div className="subtitle">No. {data.nomorBast}</div>

        <div className="section-label">A. INFORMASI PENERIMA</div>
        <div className="info-grid">
          <div className="info-col">
            <div className="info-row"><span className="lbl">Nama</span><span className="val">{namaOrTitik(data.namaPenerima)}</span></div>
            <div className="info-row"><span className="lbl">No Dokumen &amp; Tanggal</span><span className="val">{data.noDokumenFpkb}</span></div>
            <div className="info-row"><span className="lbl">Perihal</span><span className="val">Barang Cetakan</span></div>
          </div>
          <div className="info-col">
            <div className="info-row"><span className="lbl">Tgl Dokumen Diterima</span><span className="val">{data.tglDokumen}</span></div>
            <div className="info-row"><span className="lbl">Cabang/Unit Kerja</span><span className="val">{data.cabang}</span></div>
            <div className="info-row"><span className="lbl">Jenis Aset</span><span className="val">{data.jenisAset || "Non Aktiva"}</span></div>
          </div>
        </div>

        <div className="section-label">B. DETAIL BARANG YANG DISERAHKAN</div>
        <table>
          <thead>
            <tr>
              <th style={{ width: "5%" }}>No.</th>
              <th style={{ width: "12%" }}>Kode Barang</th>
              <th style={{ width: "28%" }}>Nama Barang</th>
              <th style={{ width: "9%" }}>Qty</th>
              <th style={{ width: "9%" }}>Unit</th>
              <th style={{ width: "18%" }}>Spesifikasi</th>
              <th style={{ width: "19%" }}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx}>
                <td className="c">{idx + 1}</td>
                <td className="c">{item.kode}</td>
                <td>{item.nama}</td>
                <td className="c">{item.qty}</td>
                <td className="c">{item.unit}</td>
                <td>{item.spesifikasi || ""}</td>
                <td>{item.keterangan || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="section-label">C. PERNYATAAN PENERIMA</div>
        <p className="pernyataan">
          Saya bertanggung jawab atas barang yang diterima, dan memastikan barang sudah dicheck dan diterima dalam keadaan baik.
        </p>

        <div className="section-label">D. SERAH TERIMA BARANG</div>
        <div className="sign-grid-2">
          <div className="sign-cell-big">
            <div className="tgl-top">Tanggal :</div>
            <div className="role">Menyerahkan</div>
            <div className="nm">{namaOrTitik(data.namaMenyerahkan)}</div>
            <div className="sub">{data.jabatanMenyerahkan || "Staff Gudang"}</div>
          </div>
          <div className="sign-cell-big">
            <div className="tgl-top">Tanggal :</div>
            <div className="role">Menerima</div>
            <div className="nm">..................</div>
            <div className="sub">..................</div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @page { size: A4; margin: 12mm; }
        html, body { display: block !important; height: auto !important; overflow: auto !important; }
        .bast-print-wrap { font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: #000; background: #fff; min-height: 100vh; }
        .bast-print-wrap .toolbar { display: flex; gap: 10px; padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .bast-print-wrap .btn-back, .bast-print-wrap .btn-print { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; color: #334155; cursor: pointer; text-decoration: none; }
        .bast-print-wrap .btn-print { background: #2563eb; border-color: #2563eb; color: #fff; }
        .bast-print-wrap .doc { width: 186mm; margin: 8mm auto; }
        .bast-print-wrap * { box-sizing: border-box; }
        .bast-print-wrap .kop { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .bast-print-wrap .title { text-align: center; font-size: 12px; font-weight: bold; margin-top: 4px; }
        .bast-print-wrap .subtitle { text-align: center; font-size: 9px; font-style: italic; margin-bottom: 8px; }
        .bast-print-wrap .section-label { font-weight: bold; font-size: 8.5px; margin: 8px 0 3px; }
        .bast-print-wrap .info-grid { display: flex; gap: 20px; }
        .bast-print-wrap .info-col { flex: 1; }
        .bast-print-wrap .info-row { display: flex; margin-bottom: 2px; }
        .bast-print-wrap .info-row .lbl { width: 130px; }
        .bast-print-wrap .info-row .val { flex: 1; border-bottom: 0.5px solid #000; padding-left: 4px; }
        .bast-print-wrap table { width: 100%; border-collapse: collapse; margin-top: 2px; }
        .bast-print-wrap thead { display: table-header-group; }
        .bast-print-wrap tr { page-break-inside: avoid; }
        .bast-print-wrap th, .bast-print-wrap td { border: 0.5px solid #333; padding: 3px 4px; font-size: 8px; vertical-align: top; }
        .bast-print-wrap th { background: #e8e8e8; text-align: center; font-weight: bold; }
        .bast-print-wrap td.c { text-align: center; }
        .bast-print-wrap .pernyataan { font-size: 8px; margin-top: 4px; line-height: 1.5; }
        .bast-print-wrap .sign-grid-2 { display: flex; gap: 12px; margin-top: 8px; }
        .bast-print-wrap .sign-cell-big { flex: 1; border: 0.5px solid #333; padding: 8px; min-height: 45mm; text-align: center; position: relative; }
        .bast-print-wrap .sign-cell-big .tgl-top { position: absolute; top: 6px; left: 8px; font-size: 7px; }
        .bast-print-wrap .sign-cell-big .role { font-weight: bold; font-size: 9px; margin-top: 14px; }
        .bast-print-wrap .sign-cell-big .nm { position: absolute; bottom: 16px; left: 0; right: 0; font-weight: bold; text-decoration: underline; font-size: 8px; }
        .bast-print-wrap .sign-cell-big .sub { position: absolute; bottom: 6px; left: 0; right: 0; font-size: 7.5px; font-style: italic; }

        @media print {
          .no-print { display: none !important; }
          .bast-print-wrap .doc { margin: 0 auto; }
          html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
