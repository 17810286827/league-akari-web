// 通用解析工具：将后端 JSON 字符串字段解析为可展示的数据结构

import { createLogger } from './logger'

// 日志器：来源标签固定为 ParseJSON，便于在 DevTools 中按标签过滤日志
const logger = createLogger('ParseJSON')

/**
 * 解析后端返回的 JSON 字符串数组（items/summonerSpells 等）；
 * 解析失败返回空数组并记 warn 日志，不阻塞展示
 * @param json 后端原样存储的 JSON 字符串，可能为 null
 * @returns 解析出的数字数组；输入为空或解析失败时返回空数组
 */
export function parseIdArray(json: string | null): number[] {
  if (!json) {
    return []
  }
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    logger.warn('Failed to parse id array', { json, error })
    return []
  }
}
