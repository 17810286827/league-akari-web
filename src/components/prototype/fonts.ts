/**
 * 【原型】评审字体注入：仅原型宿主挂载时往 <head> 追加 Google Fonts 链接，
 * 不改动 index.html（生产构建零影响）。字体加载失败时各方案都有系统字体兜底
 * （Bahnschrift / Georgia / KaiTi / Consolas / Segoe UI 均为 Windows 内置），
 * 离线环境依然可评审，只是字观感略降级。
 */

/** 需要注入的字体家族（一次性合并成一个请求） */
const FONT_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Rajdhani:wght@600;700' + // 方案A：电竞 HUD 数字/英文
  '&family=Cinzel:wght@700;900' + // 方案C：海克斯魔典标题
  '&family=JetBrains+Mono:wght@400;700' + // 方案D：终端密度正文
  '&family=Nunito:wght@700;800' + // 方案E：轻卡圆角数值
  '&display=swap'

/** 是否已注入（避免两个宿主重复追加） */
let injected = false

/** 往 <head> 注入字体链接（幂等） */
export function injectPrototypeFonts(): void {
  if (injected) {
    return
  }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = FONT_HREF
  document.head.appendChild(link)
  injected = true
  console.info('[prototype] 评审字体已注入（加载失败时回退系统字体）')
}
