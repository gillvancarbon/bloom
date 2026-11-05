import type { ReactNode } from 'react'
import { Leaf } from 'lucide-react'

interface BrandHeaderProps {
  subtitle: string
  /** Tapping the Bloom mark opens Settings. */
  onOpenSettings?: () => void
  children?: ReactNode
}

export function BrandHeader({ subtitle, onOpenSettings, children }: BrandHeaderProps) {
  return (
    <header className="mb-6 flex items-center justify-between gap-3 sm:mb-8 sm:gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
          className="silicone-primary flex h-[46px] w-[46px] shrink-0 items-center justify-center
                     rounded-full sm:h-[51px] sm:w-[51px]"
        >
          <Leaf className="h-[23px] w-[23px] sm:h-[25px] sm:w-[25px]" aria-hidden />
        </button>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Bloom
          </h1>
          <p className="text-xs text-muted sm:text-sm">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  )
}
