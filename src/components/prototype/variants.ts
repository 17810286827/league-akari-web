/**
 * 【原型】五方案评审共享元数据（车队周报 + 榜单中心两页共用）：
 * 通过 URL 参数 ?variant=A~E 切换方案，底部悬浮切换条据此渲染标签与循环顺序。
 * 评审完成后本目录整体废弃，胜出方案的结论回填到真实页面。
 */

/** 方案元信息：key 用于 URL 与组件映射，name 用于切换条展示 */
export interface PrototypeVariantMeta {
  key: string
  name: string
}

/** 五个候选方案（顺序即切换条循环顺序） */
export const PROTOTYPE_VARIANTS: PrototypeVariantMeta[] = [
  { key: 'A', name: '电竞 HUD' },
  { key: 'B', name: '战报杂志' },
  { key: 'C', name: '海克斯魔典' },
  { key: 'D', name: '终端密度' },
  { key: 'E', name: '轻卡圆角' }
]
