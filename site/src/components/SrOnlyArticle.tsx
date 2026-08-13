import type { Atlas } from "@/atlas/types";
import atlasData from "@/data/atlas.json";
import entriesData from "@/data/entries.json";

const atlas = atlasData as unknown as Atlas;
const entries = entriesData as Record<
  string,
  {
    label: string;
    definition: string;
    heard: { question: string; answer: string } | null;
  }
>;

/**
 * The complete dictionary as real HTML, rendered on the server.
 *
 * Three jobs at once. It is the accessibility fallback, so the content is
 * reachable without WebGL and with JavaScript disabled. It is the entire SEO
 * surface, since the site is a single canvas route. And it is where EntryPanel
 * reads its content from, which keeps entries.json out of the client bundle —
 * the content crosses the wire as markup, and the panel can never drift from
 * what a screen reader gets.
 *
 * The parts are marked up separately because the panel shows them separately.
 */
export default function SrOnlyArticle() {
  return (
    <article
      className="sr-only"
      id="dictionary"
      aria-label="AI infrastructure dictionary"
    >
      <h1>The AI Infrastructure Dictionary</h1>
      <p>
        The vocabulary of AI infrastructure in plain English:{" "}
        {atlas.nodes.length} terms across {atlas.sections.length} sections, and
        how they connect.
      </p>

      {atlas.sections.map((section) => (
        <section key={section.index} aria-labelledby={`sec-${section.index}`}>
          <h2 id={`sec-${section.index}`}>{section.title}</h2>
          {atlas.nodes
            .filter((n) => n.section === section.index)
            .map((node) => {
              const entry = entries[node.id];
              if (!entry) return null;
              return (
                <article
                  key={node.id}
                  id={`entry-${node.id}`}
                  data-term={node.id}
                >
                  <h3>{node.label}</h3>
                  <p className="entry-desc">{node.description}</p>

                  {entry.heard && (
                    <div className="entry-heard">
                      <p className="entry-heard-q">{entry.heard.question}</p>
                      <p className="entry-heard-a">{entry.heard.answer}</p>
                    </div>
                  )}

                  <div
                    className="entry-definition"
                    // First-party content, generated from dictionary/*.md. The
                    // generator rejects raw HTML in entry bodies, so the
                    // trusted-content invariant is checked, not assumed.
                    dangerouslySetInnerHTML={{ __html: entry.definition }}
                  />
                </article>
              );
            })}
        </section>
      ))}
    </article>
  );
}
