import { supabase } from '@/integrations/supabase/client';
import { ResponseDraftSession, type DraftScope } from './response-draft-session';
/** Browser adapter; all authorization and revision checks remain server-side. */
export function createResponseDraftSession(scope: DraftScope, onChange?: () => void) {
    return new ResponseDraftSession(scope, async (body) => {
        const { data, error } = await supabase.functions.invoke('question-response', { body });
        if (error) {
            const response = (error as any).context;
            const details = response instanceof Response ? await response.clone().json().catch(() => null) : null;
            throw Object.assign(new Error(details?.error ?? 'Draft request failed. Your current answer is still on this page.'), { status: response instanceof Response ? response.status : 503 });
        }
        if (!data || data.error)
            throw new Error(data?.error ?? 'Draft request was not confirmed');
        return data;
    }, onChange);
}
