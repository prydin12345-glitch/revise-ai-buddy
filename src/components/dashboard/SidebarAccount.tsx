import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSession } from "@/hooks/use-workspace-session";
import { Skeleton } from "@/components/ui/skeleton";

/** Desktop only, read-only identity; the owner-scoped key never reuses another account. */
export default function SidebarAccount() {
  const { ownerId } = useWorkspaceSession();
  const { data, isPending } = useQuery({
    queryKey: ["workspace-sidebar-account", ownerId],
    enabled: Boolean(ownerId),
    staleTime: 60_000,
    queryFn: async () => {
      const [profile, preferences] = await Promise.all([
        supabase.from("user_profiles").select("first_name, last_name, display_name").eq("id", ownerId!).maybeSingle(),
        supabase.from("user_preferences").select("curriculum_region").eq("user_id", ownerId!).maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      const name = [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(" ") || profile.data?.display_name || "Your account";
      const initials = name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
      return { name, initials, region: preferences.error ? "" : preferences.data?.curriculum_region || "" };
    },
  });

  if (isPending && ownerId) return <div className="flex min-w-0 flex-1 items-center gap-2" aria-label="Loading account details"><Skeleton className="h-8 w-8 shrink-0 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-full" /><Skeleton className="h-2.5 w-8" /></div></div>;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2" aria-label="Your account details">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground" aria-hidden="true">{data?.initials || "?"}</span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold" title={data?.name}>{data?.name || "Your account"}</p>
        {data?.region && <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={data.region}>{data.region}</p>}
      </div>
    </div>
  );
}
