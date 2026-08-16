/**
 * 统计值渲染器（任务 11 移植自原版 details-table/renderers.tsx，渲染函数体逐字照搬）
 * 差异点：
 * - t()：i18next-vue 的 useTranslation → @/utils/match-card-i18n 的 t（key 不变）
 * - PositionIcon：@renderer-shared/icons/position-icons → 本地 icons/position-icons（任务 10 已移植）
 * - useNumberFormatter：@renderer-shared/composables → @/utils/numbers
 * - parseSelectedRole/ParsedRole：@shared/utils/ranked → @/utils/ranked（本地 port）
 * - akari-score 渲染器：web 无 AkariScorePopover 组件与 akari-score 数据层，
 *   raw-details 恒不产出 akariScore 字段，此渲染器保留但恒不触发（纯文本兜底展示）
 * - formatSeconds 相对路径不变（../time）
 */
import PositionIcon from '../../icons/position-icons/PositionIcon.vue'
import { useNumberFormatter } from '@/utils/numbers'
import { t } from '@/utils/match-card-i18n'
import { type ParsedRole, parseSelectedRole } from '@/utils/ranked'

import { formatSeconds } from '../time'

/** web 本地 AkariScore 最小形状（原版类型来自 @shared/data-adapter/analysis/player，web 无该数据层） */
interface AkariScore {
  total: number
  [key: string]: unknown
}

export function useValueRenderer() {
  const { formatNumber } = useNumberFormatter()

  const emptyValue = () => <span class="text-black/50 dark:text-white/50">N/A</span>

  const normalizedPosition = (position: string) => {
    return position === 'NONE' || position === 'UNSELECTED' || position === 'FILL'
      ? 'ALL'
      : position
  }

  const positionName = (position: string) => {
    return t(`positions.${normalizedPosition(position)}`)
  }

  const isAkariScore = (value: unknown): value is AkariScore => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'total' in value &&
      typeof (value as AkariScore).total === 'number'
    )
  }

  const positionAssignmentReasonMeta = (
    reason: string
  ): { name: string; color: string; foregroundColor: string } | null => {
    const reasons: Record<string, { name: string; color: string; foregroundColor: string }> = {
      FILL_SECONDARY: {
        name: t('positionAssignmentReason.FILL_SECONDARY'),
        color: '#82613b',
        foregroundColor: '#ffffff'
      },
      FILL_PRIMARY: {
        name: t('positionAssignmentReason.FILL_PRIMARY'),
        color: '#5b4694',
        foregroundColor: '#ffffff'
      },
      PRIMARY: {
        name: t('positionAssignmentReason.PRIMARY'),
        color: '#5b4694',
        foregroundColor: '#ffffff'
      },
      SECONDARY: {
        name: t('positionAssignmentReason.SECONDARY'),
        color: '#5b4694',
        foregroundColor: '#ffffff'
      },
      AUTOFILL: {
        name: t('positionAssignmentReason.AUTOFILL'),
        color: '#944646',
        foregroundColor: '#ffffff'
      },
      AUTOFILL_SHORT: {
        name: t('positionAssignmentReason.AUTOFILL_SHORT'),
        color: '#944646',
        foregroundColor: '#ffffff'
      }
    }

    return reasons[reason] ?? null
  }

  const roleTitle = (role: ParsedRole) => {
    const parts: string[] = []

    if (role.current !== 'NONE') {
      parts.push(positionName(role.current))
    }

    const reason = positionAssignmentReasonMeta(role.assignmentReason)
    if (reason) {
      parts.push(reason.name)
    }

    if (role.primary !== 'NONE') {
      parts.push(positionName(role.primary))
    }

    if (role.secondary !== 'NONE' && role.secondary !== 'UNSELECTED') {
      parts.push(positionName(role.secondary))
    }

    return parts.join(' / ')
  }

  return {
    float: (value: number) => {
      if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
        return emptyValue()
      }

      if (value === 0) {
        return <span class="text-black/50 dark:text-white/50">0</span>
      }

      return <span title={value.toFixed(2)}>{value.toFixed(2)}</span>
    },
    'akari-score': (value: unknown) => {
      // web 无 AkariScorePopover：raw-details 恒不产出 akariScore，此处保留渲染器但仅纯文本兜底
      if (!isAkariScore(value) || !Number.isFinite(value.total)) {
        return emptyValue()
      }

      return (
        <span class="cursor-default tabular-nums" title={value.total.toFixed(2)}>
          {value.total.toFixed(2)}
        </span>
      )
    },
    integer: (value: number) => {
      if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
        return emptyValue()
      }

      if (value === 0) {
        return <span class="text-black/50 dark:text-white/50">0</span>
      }

      return <span title={value.toString()}>{Math.floor(value).toLocaleString()}</span>
    },
    text: (value: string | number) => {
      if (value === null || value === undefined || value === '') {
        return emptyValue()
      }
      return value.toString()
    },
    compat: (value: number) => {
      if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
        return emptyValue()
      }

      if (value === 0) {
        return <span class="text-black/50 dark:text-white/50">0</span>
      }

      return <span title={value.toString()}>{formatNumber(value)}</span>
    },
    'game-time': (value: number) => {
      if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
        return emptyValue()
      }

      if (value === 0) {
        return <span class="text-black/50 dark:text-white/50">0</span>
      }

      return <span title={value.toString()}>{formatSeconds(value)}</span>
    },
    boolean: (value: boolean) => {
      if (
        value === null ||
        value === undefined ||
        (typeof value !== 'boolean' && typeof value !== 'number')
      ) {
        return emptyValue()
      }
      return value ? t('matchCard.statKeys.true') : t('matchCard.statKeys.false')
    },
    percentage: (value: number) => {
      if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
        return emptyValue()
      }
      return <span title={`${value * 100}%`}>{`${(value * 100).toFixed(2)}%`}</span>
    },
    position: (value: string) => {
      if (typeof value !== 'string' || value === '') {
        return emptyValue()
      }

      return (
        <div class="flex items-center justify-center text-base" title={positionName(value)}>
          <PositionIcon position={normalizedPosition(value)} />
        </div>
      )
    },
    selectedRole: (value: string) => {
      if (typeof value !== 'string' || value === '') {
        return emptyValue()
      }

      const parsed = parseSelectedRole(value)

      if (
        parsed.current === 'NONE' &&
        parsed.assignmentReason === 'NONE' &&
        parsed.primary === 'NONE' &&
        (parsed.secondary === 'NONE' || parsed.secondary === 'UNSELECTED')
      ) {
        return emptyValue()
      }

      const assignmentReason =
        parsed.assignmentReason === 'AUTOFILL'
          ? positionAssignmentReasonMeta('AUTOFILL_SHORT')
          : null
      const hasCurrentPosition = parsed.current !== 'NONE'
      const hasSelection = parsed.primary !== 'NONE'

      return (
        <div
          class="flex items-center justify-center gap-0.5 text-base"
          title={roleTitle(parsed) || value}
        >
          {assignmentReason && (
            <div
              class="rounded px-1 py-0.5 text-[11px] leading-2.75 whitespace-nowrap"
              style={{
                backgroundColor: assignmentReason.color,
                color: assignmentReason.foregroundColor
              }}
            >
              {assignmentReason.name}
            </div>
          )}

          {hasCurrentPosition && <PositionIcon position={normalizedPosition(parsed.current)} />}

          {hasCurrentPosition && hasSelection && (
            <div class="mx-0.5 h-3 w-px bg-black/25 dark:bg-white/25"></div>
          )}

          {hasSelection && <PositionIcon position={normalizedPosition(parsed.primary)} />}
          {parsed.secondary !== 'NONE' && parsed.secondary !== 'UNSELECTED' && (
            <PositionIcon position={normalizedPosition(parsed.secondary)} />
          )}
        </div>
      )
    },
    auto: (value: any) => {
      if (value === null || value === undefined) {
        return emptyValue()
      }

      if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          return <span title={value.toString()}>{value}</span>
        } else {
          return <span title={value.toFixed(2)}>{value.toFixed(2)}</span>
        }
      }

      if (typeof value === 'string') {
        return <span title={value}>{value}</span>
      }

      if (typeof value === 'boolean') {
        return value ? t('matchCard.statKeys.true') : t('matchCard.statKeys.false')
      }

      return <span class="text-black/50 dark:text-white/50">N/A</span>
    }
  }
}
