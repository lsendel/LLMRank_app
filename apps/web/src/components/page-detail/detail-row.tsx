interface DetailRowProps {
  label: string;
  value?: string | null;
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-sm break-all">{value ?? "--"}</span>
    </div>
  );
}
