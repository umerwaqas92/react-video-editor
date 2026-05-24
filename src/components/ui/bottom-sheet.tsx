import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

let mountId = 0

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const [instanceKey] = useState(() => ++mountId)
  const [countdown, setCountdown] = useState(3)

  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const countdownRef = useRef(3)

  // Reset-timer function — call on any interaction
  const resetTimer = () => {
    setCountdown(3)
    countdownRef.current = 3
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  // Auto-close after 3s of no interaction
  useEffect(() => {
    if (!open) {
      setCountdown(3)
      return
    }
    setCountdown(3)
    countdownRef.current = 3

    const tick = () => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
      if (countdownRef.current <= 0) {
        onClose()
        return
      }
      timerRef.current = setTimeout(tick, 1000)
    }
    timerRef.current = setTimeout(tick, 1000)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [open, onClose])

  return (
    <Dialog.Root
      key={open ? `open-${instanceKey}` : `closed-${instanceKey}`}
      open={open}
      onOpenChange={(v) => { if (!v) onClose() }}
      modal
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-sm max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-xl md:hidden focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="sticky top-0 bg-white rounded-t-2xl z-10 flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
            <span className="text-xs text-gray-400 font-mono">
              Auto-close in {countdown}s
            </span>
            <Dialog.Close className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-full">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>
          <div
            className="px-4 pb-6 pt-2"
            onTouchStart={resetTimer}
            onPointerDown={resetTimer}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
