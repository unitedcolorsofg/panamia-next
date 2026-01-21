import { useToast } from '@/hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

export function Toaster() {
  const { toasts } = useToast();

  // Check if we have any destructive toasts to determine viewport position
  const hasDestructive = toasts.some((t) => t.variant === 'destructive');

  // Position: destructive = bottom-right, default = top-center
  const viewportClass = hasDestructive
    ? 'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col p-4 md:max-w-[420px]'
    : 'fixed top-0 left-1/2 z-[100] flex max-h-screen w-full -translate-x-1/2 flex-col p-4 md:max-w-[420px]';

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport className={viewportClass} />
    </ToastProvider>
  );
}
