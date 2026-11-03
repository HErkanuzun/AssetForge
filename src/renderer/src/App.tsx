// SPDX-License-Identifier: AGPL-3.0-only
import { createContext, useContext, useEffect, useState } from 'react'
import AssistantPanel from './components/AssistantPanel'
import { ForgeMark, Icon, type IconName } from './components/icons'
import AnimPage from './pages/AnimPage'
import BiblePage from './pages/BiblePage'
import BriefPage from './pages/BriefPage'
import HomePage from './pages/HomePage'
import JobsPage from './pages/JobsPage'
import LibraryPage from './pages/LibraryPage'
import PipelinePage from './pages/PipelinePage'
import SettingsPage from './pages/SettingsPage'
import { useStore } from './store'

export type Page = 'home' | 'library' | 'anim' | 'pipeline' | 'jobs' | 'bible' | 'settings'

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

const NAV: { id: Page; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Atölye', icon: 'home' },
  { id: 'library', label: 'Kütüphane', icon: 'library' },
  { id: 'anim', label: 'Animasyon', icon: 'anim' },
  { id: 'pipeline', label: 'Hatlar', icon: 'flow' },
  { id: 'jobs', label: 'Üretim', icon: 'jobs' }
]
const NAV2: { id: Page; label: string; icon: IconName }[] = [
  { id: 'bible', label: 'Proje Kitabı', icon: 'book' },
  { id: 'settings', label: 'Ayarlar', icon: 'settings' }
]
const TITLES: Record<Page, string> = {
  home: 'Atölye',
  library: 'Kütüphane',
  anim: 'Animasyon Stüdyosu',
  pipeline: 'Üretim Hatları',
  jobs: 'Üretim Kuyruğu',
  bible: 'Proje Kitabı',
  settings: 'Ayarlar'
}

export default function App() {
  const { project, settings, jobs, toasts, deferredCount } = useStore()
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

  const item = (n: { id: Page; label: string; icon: IconName }) => (
    <button key={n.id} className={`rail-item ${page === n.id ? 'active' : ''}`} onClick={() => nav.go(n.id)} title={n.label}>
      <Icon name={n.icon} size={22} />
      {n.label}
      {n.id === 'jobs' && running > 0 && <span className="rail-badge">{running}</span>}
      {n.id === 'settings' && missingKeys && <span className="rail-badge warn">!</span>}
    </button>
  )

  let body
  if (!project) body = <div className="stage-empty">Yükleniyor…</div>
  else if (page === 'home') body = brief ? <BriefPage key={brief.id} id={brief.id} firstMessage={brief.first} onBack={() => setBrief(null)} /> : <HomePage />
  else if (page === 'library') body = <LibraryPage />
  else if (page === 'anim') body = <AnimPage />
  else
    body = <div className="legacy">{page === 'bible' ? <BiblePage /> : page === 'pipeline' ? <PipelinePage goJobs={() => setPage('jobs')} /> : page === 'jobs' ? <JobsPage /> : <SettingsPage />}</div>

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        <aside className="rail">
          <div className="rail-logo" onClick={() => nav.go('home')} title="AssetForge">
            <ForgeMark size={38} />
          </div>
          {NAV.map(item)}
          <div className="rail-sep" />
          {NAV2.map(item)}
          <div className="rail-foot dim small center" title={settings?.projectDir}>
            {project ? `${project.assets.length}` : ''}
            <br />
            asset
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <span className="crumb">{page === 'home' && brief ? 'Atölye · Brief' : TITLES[page]}</span>
            <span className="proj" title={settings?.projectDir}>
              <Icon name="folder" size={14} />
              {project?.bible.projectName || project?.name || '…'}
            </span>
            <span className="spacer" />
            {(running > 0 || deferredCount > 0) && (
              <span className="queue-chip" onClick={() => setPage('jobs')}>
                <span className="pulse" />
                {running} iş üretimde{deferredCount ? ` · ${deferredCount} bekliyor` : ''}
              </span>
            )}
            <button className={`as-toggle ${assistant ? 'on' : ''}`} onClick={() => setAssistant(!assistant)} title="Yapımcı asistanı (Ctrl+J)">
              <Icon name="spark" size={15} /> Yapımcı
            </button>
          </header>
          <div className="content">
            {body}
            {assistant && <AssistantPanel onClose={() => setAssistant(false)} />}
          </div>
        </div>
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </NavCtx.Provider>
  )
}
