import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface ProfileTopicSource {
  documentId: string;
  /** Physical PDF page, rather than the document's printed page label. */
  page: number;
  text: string;
}

export interface ProfileTopicDetail {
  topic: string;
  path: string[];
  sources: ProfileTopicSource[];
}

export interface ProfileTopicDocument {
  id: string;
  title: string;
}

export interface ProfileTopicListProps {
  topics: string[];
  addedTopics?: string[];
  details?: ProfileTopicDetail[];
  documents?: ProfileTopicDocument[];
  /** The parent knows whether this is a source-backed profile. */
  showSourceHint?: boolean;
}

interface TopicLeaf {
  kind: "topic";
  topic: string;
  added: boolean;
  path: string[];
  sources: ProfileTopicSource[];
}

interface TopicGroup {
  kind: "group";
  label: string;
  path: string[];
  count: number;
  children: TopicNode[];
}

type TopicNode = TopicLeaf | TopicGroup;

function groupTopics(leaves: TopicLeaf[]): TopicNode[] {
  const roots: TopicNode[] = [];
  for (const leaf of leaves) {
    let children = roots;
    leaf.path.forEach((label, index) => {
      let group = children.find(
        (node): node is TopicGroup => node.kind === "group" && node.label === label,
      );
      if (!group) {
        group = {
          kind: "group", label, path: leaf.path.slice(0, index + 1),
          count: 0, children: [],
        };
        children.push(group);
      }
      group.count++;
      children = group.children;
    });
    children.push(leaf);
  }
  return roots;
}

function TopicNodes({
  nodes, searching, titles,
}: {
  nodes: TopicNode[];
  searching: boolean;
  titles: Map<string, string>;
}) {
  return (
    <ul className="min-w-0 space-y-2">
      {nodes.map((node) => (
        <li key={node.kind === "group" ? `group:${JSON.stringify(node.path)}` : `topic:${node.topic}`}>
          {node.kind === "group" ? (
            <details open={searching} className="min-w-0 rounded-lg border border-border p-3">
              <summary className="min-h-11 cursor-pointer content-center break-words text-sm font-medium [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {node.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {node.count} {node.count === 1 ? "topic" : "topics"}
                </span>
              </summary>
              <div className="mt-2 min-w-0 border-l border-border pl-3">
                <TopicNodes nodes={node.children} searching={searching} titles={titles} />
              </div>
            </details>
          ) : node.sources.length ? (
            <details open={searching} className="min-w-0 rounded-md bg-muted/30 px-3 py-2">
              <summary className="min-h-11 cursor-pointer content-center break-words text-sm [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {node.topic}
                <span className="ml-2 text-xs text-muted-foreground">Source outcomes</span>
              </summary>
              <ul className="mt-2 space-y-3" aria-label={`Source outcomes for ${node.topic}`}>
                {node.sources.map((source, index) => (
                  <li key={`${source.documentId}:${source.page}:${index}`} className="min-w-0">
                    <p className="break-words text-xs font-medium text-muted-foreground [overflow-wrap:anywhere]">
                      {titles.get(source.documentId) || "Source document"} · PDF page {source.page}
                    </p>
                    <blockquote className="mt-1 whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-sm [overflow-wrap:anywhere]">
                      {source.text}
                    </blockquote>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="min-w-0 break-words rounded-md bg-muted/30 px-3 py-3 text-sm [overflow-wrap:anywhere]">
              {node.topic}
              {node.added && <span className="ml-2 text-xs text-primary">Added by you</span>}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Read-only view of an owned proposal's server-derived topic details. Exact leaf
 * labels remain the identity; paths and source prose never become topic values.
 * No persistence, source fetching or syllabus rebuilding happens here.
 */
export function ProfileTopicList({
  topics, addedTopics = [], details = [], documents = [], showSourceHint = false,
}: ProfileTopicListProps) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const titles = useMemo(
    () => new Map(documents.map((document) => [document.id, document.title])),
    [documents],
  );
  const leaves = useMemo(() => {
    const byTopic = new Map<string, ProfileTopicDetail>();
    for (const detail of details)
      if (!byTopic.has(detail.topic)) byTopic.set(detail.topic, detail);
    const added = new Set(addedTopics);
    return [...new Set(topics)].filter((topic) => topic.trim()).map((topic): TopicLeaf => {
      // Student additions cannot acquire stale source provenance by label alone.
      const detail = added.has(topic) ? undefined : byTopic.get(topic);
      return {
        kind: "topic", topic, added: added.has(topic),
        path: detail?.path.filter((label) => label.trim()) ?? [],
        sources: detail?.sources.filter((source) =>
          Number.isInteger(source.page) && source.page > 0 && source.text.trim(),
        ) ?? [],
      };
    });
  }, [topics, addedTopics, details]);
  const filtered = leaves.filter((leaf) =>
    [leaf.topic, ...leaf.path, ...leaf.sources.flatMap((source) => [source.text, titles.get(source.documentId) ?? ""])]
      .some((text) => text.toLocaleLowerCase().includes(query)),
  );
  const grouped = groupTopics(filtered);
  const hasDetails = leaves.some((leaf) => leaf.path.length || leaf.sources.length);

  return (
    <section aria-label="Profile topics" className="min-w-0 space-y-3">
      {leaves.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor={searchId} className="text-xs font-medium text-muted-foreground">Search topics and source outcomes</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input id={searchId} type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </div>
      )}
      <p role="status" className="text-xs text-muted-foreground">
        {query ? `${filtered.length} of ${leaves.length} topics` : `${leaves.length} ${leaves.length === 1 ? "topic" : "topics"}`}
      </p>
      {!leaves.length ? (
        <p className="text-sm text-muted-foreground">No topics yet.</p>
      ) : !filtered.length ? (
        <p className="text-sm text-muted-foreground">No topics match your search.</p>
      ) : (
        <TopicNodes nodes={grouped} searching={!!query} titles={titles} />
      )}
      {showSourceHint && !!leaves.length && !hasDetails && (
        <p className="text-xs text-muted-foreground">
          This profile saved a flat topic list. Read the syllabus again to recover more detail.
        </p>
      )}
    </section>
  );
}
