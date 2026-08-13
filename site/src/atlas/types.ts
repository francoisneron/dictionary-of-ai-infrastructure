// Shape of site/src/data/atlas.json, emitted by internal/generate-site.ts.

export type AtlasSection = {
  index: number;
  title: string;
  heading: string;
  slug: string;
  nodeCount: number;
  accent: number;
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
  backboneDegree: number;
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
  /** 1 = a->b, 2 = b->a, 3 = mutual. */
  d: 1 | 2 | 3;
  /** Signed curvature offset. */
  c: number;
};

export type Atlas = {
  version: number;
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  sections: AtlasSection[];
  nodes: AtlasNode[];
  edges: AtlasEdge[];
};
