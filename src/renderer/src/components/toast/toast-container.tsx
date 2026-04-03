import Toast, { ToastType } from './toast'

export type ToastMessage = {
  id: string
  message: string
  type: ToastType
}

type ToastContainerProps = {
  toasts: ToastMessage[]
  onRemoveToast: (id: string) => void
}

const ToastContainer = ({ toasts, onRemoveToast }: ToastContainerProps) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      <div className="flex flex-col gap-3 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => onRemoveToast(toast.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default ToastContainer