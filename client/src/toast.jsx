import { useEffect } from 'react'

function dispatch(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('ojt:toast', { detail: { message, type } }))
}

export const toast = {
  success: (m) => dispatch(m, 'success'),
  error: (m) => dispatch(m, 'error'),
  info: (m) => dispatch(m, 'info')
}

export function Toaster() {
  useEffect(() => {
    let timers = []
    const onEvent = (e) => {
      const { message, type } = e.detail
      const el = document.createElement('div')
      el.className = `toast toast-${type}`
      el.textContent = message
      document.body.appendChild(el)
      requestAnimationFrame(() => el.classList.add('show'))
      const t = setTimeout(() => {
        el.classList.remove('show')
        setTimeout(() => el.remove(), 300)
      }, 3200)
      timers.push(t)
    }
    window.addEventListener('ojt:toast', onEvent)
    return () => {
      window.removeEventListener('ojt:toast', onEvent)
      timers.forEach(clearTimeout)
    }
  }, [])
  return null
}