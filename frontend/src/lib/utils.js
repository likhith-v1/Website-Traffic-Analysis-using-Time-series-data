import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cx = (...args) => twMerge(clsx(...args))

export const fmt = n =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
  : String(n ?? 0)

export const LANG_MAP = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian', ja: 'Japanese',
  zh: 'Chinese', ar: 'Arabic', pl: 'Polish', nl: 'Dutch',
}

export const getLang = (project) => {
  const code = project?.split('.')[0]
  return LANG_MAP[code] || code || '—'
}

export const PROJECTS = [
  'en.wikipedia.org', 'de.wikipedia.org', 'fr.wikipedia.org',
  'es.wikipedia.org', 'ru.wikipedia.org', 'ja.wikipedia.org', 'zh.wikipedia.org',
]

export const exportCSV = (rows, filename) => {
  if (!rows?.length) return
  const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
