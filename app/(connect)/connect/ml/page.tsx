import { ConnectMlFlow } from "@/app/(connect)/connect/ml/connect-ml-flow";
import { getInviteByRawToken } from "@/lib/ml/invite-lookup";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ConnectMlPage({
  searchParams
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const rawToken = sp.token?.trim() ?? "";

  const invite = rawToken ? await getInviteByRawToken(rawToken) : null;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[#F5F5F0] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <ConnectMlFlow invite={invite} rawToken={rawToken} sessionEmail={user?.email ?? null} />
      </div>
    </main>
  );
}
