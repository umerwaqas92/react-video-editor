import { X } from 'lucide-react'
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
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          width: 'calc(100% - 2rem)',
          maxWidth: '24rem',
          maxHeight: '80vh',
          overflow: 'auto',
          borderRadius: '1rem',
          backgroundColor: 'white',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          pointerEvents: 'auto',
          touchAction: 'manipulation',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100 rounded-t-xl">
          <span className="text-xs text-gray-400">Tap outside to close</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  )
}
