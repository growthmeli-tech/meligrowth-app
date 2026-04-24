import { AppShell } from "@/components/layout/app-shell";
import { NotificationList } from "@/components/notifications/notification-list";
import { getNotifications } from "@/lib/data";

export default async function ClientNotificationsPage({
  searchParams
}: {
  searchParams?: Promise<{ estado?: string; tipo?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const notifications = await getNotifications(50);

  return (
    <AppShell mode="client">
      <NotificationList notifications={notifications} basePath="/client/notifications" statusFilter={resolvedSearchParams.estado ?? "todas"} typeFilter={resolvedSearchParams.tipo ?? "todas"} />
    </AppShell>
  );
}
