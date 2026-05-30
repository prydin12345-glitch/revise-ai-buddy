import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "student" | "teacher" | "tutor" | "admin";

export const useUserRole = () => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log("useUserRole: No authenticated user found");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role, metadata")
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (error) throw error;

        if (data) {
          const userRoles = data.map((r) => r.role as AppRole);
          setRoles(userRoles);
          
          const primary = data.find((r) => {
            const metadata = r.metadata as Record<string, any> | null;
            return metadata?.is_primary === true;
          });
          setPrimaryRole(primary ? (primary.role as AppRole) : userRoles[0] || null);
          
          if (userRoles.length === 0) {
            console.log("useUserRole: No roles found for user");
          }
        }
      } catch (error) {
        console.error("Error fetching user roles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();

    // Re-fetch only on actual sign-in (ignore TOKEN_REFRESHED / INITIAL_SESSION duplicates)
    let lastUid: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const uid = session?.user?.id ?? null;
        if (event === 'SIGNED_IN' && uid && uid !== lastUid) {
          lastUid = uid;
          console.log("useUserRole: User signed in, re-fetching roles");
          setLoading(true);
          fetchRoles();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);


  const hasRole = (role: AppRole) => roles.includes(role);

  return { roles, primaryRole, loading, hasRole };
};
