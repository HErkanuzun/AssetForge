// SPDX-License-Identifier: AGPL-3.0-only
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { translate, type Locale, type MessageArgs, type MessageKey } from '../../shared/i18n'
import { useStore } from './store'

const LocaleContext = createContext<Locale>('en')

/** Keep the same business component tree mounted when the locale changes. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { settings } = useStore()
  const locale = settings?.locale ?? 'en'
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const locale = useContext(LocaleContext)
  return useMemo(
    () => ({
      locale,
      t: <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => translate(locale, key, ...args)
    }),
    [locale]
  )
}
