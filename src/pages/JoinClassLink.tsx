import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { JoinClassModal } from '@/components/tutor/JoinClassModal';
import { PageHeader } from '@/components/PageHeader';

/** Existing invite links open the existing lookup/confirmation flow, never auto-join. */
export default function JoinClassLink() {
  const { inviteCode = '' } = useParams();
  const navigate = useNavigate();
  const close = () => navigate('/my-classes', { replace: true });
  return <DashboardLayout>
    <PageHeader title="Class invitation" subtitle="Check the class details before choosing to join." backTo="/my-classes" />
    <JoinClassModal key={inviteCode} open initialInviteCode={inviteCode} onOpenChange={open => { if (!open) close(); }} onSuccess={close} />
  </DashboardLayout>;
}
