import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";

interface VerificationRequest {
  id: string;
  email: string;
  status: string;
  created_at: string;
  teacher_id: string;
  school_id: string;
  schools: {
    name: string;
    domain: string | null;
  };
}

export default function AdminVerifications() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
    loadVerificationRequests();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const isAdmin = roles?.some(r => r.role === "admin");
      if (!isAdmin) {
        toast.error("Access denied: Admin only");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/dashboard");
    }
  };

  const loadVerificationRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("teacher_verifications")
        .select(`
          *,
          schools (
            name,
            domain
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data as VerificationRequest[]);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast.error("Failed to load verification requests");
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (id: string, status: "verified" | "rejected") => {
    setProcessingId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("teacher_verifications")
        .update({
          status,
          verified_by: user.id,
          verified_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Teacher ${status === "verified" ? "approved" : "rejected"} successfully`);
      loadVerificationRequests();
    } catch (error) {
      console.error("Error processing verification:", error);
      toast.error("Failed to process verification");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Teacher Verifications"
        subtitle="Review and approve teacher verification requests"
      />

      <div className="max-w-4xl mx-auto space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No verification requests</p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{request.email}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      School: {request.schools.name}
                      {request.schools.domain && ` (${request.schools.domain})`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requested: {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.status === "verified"
                        ? "default"
                        : request.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {request.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                    {request.status === "verified" && <CheckCircle className="w-3 h-3 mr-1" />}
                    {request.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                    {request.status}
                  </Badge>
                </div>
              </CardHeader>
              {request.status === "pending" && (
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleVerification(request.id, "verified")}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleVerification(request.id, "rejected")}
                      disabled={processingId === request.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
