README.md is a generated file, generated via internal/README.template.md. site/src/data/ is generated too, from the same source. Run `npm run generate` after any content change.

Links to other entries should only have a link on the first occurrence. I.e. if KV cache appears twice in the entry, only the first should have an outward link.

New entries must be added to dictionary/, and found a place in internal/Curriculum.md

Each entry must have a `description` field in the frontmatter. Each description must be less than 140 characters long.

Co-locate each concept with the real-life problem it explains. Where a term has a recognisable symptom — a felt failure or surprise the reader has likely hit — weave that symptom into the prose near the definition, so the reader recognises their own incident in the entry. Woven prose, not a named section. Vocabulary/building-block terms (e.g. Token, Parameter count) have no symptom; don't force a fake one.

Each entry should be at least 200 words long (counting the body and the Usage dialogue, not the frontmatter). Reach the minimum with substance — mechanism, symptom, what to do about it — never with padding.

Prefer tables for structured material: lifecycles (step / who / what happens), ladders of options, and similar. See `dictionary/Precision.md` and `dictionary/Latency.md` for examples. Don't force prose into a table when it isn't naturally stepped or comparative.

Write in a plain, de-hyped register. No selling the concept: avoid superlatives ("the fastest interconnect there is"), dramatised moments ("You'll recognise the moment", "That's the signal to"), and emphasis words like "core", "whole value", "real power", "straight into". State what happens and what to do, flatly.

The first sentence used in a paragraph must be extra-clear. Don't attempt to pre-hype the paragraph by using a clever phrase first.

Whenever a new entry is added, search through all other entries to see if it can be referenced there. The presence of a new term may be able to reduce verbosity in other entries.

## Project-specific conventions

Use US spelling for technical terms — `quantization`, `utilization`, `optimization`, `normalize`. This is what `nvidia-smi` prints and what the papers write. The surrounding prose register can stay plain English either way; don't switch a metric's name to a British spelling.

Runpod is spelled with one capital R and a lowercase p. Every prose mention must match the filename exactly or the cross-link breaks.

Entries carry no headings, no code fences, and no diagrams. The filename is the title; the generator emits it as the heading. Tables are allowed and encouraged where the material is genuinely comparative.

## Deployment

Build settings live in `vercel.json` so the dashboard needs no configuration.
That file is validated against a strict schema — it accepts only known keys, so
it cannot carry comments, including the `"//"` convention. The reasoning behind
each setting is here instead:

- **The build must run from the repository root**, never from `site/`. The
  generators in `internal/` read `dictionary/` and `internal/Curriculum.md` and
  write both `README.md` and `site/src/data/`. Rooted at `site/` they never run,
  so a content change deploys the last committed data and the build still goes
  green. If an import screen offers to set the root directory to `site`, decline.
- **`framework` is `null`, not `nextjs`.** `next.config.ts` sets
  `output: "export"`, so the artifact is plain static files in `site/out`.
  Declaring Next.js sends the host looking for a `.next` build at the root.
- **`prepare` is `husky || true`.** Bare `husky` exits non-zero where there is no
  `.git` directory, which fails `npm install` on any host that builds from a
  source archive rather than a clone. Hooks still install normally in a clone.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, accessed via the `gh` CLI. See `internal/issue-tracker.md`.

### Triage labels

Default canonical label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `internal/triage-labels.md`.

### Domain docs

Single-context layout, nested under `internal/` (`internal/CONTEXT.md`, `internal/adr/`). See `internal/domain.md`.
