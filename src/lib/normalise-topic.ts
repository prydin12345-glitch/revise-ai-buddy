import { supabase } from "@/integrations/supabase/client";

// Cache aliases in memory after first fetch
let aliasCache: Record<string, string> | null = null;

/**
 * Normalise a raw topic tag to its canonical form using the topic_aliases table.
 * Falls back to the original string if no alias mapping exists.
 */
export const normaliseTopicTag = async (rawTag: string): Promise<string> => {
  if (!rawTag) return rawTag;

  if (!aliasCache) {
    const { data } = await supabase
      .from("topic_aliases" as any)
      .select("alias, canonical_topic");

    aliasCache = {};
    (data as any[])?.forEach((row: any) => {
      aliasCache![row.alias.toLowerCase().trim()] = row.canonical_topic;
    });
  }

  const key = rawTag.toLowerCase().trim();
  return aliasCache[key] ?? rawTag;
};

/**
 * Batch normalise an array of topic tags.
 * Returns a mapping from original tag → canonical tag.
 */
export const normaliseTopicTags = async (
  tags: string[]
): Promise<Record<string, string>> => {
  const results: Record<string, string> = {};
  for (const tag of tags) {
    results[tag] = await normaliseTopicTag(tag);
  }
  return results;
};

/** Clear the alias cache (e.g. after seeding new aliases). */
export const clearAliasCache = () => {
  aliasCache = null;
};
