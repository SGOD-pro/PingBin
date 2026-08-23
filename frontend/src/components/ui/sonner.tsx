import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#fffaf0] group-[.toaster]:text-[#0a0a0a] group-[.toaster]:border-[#e5e5e5] group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl group-[.toaster]:font-sans",
          description: "group-[.toast]:text-[#6a6a6a] group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-[#0a0a0a] group-[.toast]:text-white group-[.toast]:rounded-xl font-bold",
          cancelButton:
            "group-[.toast]:bg-[#f5f0e0] group-[.toast]:text-[#0a0a0a] group-[.toast]:rounded-xl font-semibold",
          closeButton:
            "group-[.toast]:border-[#e5e5e5] group-[.toast]:bg-white group-[.toast]:text-[#0a0a0a]",
          success: "group-[.toaster]:border-emerald-500/30 group-[.toaster]:bg-emerald-50/80",
          error: "group-[.toaster]:border-rose-500/30 group-[.toaster]:bg-rose-50/80",
          warning: "group-[.toaster]:border-amber-500/30 group-[.toaster]:bg-amber-50/80",
          info: "group-[.toaster]:border-blue-500/30 group-[.toaster]:bg-blue-50/80",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
