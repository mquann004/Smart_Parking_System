import type { PropsWithChildren } from 'react'

interface CardProps extends PropsWithChildren {
  title: string
}

export function Card({ title, children }: CardProps) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-md">
      <h2 className="mb-3 text-base font-semibold text-cyan-300">{title}</h2>
      {children}
    </section>
  )
}
