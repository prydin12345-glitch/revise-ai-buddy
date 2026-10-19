import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceSession } from "@/hooks/use-workspace-session";
import { refreshLibraryItemCaches, type LibraryKind } from "@/lib/library-item-cache";
import { toast } from "@/hooks/use-toast";

export interface LibraryItem { id: string; title: string; user_id?: string; status: string; }

/** No optimistic deletion: only an owned, returned row counts as a successful write. */
export function useLibraryItemActions(kind: LibraryKind) {
  const { ownerId, store } = useWorkspaceSession();
  const queryClient = useQueryClient();
  const locks = useRef(new Set<string>());
  const [pending, setPending] = useState(new Set<string>());
  const [deleteItem, setDeleteItem] = useState<LibraryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const latestStore = useRef(store);
  latestStore.current = store;
  useEffect(() => { locks.current = new Set(); setPending(new Set()); setDeleteItem(null); setDeleteError(null); }, [store]);
  const perform = async (item: LibraryItem, action: "delete" | "archive") => {
    const requestLocks = locks.current;
    if (requestLocks.has(item.id)) return false;
    requestLocks.add(item.id); setPending(new Set(requestLocks)); setDeleteError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || user.id !== ownerId || item.user_id !== user.id) throw new Error("Only the owner can change this item. Refresh the library and try again.");
      if (action === "archive" && item.status !== "published" && item.status !== "archived") throw new Error("Only published items can be archived. Finish creating this item first.");
      const table = kind === "exam" ? "exams" : "practice_question_sets";
      const status = item.status === "archived" ? "published" : "archived";
      const request = action === "delete" ? supabase.from(table).delete() : supabase.from(table).update({ status });
      const ownedRequest = request.eq("id", item.id).eq("user_id", user.id);
      const { data, error } = await (action === "archive" ? ownedRequest.eq("status", item.status) : ownedRequest).select("id").single();
      if (error) throw error;
      if (data?.id !== item.id) throw new Error("The item was not changed. It may no longer exist or you may not have access.");
      if (latestStore.current !== store) return false;
      await refreshLibraryItemCaches(store, queryClient, kind, item.id, action === "delete" ? undefined : status);
      if (latestStore.current !== store) return false;
      toast({ title: action === "delete" ? "Deleted" : status === "archived" ? "Archived" : "Restored", description: `“${item.title}” ${action === "delete" ? "was deleted." : status === "archived" ? "is in your archive." : "is back in your library."}` });
      return true;
    } catch (error) {
      if (latestStore.current !== store) return false;
      const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "Couldn’t save this change. Please try again.";
      if (action === "delete") setDeleteError(message);
      else toast({ title: "Couldn’t update item", description: message, variant: "destructive" });
      return false;
    } finally { requestLocks.delete(item.id); if (latestStore.current === store) setPending(new Set(requestLocks)); }
  };
  return {
    pending, deleteItem, deleteError,
    requestDelete: (item: LibraryItem) => { if (!locks.current.has(item.id)) { setDeleteError(null); setDeleteItem(item); } },
    closeDelete: () => { if (!deleteItem || !locks.current.has(deleteItem.id)) { setDeleteItem(null); setDeleteError(null); } },
    confirmDelete: async () => { if (deleteItem && await perform(deleteItem, "delete")) { setDeleteItem(null); return true; } return false; },
    archive: (item: LibraryItem) => perform(item, "archive"),
  };
}
