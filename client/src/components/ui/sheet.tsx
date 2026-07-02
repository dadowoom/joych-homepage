"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SheetPosition = {
  x: number;
  y: number;
};

function getStoredSheetPosition(storageKey: string): SheetPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Partial<SheetPosition>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return parsed as SheetPosition;
  } catch {
    return null;
  }
}

function clampSheetPosition(position: SheetPosition, element?: HTMLElement | null): SheetPosition {
  if (typeof window === "undefined") return position;
  const width = element?.offsetWidth ?? 420;
  const height = element?.offsetHeight ?? 480;
  const margin = 12;
  return {
    x: Math.min(Math.max(position.x, margin), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(position.y, margin), Math.max(margin, window.innerHeight - Math.min(height, window.innerHeight - margin * 2) - margin)),
  };
}

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showOverlay = true,
  draggableKey,
  dragHandleLabel = "패널 위치 이동",
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showOverlay?: boolean;
  draggableKey?: string;
  dragHandleLabel?: string;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const storageKey = draggableKey ? `joych-sheet-position:${draggableKey}` : null;
  const [position, setPosition] = React.useState<SheetPosition | null>(() =>
    storageKey ? getStoredSheetPosition(storageKey) : null,
  );

  React.useEffect(() => {
    if (!storageKey || !position) return;
    const handleResize = () => {
      setPosition((current) => {
        if (!current) return current;
        const next = clampSheetPosition(current, contentRef.current);
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position, storageKey]);

  const handleDragPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!storageKey || event.button !== 0) return;
    const contentElement = contentRef.current;
    if (!contentElement) return;
    event.preventDefault();

    const rect = contentElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const next = clampSheetPosition(
        {
          x: moveEvent.clientX - offsetX,
          y: moveEvent.clientY - offsetY,
        },
        contentElement,
      );
      setPosition(next);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const resetPosition = () => {
    if (!storageKey) return;
    setPosition(null);
    window.localStorage.removeItem(storageKey);
  };

  const resolvedStyle = position
    ? {
        ...style,
        left: position.x,
        top: position.y,
        right: "auto",
        bottom: "auto",
      }
    : style;

  return (
    <SheetPortal>
      {showOverlay ? <SheetOverlay /> : null}
      <SheetPrimitive.Content
        ref={contentRef}
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        )}
        style={resolvedStyle}
        {...props}
      >
        {storageKey ? (
          <button
            type="button"
            onPointerDown={handleDragPointerDown}
            onDoubleClick={resetPosition}
            title="드래그해서 패널 이동, 더블클릭하면 기본 위치"
            aria-label={dragHandleLabel}
            className="absolute left-4 top-4 z-20 flex h-8 w-8 cursor-move items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 shadow-sm transition hover:border-[#1B5E20] hover:text-[#1B5E20]"
          >
            <span className="text-base leading-none">↕</span>
          </button>
        ) : null}
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
