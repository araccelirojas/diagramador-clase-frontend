import type { ReactNode } from 'react'

/** The frame shared by /login and /registro: one card, centered, nothing else. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase">
            Diagramador UML
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">{children}</div>

        <p className="mt-4 text-center text-sm text-slate-500">{footer}</p>
      </div>
    </div>
  )
}
