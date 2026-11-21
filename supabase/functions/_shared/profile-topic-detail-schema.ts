import { z } from "zod";

/** Owned source excerpts; omitted from model input/output and shared attempts. */
export const topicDetailsSchema = z.array(z.object({
  topic: z.string().trim().min(1).max(180),
  path: z.array(z.string().trim().min(1).max(180)).max(4),
  sources: z.array(z.object({
    documentId: z.string().trim().min(1).max(120),
    page: z.number().int().min(1).max(240),
    text: z.string().trim().min(1).max(2400),
  }).strict()).min(1).max(3),
}).strict()).min(1).max(400).superRefine((details, context) => {
  const characters = details.reduce((sum, detail) => sum + detail.sources.reduce(
    (total, source) => total + source.text.length, 0), 0);
  if (characters > 160_000)
    context.addIssue({ code: "custom", message: "Detailed syllabus content exceeds the bounded reader capacity." });
});

export type ProfileTopicDetail = z.infer<typeof topicDetailsSchema>[number];
