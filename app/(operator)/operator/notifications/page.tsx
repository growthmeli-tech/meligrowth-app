import { AppShell } from "@/components/layout/app-shell";
import { NotificationList } from "@/components/notifications/notification-list";
import { getNotifications } from "@/lib/data";

export default async function OperatorNotificationsPage({
  searchParams
}: {
  searchParams?: Promise<{ estado?: string; tipo?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const notifications = await getNotifications(50);

  return (
    <AppShell mode="operator">
      <NotificationList notifications={notifications} basePath="/operator/notifications" statusFilter={resolvedSearchParams.estado ?? "todas"} typeFilter={resolvedSearchParams.tipo ?? "todas"} />
    </AppShell>
  );
}
