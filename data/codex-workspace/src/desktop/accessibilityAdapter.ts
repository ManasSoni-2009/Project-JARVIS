/**
 * vercel-labs/agent-desktop Semantic Tree Adapter
 * Maps native OS accessibility nodes to deterministic @ref handles.
 */
export interface ElementRef {
  ref: string;
  role: string;
  label: string;
  bounds: [number, number, number, number];
}

export function formatRefEnvelope(nodes: ElementRef[]) {
  return {
    schema: "agent-desktop/v1",
    count: nodes.length,
    refs: nodes.map((n) => n.ref),
  };
}
