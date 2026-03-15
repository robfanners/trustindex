import Link from "next/link";

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export default function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaAction,
  secondaryLabel,
  secondaryHref,
}: EmptyStateProps) {
  return (
    <div className="border border-dashed border-border rounded-xl p-12 text-center">
      <div className="flex justify-center">
        <div className="w-12 h-12 text-muted-foreground/50">{icon}</div>
      </div>
      <h3 className="text-base font-medium text-foreground mt-4">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        {description}
      </p>
      {ctaLabel && ctaAction && (
        <button
          type="button"
          onClick={ctaAction}
          className="mt-4 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          {ctaLabel}
        </button>
      )}
      {secondaryLabel && secondaryHref && (
        <div className="mt-2">
          <Link
            href={secondaryHref}
            className="text-sm text-brand hover:underline"
          >
            {secondaryLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
