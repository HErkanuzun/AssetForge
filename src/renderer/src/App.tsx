import {renderMessage} from '../../shared/i18n/message'
// SPDX-License-Identifier: AGPL-3.0-only
import { createContext, useContext, useEffect, useState } from 'react'
import AssistantPanel from './components/AssistantPanel'
import { ForgeMark, Icon, type IconName } from './components/icons'
import AnimPage from './pages/AnimPage'
import BiblePage from './pages/BiblePage'
import BriefPage from './pages/BriefPage'
import DesignPage from './pages/DesignPage'
import HomePage from './pages/HomePage'
import JobsPage from './pages/JobsPage'
import LibraryPage from './pages/LibraryPage'
import PipelinePage from './pages/PipelinePage'
import SettingsPage from './pages/SettingsPage'
import { useStore } from './store'
import { useLocale } from './i18n'
import type { PlainMessageKey } from '../../shared/i18n'

export type Page = 'home' | 'library' | 'anim' | 'pipeline' | 'jobs' | 'design' | 'bible' | 'settings'

interface Nav {
  page: Page
  go: (p: Page) => void
  /** Atölye'de bir brief aç (isteğe bağlı ilk mesajla) */
  openBrief: (id: string, firstMessage?: string) => void
  briefId?: string
  /** Yapımcı panelini aç */
  openAssistant: () => void
}
const NavCtx = createContext<Nav | null>(null)
export const useNav = (): Nav => useContext(NavCtx)!

const NAV: { id: Page; label: PlainMessageKey; icon: IconName }[] = [
  { id: 'home', label: 'app.workshop', icon: 'home' },
  { id: 'library', label: 'app.library', icon: 'library' },
  { id: 'anim', label: 'app.animation', icon: 'anim' },
  { id: 'pipeline', label: 'app.pipelines', icon: 'flow' },
  { id: 'jobs', label: 'app.jobs', icon: 'jobs' }
]
const NAV2: { id: Page; label: PlainMessageKey; icon: IconName }[] = [
  { id: 'design', label: 'app.design', icon: 'spark' },
  { id: 'bible', label: 'app.bible', icon: 'book' },
  { id: 'settings', label: 'app.settings', icon: 'settings' }
]
const TITLES: Record<Page, PlainMessageKey> = {
  home: 'app.workshop',
  library: 'app.library',
  anim: 'app.animationStudio',
  pipeline: 'app.productionPipelines',
  jobs: 'app.queue',
  design: 'app.design',
  bible: 'app.bible',
  settings: 'app.settings'
}

export default function App() {
  const { locale, t } = useLocale()
  const { project, settings, jobs, toasts, deferredCount, me, readOnly } = useStore()
  // Tarayıcıdan bağlanan editör/izleyici Ayarlar'ı görmez
  const canSettings = !me || me.role === 'owner'
  // #library, #anim … ya da #brief:<id> (geliştirme/test için doğrudan açılış)
  const hash = decodeURIComponent(window.location.hash.slice(1))
  const initial = (hash.startsWith('brief:') ? 'home' : hash) as Page
  const [page, setPage] = useState<Page>(initial in TITLES ? initial : 'home')
  const [brief, setBrief] = useState<{ id: string; first?: string } | null>(hash.startsWith('brief:') ? { id: hash.slice(6) } : null)
  const [assistant, setAssistant] = useState(() => {
    try {
      return localStorage.getItem('forge.assistant') === '1' || hash === 'assistant'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('forge.assistant', assistant ? '1' : '0')
    } catch {
      /* depolama kapalı */
    }
  }, [assistant])
  // Görev çubuğu sağ tık kısayolları (uygulama zaten açıkken)
  useEffect(
    () =>
      window.forge.onNavigate((p) => {
        if (p in TITLES) {
          setBrief(null)
          setPage(p as Page)
        }
      }),
    []
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setAssistant((x) => !x)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const running = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length
  const missingKeys = settings && (!settings.hasKeys.anthropic || !settings.hasKeys.meshy || !settings.hasKeys.elevenlabs)

  const nav: Nav = {
    page,
    go: (p) => {
      if (p === 'home' && page === 'home') setBrief(null)
      setPage(p)
    },
    openBrief: (id, first) => {
      setBrief({ id, first })
      setPage('home')
    },
    briefId: page === 'home' ? brief?.id : undefined,
    openAssistant: () => setAssistant(true)
  }

  const item = (n: { id: Page; label: PlainMessageKey; icon: IconName }) => (
    <button key={n.id} className={`rail-item ${page === n.id ? 'active' : ''}`} onClick={() => nav.go(n.id)} title={t(n.label)}>
      <Icon name={n.icon} size={22} />
      {t(n.label)}
      {n.id === 'jobs' && running > 0 && <span className="rail-badge">{running}</span>}
      {n.id === 'settings' && missingKeys && <span className="rail-badge warn">!</span>}
    </button>
  )

  let body
  if (!project || !settings) body = <div className="stage-empty">{t('app.loading')}</div>
  else if (page === 'settings' && !canSettings) body = <div className="stage-empty">{t('app.settingsOwnerOnly')}</div>
  else if (page === 'home') body = brief ? <BriefPage key={brief.id} id={brief.id} firstMessage={brief.first} onBack={() => setBrief(null)} /> : <HomePage />
  else if (page === 'library') body = <LibraryPage />
  else if (page === 'anim') body = <AnimPage />
  else
    body = (
      <div className="legacy">
        {page === 'design' ? (
          <DesignPage />
        ) : page === 'bible' ? (
          <BiblePage />
        ) : page === 'pipeline' ? (
          <PipelinePage goJobs={() => setPage('jobs')} />
        ) : page === 'jobs' ? (
          <JobsPage />
        ) : (
          <SettingsPage />
        )}
      </div>
    )

  if (!settings)
    return (
      <div className="stage-empty" role="status" aria-busy="true">
        <span className="spinner" />
      </div>
    )

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        <aside className="rail">
          <div className="rail-logo" onClick={() => nav.go('home')} title="AssetForge">
            <ForgeMark size={38} />
          </div>
          {NAV.map(item)}
          <div className="rail-sep" />
          {NAV2.filter((n) => n.id !== 'settings' || canSettings).map(item)}
          <div className="rail-foot dim small center" title={settings?.projectDir}>
            {project ? `${project.assets.length}` : ''}
            <br />
            {t('app.assets')}
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <span className="crumb">{page === 'home' && brief ? t('app.brief') : t(TITLES[page])}</span>
            <span className="proj" title={settings?.projectDir}>
              <Icon name="folder" size={14} />
              {project?.bible.projectName || project?.name || '…'}
            </span>
            <span className="spacer" />
            {readOnly && (
              <span className="chip pink" title={t('app.readOnlyHelp')}>
                {t('app.readOnly')}
              </span>
            )}
            {(running > 0 || deferredCount > 0) && (
              <span className="queue-chip" onClick={() => setPage('jobs')}>
                <span className="pulse" />
                {t('app.running', { count: running })}
                {deferredCount ? t('app.waiting', { count: deferredCount }) : ''}
              </span>
            )}
            <button className={`as-toggle ${assistant ? 'on' : ''}`} onClick={() => setAssistant(!assistant)} title={t('app.assistantHelp')}>
              <Icon name="spark" size={15} /> {t('app.assistant')}
            </button>
            {me?.web && (
              <span className="web-user" title={t('app.webUser', { role: t(`role.${me.role}`) })}>
                <span className="web-avatar">{me.name.slice(0, 1).toLocaleUpperCase(locale)}</span>
                <span className="small">
                  {me.name} · <span className="muted">{t(`role.${me.role}`)}</span>
                </span>
                <a className="btn ghost" href="/logout">
                  {t('app.logout')}
                </a>
              </span>
            )}
          </header>
          <div className="content">
            {body}
            {assistant && <AssistantPanel onClose={() => setAssistant(false)} />}
          </div>
        </div>
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              {renderMessage(locale,t.text)}
            </div>
          ))}
        </div>
      </div>
    </NavCtx.Provider>
  )
}
