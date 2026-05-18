import { redirect } from "next/navigation";

export default async function ClientSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/internal/clients/${id}/accounts`);
}
