import React from 'react'

export interface ForecastHpBarProps {
  label: string
  current: number
  max: number
  predictedAfter: number
  fillColor: string
  lossColor: string
}

export function ForecastHpBar({
  label,
  current,
  max,
  predictedAfter,
  fillColor,
  lossColor,
}: ForecastHpBarProps): React.JSX.Element {
  const safeMax = Math.max(1, max)
  const safeAfter = Math.max(0, Math.min(predictedAfter, safeMax))
  const safeCurrent = Math.max(safeAfter, Math.min(current, safeMax))
  const remainPct = (safeAfter / safeMax) * 100
  const lossPct = ((safeCurrent - safeAfter) / safeMax) * 100
  const delta = predictedAfter - current
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="w-12 text-stone-400">{label}</span>
      <div className="flex-1 h-3 bg-stone-800 rounded-sm overflow-hidden flex">
        <div className={fillColor} style={{ width: `${remainPct}%` }} />
        <div className={lossColor} style={{ width: `${lossPct}%` }} />
      </div>
      <span className="tabular-nums w-20 text-right">
        {current}/{max}
        {delta !== 0 && (
          <span className={delta > 0 ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
            → {predictedAfter}
          </span>
        )}
      </span>
    </div>
  )
}
