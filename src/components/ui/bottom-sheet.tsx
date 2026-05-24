import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  // Force fresh mount every time dialog opens
  const openCountRef = useRef(0)
  const [dialogKey, setDialogKey] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      openCountRef.current += 1
      setDialogKey(openCountRef.current)
      setCountdown(3)
    }
  }, [open])

  // Reset timer on user interaction
  const resetTimer = () => {
    setCountdown(3)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  // Auto-close after 3 seconds
  useEffect(() => {
    if (!open) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setCountdown(3)
      return
    }

    setCountdown(3)
    const tick = (remaining: number) => {
      if (remaining <= 0) {
        onClose()
        return
      }
      setCountdown(remaining)
      timerRef.current = setTimeout(() => tick(remaining - 1), 1000)
    }
    timerRef.current = setTimeout(() => tick(2), 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open, onClose])

  return (
    <Dialog.Root
      key={dialogKey}
      open={open}
      onOpenChange={(v) => { if (!v) onClose() }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={onClose}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-sm max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-xl md:hidden focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => { e.preventDefault(); onClose() }}
          onEscapeKeyDown={onClose}
        >
          <div className="sticky top-0 bg-white rounded-t-2xl z-10 flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
            <span className="text-xs text-gray-400 font-mono">
              Auto-close in {countdown}s
            </span>
            <Dialog.Close className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-full" onClick={onClose}>
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
