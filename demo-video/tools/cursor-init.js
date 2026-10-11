// 录像里的光标：跟随真实鼠标事件，点击时出现一圈涟漪（不影响页面交互）
(() => {
  if (window.__cursorInstalled) return
  window.__cursorInstalled = true
  const install = () => {
    if (document.getElementById('__cursor')) return
    const c = document.createElement('div')
    c.id = '__cursor'
    c.style.cssText = 'position:fixed;left:0;top:0;width:24px;height:24px;pointer-events:none;z-index:2147483647;transform:translate(-100px,-100px);will-change:transform'
    c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" style="position:absolute;left:-3px;top:-2px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"><path d="M4 2.5 L4 19.5 L8.6 15.4 L11.6 22 L14.4 20.8 L11.5 14.3 L17.6 14.3 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    document.documentElement.appendChild(c)
    const st = document.createElement('style')
    st.textContent = '@keyframes __rip{from{transform:translate(-50%,-50%) scale(.3);opacity:.55}to{transform:translate(-50%,-50%) scale(1);opacity:0}}'
    document.documentElement.appendChild(st)
  }
  const pos = { x: -100, y: -100 }
  window.addEventListener('mousemove', (e) => {
    install()
    pos.x = e.clientX; pos.y = e.clientY
    document.getElementById('__cursor').style.transform = `translate(${e.clientX}px,${e.clientY}px)`
  }, true)
  window.addEventListener('mousedown', (e) => {
    install()
    const r = document.createElement('div')
    r.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:46px;height:46px;border-radius:50%;border:2px solid rgba(17,17,17,.55);pointer-events:none;z-index:2147483646;animation:__rip .55s ease-out forwards`
    document.documentElement.appendChild(r)
    setTimeout(() => r.remove(), 700)
  }, true)
  // 拖入文件时跟在光标旁边的文件卡片（录制脚本控制显示）
  window.__dragGhost = (on, label) => {
    install()
    let g = document.getElementById('__ghost')
    if (!on) { if (g) g.remove(); return }
    if (!g) {
      g = document.createElement('div')
      g.id = '__ghost'
      g.style.cssText = 'position:absolute;left:18px;top:16px;display:flex;align-items:center;gap:8px;padding:8px 12px 8px 9px;border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 0 0 1px rgba(17,17,17,.1),0 12px 28px -10px rgba(17,17,17,.35);font:500 13px/1.2 -apple-system,"PingFang SC",sans-serif;color:#111;white-space:nowrap'
      g.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 1.5h12l6 6v17H2z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/><path d="M14 1.5v6h6" fill="none" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/><text x="11" y="20" text-anchor="middle" font-size="6.5" font-weight="700" font-family="-apple-system,sans-serif" fill="#111">PDF</text></svg><span></span>'
      document.getElementById('__cursor').appendChild(g)
    }
    g.querySelector('span').textContent = label
  }
  document.addEventListener('DOMContentLoaded', install)
})()
