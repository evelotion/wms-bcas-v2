import DetailBarangClient from "./DetailBarangClient";

export const dynamic = "force-dynamic";

export default function DetailBarangPage({ params }: { params: { id: string } }) {
  return <DetailBarangClient id={params.id} />;
}
