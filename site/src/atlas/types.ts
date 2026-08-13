// Shape of site/src/data/atlas.json, emitted by internal/generate-site.ts.

export type AtlasSection = {
  index: number;
  title: string;
};

export type AtlasNode = {
  /** Dense index. The only id GL buffers use. */
  i: number;
  /** Stable slug, used in URLs, anchors and data attributes. */
  id: string;
  label: string;
  aliases: string[];
  section: number;
  description: string;
  x: number;
  y: number;
  z: number;
  degree: number;
  related: number[];
  outbound: number[];
  inbound: number[];
  status: "published" | "draft";
};

export type AtlasEdge = {
  a: number;
  b: number;
  /** Neighbourhood cosine similarity, 0..1. */
  w: number;
  /** 1 = backbone, 0 = secondary. */
  t: 0 | 1;
  /** Signed curvature offset. */
  c: number;
};

export type Atlas = {
  sections: AtlasSection[];
  nodes: AtlasNode[];
  edges: AtlasEdge[];
};
