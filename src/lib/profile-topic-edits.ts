import type { ProfileTemplate } from "../../supabase/functions/_shared/profile-template";

/**
 * Apply a student's topic list to a template. Topics the source did not list
 * are recorded as student additions, and question parts whose topic was
 * removed are spread across the remaining topics so the plan stays valid.
 */
export function applyTopicEdit(
  template: ProfileTemplate,
  nextTopics: string[],
  sourceTopics: string[] | null,
): ProfileTemplate {
  const topics = [...new Set(nextTopics.map((t) => t.trim()).filter(Boolean))];
  const t: ProfileTemplate = structuredClone(template);
  t.topics = topics;
  if (sourceTopics) {
    const added = topics.filter((x) => !sourceTopics.includes(x));
    if (added.length) t.addedTopics = added;
    else delete t.addedTopics;
  }
  if (!topics.length) return t;
  let next = 0;
  for (const section of t.sections)
    for (const group of section.groups)
      for (const part of group.parts)
        if (!topics.includes(part.topic)) {
          part.topic = topics[next % topics.length];
          next++;
        }
  return t;
}
