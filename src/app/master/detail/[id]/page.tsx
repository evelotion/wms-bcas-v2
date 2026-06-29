import DetailBarangClient from "./DetailBarangClient";

export async function generateStaticParams() {
  return [];
}

export default function DetailBarangPage({ params }: { params: Promise<{ id: string }> }) {
  return <DetailBarangClient id={(params as any).id} />;
}
