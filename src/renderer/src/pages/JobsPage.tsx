import { useState } from 'react'
import type { Artifact, Job } from '../../../shared/types'
import { StatusPill } from '../components/ui'
import { forgeUrl, useStore } from '../store'

function ArtifactView({ a }: { a: Artifact }) {
  switch (a.kind) {
    case 'prompt':
      return (
        <div className="artifact">
          <div className="prompt-text">{a.prompt.prompt}</div>
          {a.prompt.texture_prompt && (
            <div className="prompt-text sub">
              <b>Doku:</b> {a.prompt.texture_prompt}
            </div>
          )}
          {a.prompt.negative_prompt && (
            <div className="prompt-text sub">
              <b>Negatif:</b> {a.prompt.negative_prompt}
            </div>
          )}
          <div className="muted small">{a.prompt.rationale}</div>
        </div>
      )
    case 'image':
      return (
        <div className="artifact thumbs">
          {a.files.map((f) => (
            <img key={f} src={forgeUrl(f)} onClick={() => window.forge.openPath(f)} title={f} />
          ))}
        </div>
      )
    case 'model':
      return (
        <div className="artifact">
          <div className="thumbs">
            {(a.previews?.length ? a.previews : a.thumbnail ? [a.thumbnail] : []).map((f) => (
              <img key={f} src={forgeUrl(f)} onClick={() => window.forge.openPath(f)} />
            ))}
          </div>
          {a.stats && (
            <div className="small muted">
              {a.stats.tris.toLocaleString('tr')} üçgen · {a.stats.dims.join(' × ')} m · UV {a.stats.hasUV ? '✓' : '✗'}
              {a.stats.decimated ? ' · azaltıldı' : ''}
              {a.rigged ? ' · riglenmiş' : ''}
            </div>
          )}
          <button className="link" onClick={() => window.forge.showItem(a.file)}>
            📁 {a.file.split(/[\\/]/).pop()}
          </button>
        </div>
      )
    case 'audio':
      return (
        <div className="artifact">
          {a.files.map((f) => (
            <div key={f} className="audio-row">
              <audio controls src={forgeUrl(f)} />
              <span className="small mono">{f.split(/[\\/]/).pop()}</span>
            </div>
          ))}
        </div>
      )
    case 'report':
      return (
        <div className={`artifact report ${a.report.pass ? 'pass' : 'fail'}`}>
          <div>
            <b>{a.report.score}/10</b> — {a.report.summary}
          </div>
          {a.report.issues.length > 0 && (
            <ul>
              {a.report.issues.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )
    default:
      return null
  }
}

function JobDetail({ job }: { job: Job }) {
  const order = Object.keys(job.nodes)
  return (
    <div className="job-detail">
      <div className="row between">
        <div>
          <h2>{job.assetName}</h2>
          <div className="muted small">
            {job.pipelineName} · {new Date(job.createdAt).toLocaleString('tr-TR')}
            {job.finishedAt ? ` · ${Math.round((job.finishedAt - job.createdAt) / 1000)} sn` : ''}
          </div>
        </div>
        <div className="row">
          <StatusPill status={job.status} />
          {(job.status === 'running' || job.status === 'queued') && (
            <button className="btn danger" onClick={() => window.forge.run.cancel(job.id)}>
              İptal
            </button>
          )}
          <button className="btn" onClick={() => window.forge.openPath(job.outDir)}>
            📁 Çıktı klasörü
          </button>
        </div>
      </div>
      <div className="cost">
        Claude ${job.cost.claudeUsd.toFixed(3)} · Meshy {job.cost.meshyCredits} kredi · ElevenLabs {job.cost.audioChars} karakter
      </div>
      {job.error && <div className="error-box">{job.error}</div>}
      {job.warnings.map((w, i) => (
        <div key={i} className="warn-box">
          {w}
        </div>
      ))}
      {order.map((id) => {
        const s = job.nodes[id]
        if (s.status === 'idle') return null
        const outs = Object.values(s.outputs ?? {}).filter((a) => a.kind !== 'asset')
        return (
          <details key={id} className="node-block" open={s.status === 'running' || s.status === 'failed' || outs.length > 0}>
            <summary>
              <StatusPill status={s.status} />
              <b>{id}</b>
              {s.attempts > 1 && <span className="muted small">deneme {s.attempts}</span>}
              {s.status === 'running' && (
                <span className="progress inline">
                  <span style={{ width: `${s.progress}%` }} />
                </span>
              )}
            </summary>
            {outs.map((a, i) => (
              <ArtifactView key={i} a={a} />
            ))}
            {s.logs.length > 0 && (
              <div className="logs small">
                {s.logs.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            )}
          </details>
        )
      })}
    </div>
  )
}

export default function JobsPage() {
  const { jobs, refreshJobs } = useStore()
  const [sel, setSel] = useState<string>('')
  const job = jobs.find((j) => j.id === sel) ?? jobs[0]
  const totals = jobs.reduce((t, j) => ({ usd: t.usd + j.cost.claudeUsd, credits: t.credits + j.cost.meshyCredits }), { usd: 0, credits: 0 })

  return (
    <div className="page split">
      <div className="jobs-list">
        <div className="row between">
          <h1>Üretim İşleri</h1>
          <button className="icon-btn" onClick={refreshJobs} title="Yenile">
            ⟳
          </button>
        </div>
        <div className="muted small">
          Toplam: Claude ${totals.usd.toFixed(2)} · Meshy {totals.credits} kredi
        </div>
        {jobs.length === 0 && <p className="muted">Henüz iş yok. Asset Listesi'nden seçip "Üret"e basın.</p>}
        {jobs.map((j) => {
          const nodes = Object.values(j.nodes)
          const done = nodes.filter((n) => n.status === 'done').length
          return (
            <button key={j.id} className={`job-item ${job?.id === j.id ? 'active' : ''}`} onClick={() => setSel(j.id)}>
              <div className="row between">
                <span className="ellipsis">{j.assetName}</span>
                <StatusPill status={j.status} />
              </div>
              <div className="muted small ellipsis">
                {j.pipelineName} · {done}/{nodes.length} adım
              </div>
            </button>
          )
        })}
      </div>
      <div className="split-main">{job ? <JobDetail job={job} /> : <div className="empty">İş seçin</div>}</div>
    </div>
  )
}

