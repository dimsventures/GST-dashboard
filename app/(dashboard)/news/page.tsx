'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

type NewsItem = { title: string; summary: string; tag: string; source: string; url: string; date: string }
type NewsData = { items: NewsItem[]; interpretation: string; generatedAt: string }

const TAG_COLOR: Record<string, string> = { AI: '#60a5fa', Macro: '#f0b429', Behavioral: '#ec4899' }

export default function NewsPage() {
  const [data, setData] = useState<NewsData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/news')
      .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() })
      .then((d: NewsData & { error?: string }) => { if (d.error) setErr(d.error); else setData(d) })
      .catch(e => setErr(String(e?.message || e)))
  }, [])

  const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <DashboardShell title="News">
      <style>{`
        :root{ --nbg:#15161c;--nborder:rgba(255,255,255,.08);--nb2:rgba(255,255,255,.16);
          --nt:#eef0f5;--nt2:#97a0b3;--nt3:#687087;--nblue:#3e6df0; }
        .news-wrap{max-width:1120px;margin:0 auto;padding:18px 16px 60px;}
        .news-hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:16px;flex-wrap:wrap;}
        .news-hd-l{font-size:11.5px;color:var(--nt3);line-height:1.6;}
        .news-hd-l b{color:var(--nt2);}
        .news-upd{font-size:9.5px;color:var(--nt3);white-space:nowrap;}
        .news-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;}
        @media(max-width:980px){.news-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:560px){.news-grid{grid-template-columns:1fr;}}
        .news-card{background:rgba(21,22,28,.82);backdrop-filter:blur(6px);border:1px solid var(--nborder);border-radius:13px;padding:14px 15px;display:flex;flex-direction:column;min-height:150px;transition:border-color .15s,transform .15s;}
        .news-card:hover{border-color:var(--nb2);transform:translateY(-1px);}
        .news-tag{align-self:flex-start;font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:6px;border:1px solid;margin-bottom:9px;}
        .news-title{font-size:12.5px;font-weight:700;color:var(--nt);line-height:1.4;margin-bottom:7px;}
        .news-sum{font-size:11px;color:var(--nt2);line-height:1.6;flex:1;}
        .news-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:11px;padding-top:9px;border-top:1px solid var(--nborder);}
        .news-src{font-size:9px;color:var(--nt3);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .news-link{font-size:9px;font-weight:700;color:#6ea0ff;text-decoration:none;white-space:nowrap;}
        .news-link:hover{text-decoration:underline;}
        .agent-card{background:rgba(14,19,36,.85);backdrop-filter:blur(6px);border:1px solid rgba(122,162,255,.28);border-radius:14px;padding:18px 20px;box-shadow:0 0 30px rgba(62,109,240,.10);}
        .agent-hd{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--nt2);margin-bottom:11px;display:flex;align-items:center;gap:7px;}
        .agent-body{font-size:12.5px;color:var(--nt2);line-height:1.75;}
        .agent-body p{margin:0 0 10px;}.agent-body p:last-child{margin-bottom:0;}
        .news-empty{grid-column:1/-1;font-size:11.5px;color:var(--nt3);text-align:center;padding:30px 16px;font-style:italic;}
        .news-err{font-size:12px;color:#f6685e;line-height:1.6;}
        .news-skel{background:rgba(21,22,28,.82);border:1px solid var(--nborder);border-radius:13px;min-height:150px;}
      `}</style>
      <div className="news-wrap">
        <div className="news-hd">
          <div className="news-hd-l">Berita <b>AI</b>, <b>ekonomi makro &amp; investasi</b>, dan <b>behavioral finance</b> — disaring &amp; diinterpretasi Claude Haiku, 3× sehari.</div>
          {updated && <div className="news-upd">Diperbarui {updated}</div>}
        </div>

        {err && <div className="agent-card"><div className="news-err">Gagal memuat berita: {err}</div></div>}

        {!err && (
          <>
            <div className="news-grid">
              {!data && [0, 1, 2, 3].map(i => <div key={i} className="news-skel" />)}
              {data && data.items.length === 0 && <div className="news-empty">Belum ada berita yang ketarik dari sumber saat ini.</div>}
              {data && data.items.map((it, i) => {
                const c = TAG_COLOR[it.tag] || '#9ca3af'
                return (
                  <div className="news-card" key={i}>
                    <span className="news-tag" style={{ color: c, borderColor: c + '66', background: c + '1a' }}>{it.tag}</span>
                    <div className="news-title">{it.title}</div>
                    <div className="news-sum">{it.summary}</div>
                    <div className="news-foot">
                      <span className="news-src">{it.source}</span>
                      {it.url && <a className="news-link" href={it.url} target="_blank" rel="noopener noreferrer">baca →</a>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="agent-card">
              <div className="agent-hd">🐱 Agent Interpretation</div>
              <div className="agent-body">
                {!data && <span style={{ color: 'var(--nt3)', fontStyle: 'italic', fontSize: 11 }}>Nyusun interpretasi…</span>}
                {data && String(data.interpretation || '').split('\n').filter(p => p.trim()).map((p, i) => <p key={i}>{p.trim()}</p>)}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
