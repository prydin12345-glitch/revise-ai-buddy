import type { BuilderAttachment } from "@/hooks/useBuilderAttachments";
import type { AssessmentDiscoveryResult } from "../../supabase/functions/_shared/profile-assessment-discovery";
import type { TemplateIdentity } from "../../supabase/functions/_shared/profile-template";

/** Local, read-only assessment choices. This never calls a provider or saves a profile. */
export async function inspectProfileAttachments(
  files: ReadonlyArray<
    Pick<BuilderAttachment, "id" | "contentType" | "base64">
  >,
  scope: Partial<TemplateIdentity>,
): Promise<AssessmentDiscoveryResult> {
  if (!files.length || files.length > 3)
    throw Error("Attach up to three readable source files first.");
  const [
    { getDocumentProxy },
    { extractIndexedPdfPages },
    { discoverSourceAssessments },
    { checksum },
  ] = await Promise.all([
    import("unpdf"),
    import("../../supabase/functions/_shared/profile-document-io"),
    import("../../supabase/functions/_shared/profile-assessment-discovery"),
    import("../../supabase/functions/_shared/profile-template"),
  ]);
  let total = 0;
  const documents = [];
  for (const file of files) {
    const bytes = Uint8Array.from(atob(file.base64), (char) =>
      char.charCodeAt(0),
    );
    total += bytes.length;
    if (!bytes.length || bytes.length > 3_000_000 || total > 6_000_000)
      throw Error(
        "Use readable source files up to 3 MB each and 6 MB together.",
      );
    const digest = await checksum(bytes);
    const pages =
      file.contentType === "application/pdf"
        ? await extractIndexedPdfPages(bytes, getDocumentProxy as any)
        : [new TextDecoder("utf-8", { fatal: true }).decode(bytes)];
    if (pages.reduce((sum, page) => sum + page.length, 0) > 600_000)
      throw Error(
        "This source has too much text to inspect. Use its assessment specification or brief.",
      );
    documents.push({ id: file.id, checksum: digest, pages });
  }
  return discoverSourceAssessments(documents, scope);
}
