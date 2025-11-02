import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function RedirectToReview() {
  const { draftId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (draftId) {
      navigate(`/upload/${draftId}/review-questions`, { replace: true });
    }
  }, [draftId, navigate]);

  return null;
}
