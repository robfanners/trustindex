"use client";

import Link from "next/link";

type ChainNode = {
  type: string;
  label: string;
  href?: string;
  active?: boolean;
};

type LinkedChainProps = {
  chain: ChainNode[];
};

function NodePill({ node }: { node: ChainNode }) {
  const activeClasses = "bg-brand/10 text-brand border border-brand/30";
  const inactiveClasses = node.href
    ? "bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer"
    : "bg-muted text-muted-foreground";

  const className = `px-2.5 py-1 rounded-full text-xs font-medium inline-block ${
    node.active ? activeClasses : inactiveClasses
  }`;

  if (node.href && !node.active) {
    return (
      <Link href={node.href} className={className}>
        {node.label}
      </Link>
    );
  }

  return <span className={className}>{node.label}</span>;
}

export default function LinkedChain({ chain }: LinkedChainProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chain.map((node, i) => (
        <div key={`${node.type}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-muted-foreground/50 text-xs">&rarr;</span>
          )}
          <NodePill node={node} />
        </div>
      ))}
    </div>
  );
}
