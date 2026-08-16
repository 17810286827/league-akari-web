/**
 * 时间线适配层（任务 6）：frames 数组透传
 * 对齐原版 data-adapter/match-history/frames.ts 的 toFrames（LCU 取 data.frames、SGP 取 data.json.frames），
 * web 端后端直接返回 frames 数组，结构一致，透传即可
 */

/**
 * 透传时间线 frames 数组（供 context.details 与 Timeline Tab 消费）
 * @param frames 后端返回的帧数组；异常数据（非数组）返回空数组防御
 * @returns 原样帧数组；非数组输入返回空数组
 */
export function toMatchCardFrames(frames: unknown): unknown[] {
  return Array.isArray(frames) ? frames : []
}
