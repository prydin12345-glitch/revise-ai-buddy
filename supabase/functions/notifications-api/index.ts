import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Verify user is authenticated via JWT claims (works without active session)
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub as string };

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    console.log(`[notifications-api] User: ${user.id}, Action: ${action}`);

    // GET: List notifications
    if (req.method === "GET" && action === "list") {
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const cursor = url.searchParams.get("cursor"); // created_at cursor

      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching notifications:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[notifications-api] Fetched ${data?.length || 0} notifications for user ${user.id}`);

      return new Response(JSON.stringify({ 
        notifications: data || [],
        nextCursor: data && data.length === limit ? data[data.length - 1]?.created_at : null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Unread count
    if (req.method === "GET" && action === "unread-count") {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`);

      if (error) {
        console.error("Error getting unread count:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[notifications-api] Unread count for user ${user.id}: ${count}`);

      return new Response(JSON.stringify({ unreadCount: count || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Mark as read
    if (req.method === "POST" && action === "mark-read") {
      const body = await req.json();
      const { notificationIds, markAll } = body;

      let updateQuery = supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (markAll) {
        updateQuery = updateQuery.eq("is_read", false);
      } else if (notificationIds && notificationIds.length > 0) {
        updateQuery = updateQuery.in("id", notificationIds);
      } else {
        return new Response(JSON.stringify({ error: "notificationIds or markAll required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error, count } = await updateQuery;

      if (error) {
        console.error("Error marking as read:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[notifications-api] Marked ${count} notifications as read for user ${user.id}`);

      return new Response(JSON.stringify({ success: true, updated: count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Pin/Unpin
    if (req.method === "POST" && action === "pin") {
      const body = await req.json();
      const { notificationId, isPinned } = body;

      const { error } = await supabase
        .from("notifications")
        .update({ is_pinned: isPinned })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error pinning notification:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Snooze
    if (req.method === "POST" && action === "snooze") {
      const body = await req.json();
      const { notificationId, hours = 24 } = body;

      const snoozedUntil = new Date();
      snoozedUntil.setHours(snoozedUntil.getHours() + hours);

      const { error } = await supabase
        .from("notifications")
        .update({ snoozed_until: snoozedUntil.toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error snoozing notification:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, snoozedUntil: snoozedUntil.toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Delete
    if (req.method === "POST" && action === "delete") {
      const body = await req.json();
      const { notificationId } = body;

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting notification:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
