import CetakBarcodeClient from "./CetakBarcodeClient";

export async function generateStaticParams() {
  return [];
}

export default function CetakBarcodePage() {
  return <CetakBarcodeClient />;
}
