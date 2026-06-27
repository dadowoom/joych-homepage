import { useRef } from "react";
import { CalendarDays } from "lucide-react";

type BirthDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  name?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
};

export function formatBirthDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function isCompleteBirthDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function BirthDateInput({
  value,
  onChange,
  className = "",
  name = "birthDate",
  required,
  "aria-invalid": ariaInvalid,
}: BirthDateInputProps) {
  const calendarRef = useRef<HTMLInputElement>(null);

  const openCalendar = () => {
    const calendar = calendarRef.current;
    if (!calendar) return;

    if (typeof calendar.showPicker === "function") {
      calendar.showPicker();
      return;
    }

    calendar.click();
  };

  return (
    <div className="relative">
      <input
        type="text"
        name={name}
        autoComplete="bday"
        inputMode="numeric"
        maxLength={10}
        value={value}
        onChange={(event) => onChange(formatBirthDateInput(event.target.value))}
        placeholder="YYYY-MM-DD"
        required={required}
        aria-invalid={ariaInvalid}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={openCalendar}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-[#1B5E20]"
        aria-label="달력에서 생년월일 선택"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={calendarRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={isCompleteBirthDate(value) ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="pointer-events-none absolute right-0 top-0 h-full w-10 opacity-0"
      />
    </div>
  );
}
