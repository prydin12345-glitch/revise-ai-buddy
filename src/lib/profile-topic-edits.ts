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
  if (t.topicEdits) {
    t.topicEdits = t.topicEdits.filter(edit => topics.includes(edit.topic));
    if (!t.topicEdits.length) delete t.topicEdits;
  }
  if (sourceTopics) {
    const added = topics.filter((x) => !sourceTopics.includes(x));
    if (added.length) t.addedTopics = added;
    else delete t.addedTopics;
    if (added.length || sourceTopics.some((topic) => !topics.includes(topic)))
      t.mode = "custom";
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

/** Change presentation only: saved quiz tags, evidence and part IDs stay stable. */
export function editProfileTopic(
  template: ProfileTemplate, topic: string, label: string, notes: string,
): ProfileTemplate {
  if (!template.topics.includes(topic)) throw Error("This subtopic is no longer in the profile.");
  const nextLabel = label.trim(), nextNotes = notes.trim();
  if (!nextLabel) throw Error("Enter a subtopic name.");
  if (nextLabel.length > 180 || nextNotes.length > 1000)
    throw Error("Use at most 180 characters for the name and 1,000 for your notes.");
  const next = structuredClone(template);
  const entries = next.topicEdits?.filter(edit => edit.topic !== topic) ?? [];
  if (nextLabel !== topic || nextNotes)
    entries.push({ topic, ...(nextLabel !== topic ? { label: nextLabel } : {}),
      ...(nextNotes ? { notes: nextNotes } : {}) });
  if (entries.length) next.topicEdits = entries;
  else delete next.topicEdits;
  return next;
}

export function removeProfileTopics(
  template: ProfileTemplate, removed: readonly string[], sourceTopics: string[] | null,
): ProfileTemplate {
  const topics = template.topics.filter(topic => !removed.includes(topic));
  if (!topics.length) throw Error("Keep at least one subtopic in this profile.");
  return applyTopicEdit(template, topics, sourceTopics);
}

export function addProfileTopic(
  template: ProfileTemplate, raw: string, sourceTopics: string[] | null,
): ProfileTemplate {
  const topic = raw.trim();
  if (!topic || topic.length > 180) throw Error("Enter a subtopic name of up to 180 characters.");
  if (template.topics.some(existing => existing.toLowerCase() === topic.toLowerCase()))
    throw Error("This subtopic is already included.");
  if (template.topics.length >= 400) throw Error("A profile can include at most 400 subtopics.");
  if (sourceTopics && !sourceTopics.includes(topic) && (template.addedTopics?.length ?? 0) >= 40)
    throw Error("A profile can include at most 40 topics added by you.");
  return applyTopicEdit(template, [...template.topics, topic], sourceTopics);
}

/** Restore only topic state; keep subsequent settings and question-layout edits. */
export function restoreProfileTopicState(
  current: ProfileTemplate, previous: ProfileTemplate,
): ProfileTemplate {
  const next = applyTopicEdit(current, previous.topics, null);
  for (const key of ["addedTopics", "topicEdits"] as const) {
    if (previous[key]) Object.assign(next, { [key]: structuredClone(previous[key]) });
    else delete next[key];
  }
  const priorParts = new Map(previous.sections.flatMap(section => section.groups
    .flatMap(group => group.parts.map(part => [part.id, part.topic] as const))));
  for (const section of next.sections) for (const group of section.groups) for (const part of group.parts) {
    const topic = priorParts.get(part.id);
    if (topic && next.topics.includes(topic)) part.topic = topic;
  }
  next.mode = previous.mode;
  return next;
}

/** Restore the source pool without reverting unrelated settings or part marks. */
export function restoreProfileSourceTopics(
  current: ProfileTemplate, sourceTopics: string[], baseline: ProfileTemplate,
): ProfileTemplate {
  if (!sourceTopics.length) throw Error("This profile has no saved syllabus topic list to restore.");
  const restored = applyTopicEdit(current, sourceTopics, sourceTopics);
  const edits = new Map(baseline.topicEdits?.map(edit => [edit.topic, edit]) ?? []);
  for (const edit of current.topicEdits ?? []) edits.set(edit.topic, edit);
  const valid = [...edits.values()].filter(edit => sourceTopics.includes(edit.topic));
  if (valid.length) restored.topicEdits = structuredClone(valid);
  else delete restored.topicEdits;
  // Reuse original assignments when their stable part IDs still exist.
  return restoreProfileTopicState(restored, { ...restored, sections: baseline.sections });
}
