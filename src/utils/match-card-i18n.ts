/**
 * match-card 体系的中文文案常量模块
 * key 与 i18next 一致（如 match-card.win），文案取自原版
 * src/shared/i18n/zh-CN/renderer/match-card.yaml 与 main.yaml
 */
const zh: Record<string, string> = {
  'match-card.win': '胜利',
  'match-card.hello': '你好 {{name}}'
  // 后续任务按组件 t() 调用逐步补充，缺失 key 回显本身
}

/** 按 key 取中文文案；缺失回显 key；支持 i18next 的 {{name}} 插值语法 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = zh[key] ?? key
  if (!params) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? `{{${name}}}`))
}
