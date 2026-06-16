export type ViewMode = "list" | "grid";

type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
};

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  const buttonClass = (mode: ViewMode) =>
    `flex h-6 w-6 items-center justify-center border transition-colors ${
      value === mode
        ? "border-[#86C5D8] bg-white text-[#1B5E20]"
        : "border-gray-200 bg-gray-50 text-gray-300 hover:border-[#86C5D8] hover:text-[#1B5E20]"
    }`;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="view mode">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={buttonClass("list")}
        aria-label="list view"
        aria-pressed={value === "list"}
      >
        <span className={`h-3.5 w-3.5 border-y-2 ${value === "list" ? "border-[#1B5E20]" : "border-current"}`} />
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={buttonClass("grid")}
        aria-label="grid view"
        aria-pressed={value === "grid"}
      >
        <span className="grid grid-cols-2 gap-0.5">
          <span className={`h-1.5 w-1.5 ${value === "grid" ? "bg-[#1B5E20]" : "bg-current"}`} />
          <span className={`h-1.5 w-1.5 ${value === "grid" ? "bg-[#1B5E20]" : "bg-current"}`} />
          <span className={`h-1.5 w-1.5 ${value === "grid" ? "bg-[#1B5E20]" : "bg-current"}`} />
          <span className={`h-1.5 w-1.5 ${value === "grid" ? "bg-[#1B5E20]" : "bg-current"}`} />
        </span>
      </button>
    </div>
  );
}
