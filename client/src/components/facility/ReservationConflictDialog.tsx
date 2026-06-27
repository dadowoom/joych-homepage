import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CONFLICT_MESSAGE_MARKERS = [
  "이미 예약",
  "중복 예약",
  "시간이 겹",
  "선택하신 시간대",
  "해당 시간대",
];

export function isReservationConflictMessage(message: string | null | undefined) {
  if (!message) return false;
  return CONFLICT_MESSAGE_MARKERS.some(marker => message.includes(marker));
}

type ReservationConflictDialogProps = {
  message: string | null;
  onClose: () => void;
};

export default function ReservationConflictDialog({
  message,
  onClose,
}: ReservationConflictDialogProps) {
  return (
    <Dialog open={Boolean(message)} onOpenChange={open => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={event => event.preventDefault()}
        className="max-w-md rounded-2xl border-red-100 p-0"
      >
        <div className="border-b border-red-100 bg-red-50 px-6 py-5">
          <DialogHeader className="text-left">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-red-500 shadow-sm">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900">
              예약 시간이 겹칩니다
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-6 text-red-700">
              이미 등록된 예약과 시간이 겹쳐 예약이 저장되지 않았습니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-6 py-5">
          <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
            {message}
          </p>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            기존 예약 시간을 확인한 뒤 다른 날짜나 시간을 선택해 주세요.
          </p>
        </div>
        <DialogFooter className="border-t border-gray-100 px-6 py-4">
          <Button type="button" onClick={onClose} className="bg-[#1B5E20]">
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
