/**
 * 版本号语义比较（英雄池漂移排序用，工单 #42 / spec #32）：
 * 后端经 GameVersionNormalizer 归一到"主版本.次版本"两类形态——
 * 数字补丁（"16.15"、"25.4"）与 2025 三赛季分段（"25.S1/S2/S3"）。
 * 纯字符串排序会让 "16.10" 排在 "16.2" 之前（字典序陷阱），
 * 也无法把分段（S1/S2/S3）与数字补丁（25.4）放进同一时间轴，
 * 故这里按 [年份/赛季, 分段序, 补丁号] 三元组做语义比较。
 */

/** 解析后的版本三元组：year=主版本号，split=分段序（0=非分段），patch=数字补丁号 */
interface VersionParts {
  year: number
  split: number
  patch: number
  raw: string
}

/** 字符串段 → 非负整数（非数字段回退 0，保证兜底值可比较） */
function toInt(segment: string | undefined): number {
  if (segment == null) {
    return 0
  }
  const n = Number.parseInt(segment, 10)
  return Number.isFinite(n) ? n : 0
}

/** 归一化版本串 → 比较三元组（前两段参与排序，余段忽略） */
function parseVersion(version: string): VersionParts {
  const [major, minor] = version.split('.')
  const year = toInt(major)
  // "S1/S2/S3"：2025 三赛季分段（split 序 = 段号）
  const splitMatch = /^S(\d+)$/.exec(minor ?? '')
  if (splitMatch) {
    return { year, split: toInt(splitMatch[1]), patch: 0, raw: version }
  }
  // 数字补丁（"15"/"4"）或兜底（"未知版本"等非数字段 → 0）
  return { year, split: 0, patch: toInt(minor), raw: version }
}

/**
 * 版本升序比较（旧 → 新）：返回负数= a 早于 b，正数= a 晚于 b，0= 相同。
 * 比较优先级：年份/赛季 → 分段序 → 数字补丁 → 原始串（稳定性兜底）。
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (pa.year !== pb.year) {
    return pa.year - pb.year
  }
  if (pa.split !== pb.split) {
    return pa.split - pb.split
  }
  if (pa.patch !== pb.patch) {
    return pa.patch - pb.patch
  }
  return pa.raw.localeCompare(pb.raw)
}

/**
 * 版本降序排序（最新在顶上）：去重后按语义从新到旧排列，
 * 供英雄池漂移表行轴直接消费。
 */
export function sortVersionsDescending(versions: Iterable<string>): string[] {
  return [...new Set(versions)].sort((a, b) => compareVersions(b, a))
}
