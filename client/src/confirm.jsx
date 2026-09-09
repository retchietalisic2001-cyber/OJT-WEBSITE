import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Modal } from './components/ui.jsx'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolveRef = useRef(null)

  const confirm = useCallback((opts = {}) =>
    new Promise((resolve) => {
      resolveRef.current = resolve
      setState({
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Confirm',
        cancelLabel: opts.cancelLabel || 'Cancel',
        danger: opts.danger !== false
      })
    }), [])

  const close = (val) => {
    const r = resolveRef.current
    resolveRef.current = null
    setState(null)
    if (r) r(val)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title || 'Confirm'}>
        {state && (
          <>
            <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{state.message}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => close(false)}>{state.cancelLabel}</button>
              <button className={'btn ' + (state.danger ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)}>{state.confirmLabel}</button>
            </div>
          </>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>')
  return ctx
}

export default useConfirm