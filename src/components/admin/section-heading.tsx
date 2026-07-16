import { DataLabel } from "@/components/ui/prose";

export function SectionHeading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <DataLabel>{label}</DataLabel>
        <h2 className="mt-1 font-display text-display-md">{title}</h2>
      </div>
      {children}
    </div>
  );
}
