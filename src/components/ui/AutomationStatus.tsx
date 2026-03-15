type AutomationStatusProps = {
  status: "active" | "partial" | "manual";
  label: string;
  onConfigure?: () => void;
};

const dotColors: Record<AutomationStatusProps["status"], string> = {
  active: "bg-emerald-500",
  partial: "bg-amber-500",
  manual: "bg-gray-400",
};

export default function AutomationStatus({
  status,
  label,
  onConfigure,
}: AutomationStatusProps) {
  const content = (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-muted-foreground ${
        onConfigure ? "cursor-pointer hover:bg-muted transition-colors" : ""
      }`}
      onClick={onConfigure}
      role={onConfigure ? "button" : undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[status]}`} />
      <span>{label}</span>
      {status === "manual" && onConfigure && (
        <span className="text-brand ml-0.5">Set up &rarr;</span>
      )}
    </span>
  );

  return content;
}
