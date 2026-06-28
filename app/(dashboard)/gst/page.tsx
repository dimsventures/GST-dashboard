'use client'

import { useEffect, useRef, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

let ChartLib: typeof import('chart.js') | null = null
async function getChart() {
  if (!ChartLib) {
    ChartLib = await import('chart.js')
    ChartLib.Chart.register(...ChartLib.registerables)
  }
  return ChartLib.Chart
}

function gid<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id) as T | null }

// ── STATE ──
let entries: Any[] = [], lessons: Any[] = [], todos: Any[] = [], goals: Any[] = []
let wishes: Any[] = [], todoCategories: Any[] = [], activityCategories: Any[] = []
let activities: Any[] = []
let logDate: string | null = null

let goalTab = 'year'
let goalNavY = new Date().getFullYear()
let goalNavM = new Date().getMonth()
let goalNavYr = new Date().getFullYear()
let calY = new Date().getFullYear()
let calM = new Date().getMonth()
let wkStart = mondayOf(new Date())
let todoMode = 'doing'
let todoCat = 'Semua'
let todoStatus = 'todo'
let currentView = 'chain'
let chartBarInstance: import('chart.js').Chart | null = null
let chartLineInstance: import('chart.js').Chart | null = null
let chartTotalInstance: import('chart.js').Chart | null = null
let barRange = 'all'
let lineRange = 'all'
let learningTodoId: string | null = null
let learningSelectedCat: string | null = null
let doingTodoId: string | null = null
let doingSelectedCat: string | null = null
let goalAchieveId: string | null = null
let goalAchieveCat: string | null = null
let editingLessonId: string | null = null
let wishAchieveCat: string | null = null
let tqIdx = Math.floor(Math.random() * 10)

let clockTimer: ReturnType<typeof setInterval> | null = null
let quoteTimer: ReturnType<typeof setInterval> | null = null
let tokenRefreshTimer: ReturnType<typeof setInterval> | null = null

// ── CONSTANTS ──
const ACT_CATS_DEFAULT = [
  { key: 'religion', label: 'Religion', color: '#3b82f6', placeholder: 'Aktivitas religion hari ini...' },
  { key: 'work', label: 'Working Stage', color: '#ef4444', placeholder: 'Apa yang dikerjakan?' },
  { key: 'personal', label: 'Personal Wish', color: '#f59e0b', placeholder: 'Progress personal wish?' },
  { key: 'exercise', label: 'Exercise', color: '#22c55e', placeholder: 'Gerakan hari ini?' },
  { key: 'habit', label: 'Habit', color: '#8b5cf6', placeholder: 'Baca buku, dll...' },
  { key: 'humanity', label: 'Humanity', color: '#14b8a6', placeholder: 'Kebaikan, interaksi sosial...' },
]

const TARGET_QUOTES = [
  { t: "No one's gonna make your dream come true. Only you.", by: '' },
  { t: "You don't rise to the level of your goals. You fall to the level of your systems.", by: 'James Clear' },
  { t: "Hard choices, easy life. Easy choices, hard life.", by: 'Jerzy Gregorek' },
  { t: "A goal without a deadline is just a wish.", by: '' },
  { t: "Discipline equals freedom.", by: 'Jocko Willink' },
  { t: "Tomorrow becomes never. The cost of waiting compounds.", by: '' },
  { t: "Your future is hidden inside your daily routine.", by: 'Mike Murdock' },
  { t: "Motivation gets you started. Habit keeps you going.", by: 'Jim Rohn' },
  { t: "The pain of regret outlasts the pain of effort.", by: '' },
  { t: "You will never always be motivated. So you must learn to be disciplined.", by: '' },
]

const LEARNING_KEYWORDS = ['belajar', 'pelajari', 'learning', 'learn', 'to know', 'pahami', 'memahami', 'riset', 'research', 'deep dive', 'studi', 'study', 'eksplorasi', 'explore', 'cari tau', 'cari tahu', 'ngerti', 'mengerti', 'kenali', 'baca buku', 'baca ', 'read ', 'kursus', 'course', 'modul', 'module', 'dokumentasi', 'documentation', 'tutorial', 'dalami', 'mendalami', 'dalamin', 'deep in']

// Tiap user bikin kategori habit-nya sendiri; gak ada default. ACT_CATS_DEFAULT cuma dipakai buat contoh inspirasi di onboarding.
function getActCats() { return activityCategories }
function actScore(date: string, cat: string) { return activities.filter(a => a.date === date && a.category === cat).length }
function actScoreTotal(date: string) { return activities.filter(a => a.date === date).length }

// ── API HELPER ──
async function api(path: string, method = 'GET', body: Any = null) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(path, opts)
  if (!r.ok) { const t = await r.text(); throw new Error(t) }
  return r.json()
}

// ── DATE UTILS ──
function p2(n: number) { return String(n).padStart(2, '0') }
function todayStr() { const n = new Date(); return `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())}` }
function ds(y: number, m: number, d: number) { return `${y}-${p2(m + 1)}-${p2(d)}` }
function mondayOf(date: Date) { const d = new Date(date); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d }
function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function tds(d: Date) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` }
function fmtFull(s: string) {
  const d = new Date(s + 'T00:00:00')
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const dn = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  return `${dn[d.getDay()]}, ${d.getDate()} ${mn[d.getMonth()]} ${d.getFullYear()}`
}
function fmtShort(s: string) {
  const d = new Date(s + 'T00:00:00')
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${d.getDate()} ${mn[d.getMonth()]}`
}
function wkNum(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dn = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dn)
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - ys.getTime()) / 86400000) + 1) / 7)
}

// ── TOKEN REFRESH ──
async function refreshTokenIfNeeded() {
  try {
    const r = await fetch('/api/auth/me')
    if (r.status === 401) {
      const ref = await fetch('/api/auth', { method: 'PUT' })
      if (!ref.ok) location.href = '/login'
    }
  } catch (e) { console.error('token refresh check failed', e) }
}

function defGoals(): Any[] { return [] }
function defTodos(): Any[] { return [] }

function saveTodoDB(t: Any) {
  api('/api/todos', 'POST', { id: t.id, text: t.text, cat: t.cat, done: t.done, done_date: t.doneDate || null, mode: t.mode || 'doing', points_to: t.points_to || 'personal' }).catch(console.error)
}

async function seedDefaultActCategories() {
  for (let i = 0; i < ACT_CATS_DEFAULT.length; i++) {
    const d = ACT_CATS_DEFAULT[i]
    try { const c = await api('/api/activity-categories', 'POST', { ...d, sort_order: i }); activityCategories.push(c) }
    catch (e) { console.warn('seed act cat failed', e) }
  }
}

// ── INIT ──
async function init() {
  await refreshTokenIfNeeded()
  fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(u => {
    if (u) document.title = u.name + ' — Get Shit Done!!!'
  }).catch(() => {})
  const { entries: en, lessons: ls, todos: td, goals: gl, wishes: ws, activities: ac, todoCategories: tc, activityCategories: atc } = await api('/api/data')
  activities = Array.isArray(ac) ? ac : []

  entries = Array.isArray(en) ? en : []
  const lsMap: Record<string, Any> = {}
  ;(Array.isArray(ls) ? ls : []).forEach((item: Any) => {
    if (!lsMap[item.date]) lsMap[item.date] = { date: item.date, items: [] }
    lsMap[item.date].items.push(item)
  })
  lessons = Object.values(lsMap).sort((a: Any, b: Any) => a.date.localeCompare(b.date))
  if (Array.isArray(td) && td.length) {
    todos = td.map((t: Any) => ({ ...t, doneDate: t.done_date || null, mode: t.mode || 'doing' }))
  } else {
    todos = defTodos()
    todos.forEach(t => api('/api/todos', 'POST', { id: t.id, text: t.text, cat: t.cat, done: t.done, done_date: null, mode: 'doing', points_to: 'personal' }).catch(console.error))
  }
  todoCategories = Array.isArray(tc) ? tc : []
  if (Array.isArray(atc) && atc.length) {
    activityCategories = atc
  }
  renderLogModal()
  if (Array.isArray(gl) && gl.length) {
    goals = gl.map((g: Any) => ({ ...g, doneDate: g.done_date || null }))
  } else {
    goals = defGoals()
    goals.forEach(g => api('/api/goals', 'POST', { id: g.id, text: g.text, scope: g.scope, yr: g.yr || null, ym: g.ym || null, done: g.done, done_date: null }).catch(console.error))
  }

  wishes = Array.isArray(ws) ? ws.map((w: Any) => ({ ...w, doneDate: w.done_date || null })) : []

  const now = new Date()
  calY = now.getFullYear(); calM = now.getMonth()
  wkStart = mondayOf(now)
  startClock(); render(); startQuoteRotation(); updateLsnCatsList()
  tokenRefreshTimer = setInterval(() => { fetch('/api/auth', { method: 'PUT' }).catch(() => {}) }, 45 * 60 * 1000)
}

// ── RENDER ALL ──
function render() { renderCal(); renderStats(); renderChain(); renderLessons(); renderCatBar(); renderTodos(); renderGoals() }

// ── CALENDAR ──
function renderCal() {
  const MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const mnthEl = gid('calmnth'); if (mnthEl) mnthEl.textContent = `${MN[calM]} ${calY}`
  const today = todayStr()
  const selWeek: string[] = []; for (let i = 0; i < 7; i++) selWeek.push(tds(addDays(wkStart, i)))
  const firstDay = new Date(calY, calM, 1).getDay()
  const dim = new Date(calY, calM + 1, 0).getDate()
  const off = firstDay === 0 ? 6 : firstDay - 1
  const grid = gid('calgrid')
  if (!grid) return
  grid.querySelectorAll('.cday').forEach(el => el.remove())
  const prevDim = new Date(calY, calM, 0).getDate()
  for (let i = off - 1; i >= 0; i--) {
    const d = prevDim - i; const dstr = ds(calY, calM - 1, d)
    const el = document.createElement('div'); el.className = 'cday othermon'; el.textContent = String(d)
    el.onclick = () => jumpTo(dstr); grid.appendChild(el)
  }
  for (let d = 1; d <= dim; d++) {
    const dstr = ds(calY, calM, d)
    const e = entries.find(x => x.date === dstr)
    const hl = lessons.some(l => l.date === dstr)
    let cls = 'cday'
    if (actScoreTotal(dstr) > 0 || (e && (e.ws > 0 || e.ms > 0 || e.ps > 0))) cls += ' hasdata'
    if (hl) cls += ' haslesson'
    if (dstr === today) cls += ' todaycal'
    if (selWeek.includes(dstr)) cls += ' selweek'
    const el = document.createElement('div'); el.className = cls; el.textContent = String(d)
    el.onclick = () => jumpTo(dstr); grid.appendChild(el)
  }
  const total = off + dim; const rem = (7 - total % 7) % 7
  for (let d = 1; d <= rem; d++) {
    const el = document.createElement('div'); el.className = 'cday othermon'; el.textContent = String(d); grid.appendChild(el)
  }
}
function cPrev() { calM--; if (calM < 0) { calM = 11; calY-- } renderCal() }
function cNext() { calM++; if (calM > 11) { calM = 0; calY++ } renderCal() }
function jumpTo(dstr: string) { const d = new Date(dstr + 'T00:00:00'); calY = d.getFullYear(); calM = d.getMonth(); wkStart = mondayOf(d); render() }

// ── STATS ──
function renderStats() {
  const st0 = gid('st0'); if (st0) { const _now = new Date(); const _soy = new Date(_now.getFullYear(), 0, 1); const _elapsed = Math.floor((_now.getTime() - _soy.getTime()) / 86400000) + 1; st0.textContent = String(_elapsed) }
  const st1 = gid('st1'); if (st1) st1.textContent = String(wishes.length)
  const st2 = gid('st2'); if (st2) st2.textContent = String(lessons.reduce((s, l) => s + (l.items ? l.items.length : 1), 0))
  const now = new Date(); const yr = now.getFullYear(); const eoy = new Date(yr, 11, 31); const daysLeft = Math.ceil((eoy.getTime() - now.getTime()) / 86400000)
  const st5 = gid('st5'); if (st5) { st5.textContent = '-' + daysLeft; st5.style.color = '#ef4444' }
}

// ── CHAIN ──
function wkPrev() { wkStart = addDays(wkStart, -7); render() }
function wkNext() { wkStart = addDays(wkStart, 7); render() }
function wkNow() { wkStart = mondayOf(new Date()); render() }

function renderChain() {
  const today = todayStr()
  const wEnd = addDays(wkStart, 6)
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const DN = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
  const wn = wkNum(wkStart)

  const wknavLbl = gid('wknav-lbl')
  if (wknavLbl) wknavLbl.textContent = `WEEK ${wn} — ${wkStart.getDate()} ${MN[wkStart.getMonth()]} – ${wEnd.getDate()} ${MN[wEnd.getMonth()]} ${wEnd.getFullYear()}`

  let twk = 0, texr = 0, lw = 0
  for (let i = 0; i < 7; i++) {
    const d = tds(addDays(wkStart, i))
    twk += actScore(d, 'work'); texr += actScore(d, 'exercise')
    const _dl = lessons.find(l => l.date === d); if (_dl) lw += (_dl.items || [_dl]).length
  }

  let html = `
  <div class="wk-header">
    <div class="wk-range">${wkStart.getDate()} ${MN[wkStart.getMonth()]} – ${wEnd.getDate()} ${MN[wEnd.getMonth()]} ${wEnd.getFullYear()}</div>
    ${tds(wkStart) <= today && today <= tds(wEnd) ? '<div class="wk-badge">MINGGU INI</div>' : ''}
  </div>
  <div class="wk-sumbar">
    <div class="wsb"><div class="wdot" style="background:#ef4444"></div>Work: ${twk}x</div>
    <div class="wsb"><div class="wdot" style="background:#22c55e"></div>Exercise: ${texr}x</div>
    <div class="wsb"><div class="wdot" style="background:#c9841a"></div>Lessons: ${lw}</div>
  </div>`

  for (let i = 0; i < 7; i++) {
    const dayDate = addDays(wkStart, i)
    const dstr = tds(dayDate)
    const isToday = dstr === today
    const isFuture = dstr > today
    const e = entries.find(x => x.date === dstr)
    const lesObj = lessons.find(l => l.date === dstr); const lesItems = lesObj && lesObj.items && lesObj.items.length ? lesObj.items : []
    const doneTodos = todos.filter(t => t.done && t.doneDate === dstr)

    const dayActs = activities.filter(a => a.date === dstr)
    let tags = ''
    if (dayActs.length) {
      getActCats().slice(0, 6).forEach((c: Any) => {
        dayActs.filter((a: Any) => a.category === c.key).slice(0, 1).forEach((a: Any) => { tags += `<span class="tag" style="background:${c.color}18;color:${c.color};border:1px solid ${c.color}44;">${a.text.slice(0, 20)}</span>` })
      })
    } else if (e) {
      if (e.rel) tags += `<span class="tag tr">${e.rel.split(',')[0].trim()}</span>`
      if (e.work) e.work.split(',').slice(0, 2).forEach((p: string) => { if (p.trim()) tags += `<span class="tag tw">${p.trim()}</span>` })
      if (e.mkt) e.mkt.split(',').slice(0, 1).forEach((p: string) => { if (p.trim()) tags += `<span class="tag tm">${p.trim()}</span>` })
    } else {
      tags = `<span class="tag te">${isFuture ? 'belum waktunya' : 'belum dicatat'}</span>`
    }
    doneTodos.forEach(t => { tags += `<span class="tag tdone-tag">✓ ${t.text.slice(0, 18)}${t.text.length > 18 ? '...' : ''}</span>` })
    const doneGoals = goals.filter(g => g.done && g.doneDate === dstr)
    doneGoals.forEach(g => { tags += `<span class="tag tg">★ ${g.text.slice(0, 16)}${g.text.length > 16 ? '...' : ''}</span>` })
    const doneWishes = wishes.filter(w => w.done && w.doneDate === dstr)
    doneWishes.forEach(w => { tags += `<span class="tag" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red-border);">✦ ${w.text.slice(0, 16)}${w.text.length > 16 ? '...' : ''}</span>` })

    const sc = dayActs.length ? Math.min(actScoreTotal(dstr), 5) : e ? Math.round((e.ws + e.ms) / 2) : 0
    let pips = ''; for (let p = 0; p < 5; p++) pips += `<div class="pip${p < sc ? ' on' : ''}"></div>`

    let det = '<div class="ddet-grid">'
    if (dayActs.length) {
      getActCats().forEach((c: Any) => {
        const catActs = dayActs.filter((a: Any) => a.category === c.key)
        if (catActs.length) det += `<div class="dcard"><div class="dcard-lbl">${c.label} (${catActs.length}x)</div><div class="dcard-val">${catActs.map((a: Any) => a.text).join(' · ')}</div></div>`
      })
    } else if (e) {
      if (e.rel) det += `<div class="dcard"><div class="dcard-lbl">Religion</div><div class="dcard-val">${e.rel}</div></div>`
      if (e.work) det += `<div class="dcard"><div class="dcard-lbl">Working Stage (${e.ws}/5)</div><div class="dcard-val">${e.work}</div></div>`
      if (e.mkt) det += `<div class="dcard"><div class="dcard-lbl">Personal Wish (${e.ms}/5)</div><div class="dcard-val">${e.mkt}</div></div>`
      if (e.phy) det += `<div class="dcard"><div class="dcard-lbl">Exercise</div><div class="dcard-val">${e.phy} ✓</div></div>`
      if (e.soc) det += `<div class="dcard"><div class="dcard-lbl">Humanity</div><div class="dcard-val">${e.soc}</div></div>`
      if (e.extra) det += `<div class="dcard" style="grid-column:1/-1"><div class="dcard-lbl">Extra</div><div class="dcard-val">${e.extra}</div></div>`
    } else {
      det += `<div class="dcard" style="grid-column:1/-1"><div class="dcard-lbl">Status</div><div class="dcard-val empty">${isFuture ? 'Belum waktunya.' : 'Belum dicatat hari ini.'}</div></div>`
    }
    if (doneTodos.length) {
      det += `<div class="dcard" style="grid-column:1/-1"><div class="dcard-lbl">Task Selesai Hari Ini</div><div class="dcard-val">`
      doneTodos.forEach(t => { det += `<div class="done-in-chain">${t.text}</div>` })
      det += `</div></div>`
    }
    det += '</div>'
    if (lesItems.length) {
      const fmtTs = (ts: string) => { try { const d = new Date(ts); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') } catch { return '' } }
      lesItems.forEach((item: Any, i: number) => { det += `<div class="dlesn-card"><div class="dlesn-lbl">🔒 Pelajaran ${i + 1}${item.ts ? ' — ' + fmtTs(item.ts) : ''}${item.category ? ` &nbsp;<span class="lsn-cat-tag">${item.category}</span>` : ''}</div><div class="dlesn-txt">${item.text}</div></div>` })
    }
    const doneGoalsDet = goals.filter(g => g.done && g.doneDate === dstr)
    if (doneGoalsDet.length) {
      det += `<div class="dgoal-card"><div class="dgoal-lbl">★ Goals Achieved</div>`
      doneGoalsDet.forEach(g => { det += `<div class="dgoal-row"><span style="flex:1">${g.text}</span><span class="dgoal-scope">${g.scope === 'year' ? (g.yr || new Date().getFullYear()) : 'MONTH'}</span></div>` })
      det += `</div>`
    }
    const doneWishesDet = wishes.filter(w => w.done && w.doneDate === dstr)
    if (doneWishesDet.length) {
      det += `<div class="dlesn-card"><div class="dlesn-lbl" style="color:var(--red);">✦ Dream Tercapai</div>`
      doneWishesDet.forEach(w => { det += `<div class="dlesn-txt" style="margin-bottom:6px;"><strong>${w.text}</strong>${w.achievementStory ? '<br><span style="font-size:10px;opacity:.8;">' + w.achievementStory + '</span>' : ''}</div>` })
      det += `</div>`
    }
    if (!isFuture) det += `<button class="edit-entry-btn" onclick="openLogDate('${dstr}')">✎ ${dayActs.length ? 'Tambah / Edit' : 'Log Aktivitas'}</button>`

    html += `
    <div class="drow${isToday ? ' todayrow' : ''}" id="dr-${dstr}">
      <div class="drow-hdr" onclick="toggleRow('${dstr}')">
        <div class="dnb">
          <div class="dname">${DN[i]}${isToday ? ' 🔴' : ''}</div>
          <div class="ddate">${dayDate.getDate()} ${MN[dayDate.getMonth()]}</div>
        </div>
        <div class="dtags">${tags}</div>
        <div class="dpips">${pips}</div>
        ${lesItems.length ? `<div class="dlsn-dot" title="Ada ${lesItems.length} lesson terkunci"></div>` : ''}
        <div class="dchev">▾</div>
      </div>
      <div class="ddetail">${det}</div>
    </div>`
  }

  const cp = gid('cp')
  if (cp) cp.innerHTML = html

  const td = gid('dr-' + today)
  if (td) { td.classList.add('open'); setTimeout(() => td.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100) }
}

function toggleRow(dstr: string) {
  const r = gid('dr-' + dstr)
  if (r) r.classList.toggle('open')
}

// ── LESSONS ──
function lockLesson() {
  const ta = gid<HTMLTextAreaElement>('lta'); const catInp = gid<HTMLInputElement>('lta-cat')
  const text = (ta?.value || '').trim(); if (!text) return
  const cat = (catInp?.value || '').trim() || null
  const date = lessonDate || todayStr()
  if (ta) ta.value = ''
  if (catInp) catInp.value = ''
  api('/api/lesson-items', 'POST', { date, text, category: cat, ts: new Date().toISOString() }).then(item => {
    if (!item || item.error) return
    const idx = lessons.findIndex(l => l.date === date)
    if (idx >= 0) lessons[idx].items.push(item)
    else lessons.push({ date, items: [item] })
    lessons.sort((a, b) => a.date.localeCompare(b.date))
    updateLsnCatsList(); renderLessons(); renderChain(); renderStats()
  }).catch(console.error)
}
let lsnCats: string[] = []
function updateLsnCatsList() {
  const cats = new Set<string>()
  lessons.forEach(l => (l.items || []).forEach((item: Any) => { if (item.category) cats.add(item.category) }))
  lsnCats = [...cats].sort((a, b) => a.localeCompare(b))
  renderCatSug()
}
function renderCatSug() {
  const box = gid('lta-cat-sug'); const inp = gid('lta-cat') as HTMLInputElement | null
  if (!box || !inp) return
  if (document.activeElement !== inp) { box.style.display = 'none'; return } // cuma muncul pas input lagi difokus
  const q = inp.value.toLowerCase().replace(/^#/, '').trim()
  const matches = lsnCats.filter(c => c.toLowerCase().includes(q))
  if (!matches.length) { box.style.display = 'none'; box.innerHTML = ''; return }
  const e = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string))
  box.innerHTML = matches.slice(0, 14).map(c => `<div class="cat-sug-row" data-cat="${e(c)}"><span class="cat-sug-dot"></span>${e(c)}</div>`).join('')
  box.style.display = 'block'
}
function showCatSug() { renderCatSug() }
function hideCatSug() { const box = gid('lta-cat-sug'); if (box) box.style.display = 'none' }
function delLessonFromModal(id: string) {
  showConfirm('Pelajaran ini akan dihapus permanen.', async () => {
    try {
      await api('/api/lesson-items?id=' + id, 'DELETE')
      lessons.forEach(l => { if (l.items) l.items = l.items.filter((i: Any) => i.id !== id) })
      openLessonsModal()
      render()
    } catch (e) { alert('Gagal hapus: ' + (e as Error).message) }
  }, { title: 'Hapus Pelajaran?', icon: '🗑️', okLabel: 'Hapus' })
}
function renderLessons() {
  const el = gid('lsn-list')
  if (el) el.style.display = 'none'
}

// ── TODOS ──
function filterCat(el: HTMLElement) {
  todoCat = el.dataset.cat || 'Semua'
  renderCatBar()
  renderTodos()
}
function filterStatus(el: HTMLElement) {
  document.querySelectorAll('.sbtn').forEach(c => c.classList.remove('active'))
  el.classList.add('active')
  todoStatus = el.dataset.status || 'todo'
  renderTodos()
}

function guessMode(text: string) {
  const t = text.toLowerCase()
  if (LEARNING_KEYWORDS.some(w => t.includes(w))) return 'learning'
  return 'doing'
}

function updateCatHint(val: string) {
  const hint = gid('cat-hint')
  if (!hint) return
  if (!val.trim()) { hint.classList.remove('show'); hint.innerHTML = ''; return }
  const modeLabel = guessMode(val) === 'learning' ? 'Learning' : 'To Do'
  hint.innerHTML = `→ <span style="font-weight:700;color:var(--red)">${modeLabel}</span>`
  hint.classList.add('show')
}

function addTodo() {
  const inp = gid<HTMLInputElement>('ti')
  const text = (inp?.value || '').trim(); if (!text) return
  const mode = guessMode(text) // belajar/pelajari/dalami/learn → learning, sisanya to-do
  const t = { id: crypto.randomUUID(), text, cat: null, mode, done: false, doneDate: null, points_to: 'personal' }
  todos.unshift(t); saveTodoDB(t)
  if (inp) inp.value = ''
  const hint = gid('cat-hint'); if (hint) { hint.classList.remove('show'); hint.innerHTML = '' }
  if (mode !== todoMode) { filterMode(mode) } else { renderTodos(); renderStats() }
}

function selectLearningCat(cat: string) {
  learningSelectedCat = cat
  renderActCatButtons('#learning-cat-btns', 'selectLearningCat', cat)
}

async function toggleTodo(id: string) {
  const t = todos.find(x => x.id === id); if (!t) return
  if (!t.done && t.mode === 'learning') {
    learningTodoId = id
    learningSelectedCat = t.points_to || getActCats()[0]?.key || 'personal'
    const todoTextEl = gid('learning-todo-text'); if (todoTextEl) todoTextEl.textContent = t.text
    const resultEl = gid<HTMLTextAreaElement>('learning-result-text'); if (resultEl) resultEl.value = ''
    renderActCatButtons('#learning-cat-btns', 'selectLearningCat', learningSelectedCat)
    const lockBtn = gid<HTMLButtonElement>('lock-learning-btn')
    if (lockBtn) { lockBtn.disabled = false; lockBtn.style.opacity = '1' }
    gid('learning-modal')?.classList.add('open')
    setTimeout(() => gid<HTMLTextAreaElement>('learning-result-text')?.focus(), 100)
    return
  }
  if (!t.done && t.mode === 'doing') {
    doingTodoId = id
    doingSelectedCat = t.points_to || getActCats()[0]?.key || 'personal'
    const todoTextEl = gid('doing-todo-text'); if (todoTextEl) todoTextEl.textContent = t.text
    renderActCatButtons('#doing-cat-btns', 'selectDoingCat', doingSelectedCat)
    gid('doing-modal')?.classList.add('open')
    return
  }
  await completeTodo(id)
}
function selectDoingCat(cat: string) {
  doingSelectedCat = cat
  renderActCatButtons('#doing-cat-btns', 'selectDoingCat', cat)
}
function closeDoingModal() {
  gid('doing-modal')?.classList.remove('open')
}
async function confirmDoing() {
  const t = doingTodoId ? todos.find(x => x.id === doingTodoId) : null
  if (t) t.points_to = doingSelectedCat || getActCats()[0]?.key || 'personal'
  closeDoingModal()
  if (doingTodoId) await completeTodo(doingTodoId)
  doingTodoId = null; doingSelectedCat = null
}

async function completeTodo(id: string) {
  const t = todos.find(x => x.id === id); if (!t) return
  const prevDoneDate = t.doneDate
  const pointsCat = t.points_to || 'personal'
  t.done = !t.done; t.doneDate = t.done ? todayStr() : null
  saveTodoDB(t)
  if (t.done) {
    try {
      const act = await api('/api/activities', 'POST', { date: todayStr(), category: pointsCat, text: t.text })
      activities.push(act)
    } catch (e) { console.error(e) }
  } else if (prevDoneDate) {
    const match = activities.find(a => a.date === prevDoneDate && a.category === pointsCat && a.text === t.text)
    if (match) {
      await api('/api/activities?id=' + match.id, 'DELETE').catch(console.error)
      activities = activities.filter(a => a.id !== match.id)
    }
    if (t.mode === 'learning') {
      const prefix = '[Learning] ' + t.text + ' →'
      const dayLesson = lessons.find(l => l.date === prevDoneDate)
      const matchItem = dayLesson?.items?.find((i: Any) => i.text && i.text.startsWith(prefix))
      if (matchItem) {
        await api('/api/lesson-items?id=' + matchItem.id, 'DELETE').catch(console.error)
        dayLesson.items = dayLesson.items.filter((i: Any) => i.id !== matchItem.id)
      }
    }
  }
  render()
}

async function confirmLearning() {
  const btn = gid<HTMLButtonElement>('lock-learning-btn')
  if (btn && btn.disabled) return
  if (btn) { btn.disabled = true; btn.style.opacity = '.5' }
  const text = (gid<HTMLTextAreaElement>('learning-result-text')?.value || '').trim()
  const pointsCat = learningSelectedCat || getActCats()[0]?.key || 'personal'
  if (text) {
    const today = todayStr()
    try {
      const item = await api('/api/lesson-items', 'POST', { date: today, text: '[Learning] ' + (gid('learning-todo-text')?.textContent || '') + ' → ' + text, category: 'Learning', ts: new Date().toISOString() })
      if (item && !item.error) {
        const idx = lessons.findIndex(l => l.date === today)
        if (idx >= 0) { lessons[idx].items = lessons[idx].items || []; lessons[idx].items.push(item) }
        else { lessons.push({ date: today, items: [item] }) }
      }
    } catch (e) { console.error(e) }
  }
  if (learningTodoId) {
    const t = todos.find(x => x.id === learningTodoId)
    if (t) t.points_to = pointsCat
  }
  closeLearningModal()
  if (learningTodoId) await completeTodo(learningTodoId)
  learningTodoId = null; learningSelectedCat = null
}

function closeLearningModal() {
  gid('learning-modal')?.classList.remove('open')
}
function delTodo(id: string) {
  const t = todos.find(x => x.id === id)
  if (t && t.done && t.doneDate) {
    const pointsCat = t.points_to || 'personal'
    const match = activities.find(a => a.date === t.doneDate && a.category === pointsCat && a.text === t.text)
    if (match) { api('/api/activities?id=' + match.id, 'DELETE').catch(console.error); activities = activities.filter(a => a.id !== match.id) }
  }
  todos = todos.filter(x => x.id !== id); delTodoDB(id); renderTodos(); renderStats()
}
function delTodoDB(id: string) {
  api('/api/todos?id=' + id, 'DELETE').catch(console.error)
}
function renderTodos() {
  const list = gid('todo-list')
  if (!list) return
  const doingTodo = todos.filter(t => t.mode === 'doing' && !t.done).length
  const learningTodo = todos.filter(t => t.mode === 'learning' && !t.done).length
  const mctD = gid('mct-doing'); const mctL = gid('mct-learning')
  if (mctD) mctD.textContent = String(doingTodo); if (mctL) mctL.textContent = String(learningTodo)
  let fil = todos.filter(t => (t.mode || 'doing') === todoMode)
  if (todoCat !== 'Semua') fil = fil.filter(t => t.cat === todoCat)
  const pendCnt = fil.filter(t => !t.done).length
  const doneCnt = fil.filter(t => t.done).length
  const sctTodo = gid('sct-todo'); if (sctTodo) sctTodo.textContent = String(pendCnt)
  const sctDone = gid('sct-done'); if (sctDone) sctDone.textContent = String(doneCnt)
  let all: Any[]
  if (todoStatus === 'todo') all = fil.filter(t => !t.done)
  else if (todoStatus === 'done') all = fil.filter(t => t.done)
  else { const pend = fil.filter(t => !t.done); const done = fil.filter(t => t.done); all = [...pend, ...done] }
  if (!all.length) {
    const pernahAda = fil.length > 0
    const msg = todoStatus === 'done'
      ? 'Belum ada task yang selesai.'
      : todoStatus === 'todo'
        ? (pernahAda ? 'Semua task selesai. 🎉' : '✍️ Belum ada task. Tulis task pertama lo di kolom atas.')
        : '✍️ Kosong. Tambah task baru lewat kolom di atas.'
    list.innerHTML = '<div class="empty-note">' + msg + '</div>'
    return
  }
  list.innerHTML = all.map(t => {
    return `<div class="titem${t.done ? ' done' : ''}" onclick="toggleTodo('${t.id}')">
      <div class="tcb"></div>
      <div class="ttxt">${t.text}</div>
      ${t.done ? `<div class="tdone-badge">✓ ${t.doneDate ? fmtShort(t.doneDate) : ''}</div>` : ''}
      <button class="tdel" onclick="event.stopPropagation();delTodo('${t.id}')">✕</button>
    </div>`
  }).join('')
}

function filterMode(mode: string) {
  todoMode = mode
  todoCat = 'Semua'
  gid('mbtn-doing')?.classList.toggle('active', mode === 'doing')
  gid('mbtn-learning')?.classList.toggle('active', mode === 'learning')
  renderCatBar()
  renderTodos()
}

// ── GENERIC MODAL / CONFIRM / TOAST ──
function showToast(msg: string) {
  let t = gid('gst-toast')
  if (!t) {
    t = document.createElement('div'); t.id = 'gst-toast'
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:600;z-index:9999;opacity:0;transition:opacity .3s;pointer-events:none;'
    document.body.appendChild(t)
  }
  t.textContent = msg; t.style.opacity = '1'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearTimeout((t as Any)._timer); (t as Any)._timer = setTimeout(() => { t!.style.opacity = '0' }, 3000)
}
function showConfirm(desc: string, onOk: () => void | Promise<void>, opts: Any = {}) {
  const descEl = gid('confirm-desc'); if (descEl) descEl.textContent = desc
  const titleEl = gid('confirm-title'); if (titleEl) titleEl.textContent = opts.title || 'Yakin?'
  const iconEl = gid('confirm-icon'); if (iconEl) iconEl.textContent = opts.icon || '⚠️'
  const okBtn = gid<HTMLButtonElement>('confirm-ok-btn')
  if (okBtn) {
    okBtn.textContent = opts.okLabel || 'Ya, lanjut'
    okBtn.style.background = opts.danger === false ? 'var(--blk)' : 'var(--red)'
    okBtn.onclick = async () => { closeConfirm(); await onOk() }
  }
  gid('confirm-modal')?.classList.add('open')
}
function closeConfirm() { gid('confirm-modal')?.classList.remove('open') }

function openModal(title: string, bodyHtml: string, footerHtml: string) {
  const titleEl = gid('gm-title'); if (titleEl) titleEl.textContent = title
  const bodyEl = gid('gm-body'); if (bodyEl) bodyEl.innerHTML = bodyHtml
  const footerEl = gid('gm-footer'); if (footerEl) footerEl.innerHTML = footerHtml
  gid('generic-modal')?.classList.add('open')
}
function closeGenericModal() { gid('generic-modal')?.classList.remove('open') }

function renderActCatButtons(containerSelector: string, onClickFn: string, activeCat: string | null) {
  const container = document.querySelector(containerSelector)
  if (!container) return
  container.innerHTML = getActCats().map((c: Any) => `
    <button class="dyn-cat-btn" data-cat="${c.key}" onclick="${onClickFn}('${c.key}')"
      style="padding:6px 12px;border-radius:20px;border:1.5px solid ${activeCat === c.key ? c.color : 'var(--border)'};background:${activeCat === c.key ? c.color : 'var(--bg)'};font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;color:${activeCat === c.key ? '#fff' : 'var(--text2)'};">
      ${c.label}
    </button>`).join('')
}

// ── ACTIVITY CATEGORIES ──
function openAddActCatModal() {
  if (getActCats().length >= 7) { showToast('7 kategori udah cukup brads, keep it focused! 🎯'); return }
  openModal('Tambah Kategori Aktivitas',
    `<label class="mlbl-f">Nama Kategori</label>
     <input class="mini-inp" id="aac-label" placeholder="e.g. Learning, Finance, Social...">
     <label class="mlbl-f">Placeholder teks input</label>
     <input class="mini-inp" id="aac-placeholder" placeholder="e.g. Apa yang dipelajari hari ini?">
     <label class="mlbl-f">Warna</label>
     <input type="color" id="aac-color" value="#6d28d9" style="width:100%;height:32px;border-radius:6px;border:1px solid var(--border);cursor:pointer;">`,
    `<button class="btn-cancel" onclick="closeGenericModal()">Batal</button>
     <button class="btn-primary" onclick="submitAddActCat()">Tambah</button>`
  )
  setTimeout(() => gid('aac-label')?.focus(), 100)
}

async function submitAddActCat() {
  const label = (gid<HTMLInputElement>('aac-label')?.value || '').trim()
  const placeholder = (gid<HTMLInputElement>('aac-placeholder')?.value || '').trim()
  const color = gid<HTMLInputElement>('aac-color')?.value || '#6d28d9'
  if (!label) { alert('Nama wajib diisi.'); return }
  const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_')
  try {
    const c = await api('/api/activity-categories', 'POST', { key, label, color, placeholder, sort_order: activityCategories.length })
    activityCategories.push(c)
    closeGenericModal(); renderLogModal()
  } catch (e) {
    const msg = (e as Error).message
    if (msg?.includes('max_categories')) showToast('7 kategori udah cukup brads! 🎯')
    else alert('Gagal: ' + msg)
  }
}

function openEditActCatModal(idOrKey: string) {
  const c = activityCategories.find(x => x.id === idOrKey || x.key === idOrKey) || ACT_CATS_DEFAULT.find(x => x.key === idOrKey)
  if (!c) return
  openModal('Edit Kategori Aktivitas',
    `<label class="mlbl-f">Nama</label>
     <input class="mini-inp" id="eac-label" value="${c.label}">
     <label class="mlbl-f">Placeholder</label>
     <input class="mini-inp" id="eac-placeholder" value="${c.placeholder || ''}">
     <label class="mlbl-f">Warna</label>
     <input type="color" id="eac-color" value="${c.color}" style="width:100%;height:32px;border-radius:6px;border:1px solid var(--border);cursor:pointer;">`,
    `<button class="btn-cancel" onclick="closeGenericModal()">Batal</button>
     <button class="btn-primary" onclick="submitEditActCat('${c.id || ''}','${c.key}')">Simpan</button>`
  )
}

async function submitEditActCat(id: string, _key: string) {
  const label = (gid<HTMLInputElement>('eac-label')?.value || '').trim()
  const placeholder = (gid<HTMLInputElement>('eac-placeholder')?.value || '').trim()
  const color = gid<HTMLInputElement>('eac-color')?.value || '#6d28d9'
  if (!label) { alert('Nama wajib diisi.'); return }
  try {
    if (id) {
      const updated = await api('/api/activity-categories', 'PATCH', { id, label, color, placeholder })
      const idx = activityCategories.findIndex(c => c.id === id)
      if (idx >= 0) activityCategories[idx] = updated
    }
    closeGenericModal(); renderLogModal()
  } catch (e) { alert('Gagal: ' + (e as Error).message) }
}

function renderLogModal() {
  const body = gid('mo-body')
  if (!body) return
  const cats = getActCats()
  if (!cats.length) {
    const examples = ACT_CATS_DEFAULT.map(c => c.label).join(', ')
    body.innerHTML = `
      <div style="text-align:center;padding:30px 18px;">
        <div style="font-size:30px;margin-bottom:10px;">🧩</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">Bikin kategori habit versi lo</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:4px;">Belum ada kategori. Tentuin sendiri area hidup yang mau lo track tiap hari.</div>
        <div style="font-size:11px;color:var(--text3);line-height:1.6;margin-bottom:18px;">Contoh: ${examples} — atau apa pun versi lo (Deep Work, Gym, Reading, Family…).</div>
        <button onclick="openAddActCatModal()" style="background:var(--red);border:none;color:#fff;border-radius:var(--r2);padding:9px 20px;font-size:12px;font-weight:700;cursor:pointer;">+ Bikin Kategori Pertama</button>
      </div>`
    return
  }
  body.innerHTML = cats.map((c: Any, i: number) => `
    <div class="fsec" style="${i === 0 ? 'margin-top:0;padding-top:0;border-top:none;' : ''}">
      <span style="color:${c.color}">${c.label}</span>
      <button class="act-edit-btn" onclick="openEditActCatModal('${c.id || c.key}')" title="Edit kategori" style="float:right;background:none;border:none;color:var(--text4);cursor:pointer;font-size:10px;padding:0 4px;">✎</button>
    </div>
    <div class="act-input-row">
      <input type="text" id="act-inp-${c.key}" class="finp" placeholder="${c.placeholder || c.label + ' hari ini...'}" onkeydown="if(event.key==='Enter')addActivity('${c.key}')">
      <button class="act-add-btn" onclick="addActivity('${c.key}')">+ Add</button>
    </div>
    <div class="act-list" id="act-list-${c.key}"></div>
    <div class="act-count" id="act-count-${c.key}"></div>
  `).join('')
  cats.forEach((c: Any) => renderActList(c.key))
  if (!body.querySelector('.act-manage-row')) {
    const mgr = document.createElement('div')
    mgr.className = 'act-manage-row'
    mgr.style.cssText = 'padding:10px 0 0;text-align:center;'
    mgr.innerHTML = `<button onclick="openAddActCatModal()" style="background:none;border:1px dashed var(--border2);border-radius:20px;padding:5px 16px;font-size:10px;color:var(--text3);cursor:pointer;" ${getActCats().length >= 7 ? 'disabled' : ''}>+ Tambah Kategori (${getActCats().length}/7)</button>`
    body.appendChild(mgr)
  }
}

// ── TODO CATEGORIES ──
function renderCatBar() {
  const bar = gid('cat-bar')
  if (!bar) return
  const cats = todoCategories.filter(c => c.mode === todoMode)
  let html = `<div class="cchip active" data-cat="Semua" onclick="filterCat(this)">Semua</div>`
  cats.forEach(c => {
    const isActive = todoCat === c.name
    html += `<div class="cchip${isActive ? ' active' : ''}" data-cat="${c.name}" onclick="filterCat(this)">${c.name}<span class="cchip-edit" onclick="event.stopPropagation();openEditCatModal('${c.id}')">✎</span></div>`
  })
  html += `<button class="cchip-add" onclick="openAddCatModal()" title="Tambah kategori">+</button>`
  bar.innerHTML = html
  bar.querySelectorAll<HTMLElement>('.cchip').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === todoCat)
  })
}

function openEditCatModal(id: string) {
  const c = todoCategories.find(x => x.id === id); if (!c) return
  const actCatOptions = getActCats().map((a: Any) => `<option value="${a.key}"${a.key === c.points_to ? ' selected' : ''}>${a.label}</option>`).join('')
  const kwStr = Array.isArray(c.keywords) ? c.keywords.join(', ') : c.keywords || ''
  openModal('Edit Kategori',
    `<label class="mlbl-f">Nama Kategori</label>
     <input class="mini-inp" id="ec-name" value="${c.name}">
     <label class="mlbl-f">Poin masuk ke</label>
     <select class="mini-sel" id="ec-points">${actCatOptions}</select>
     <label class="mlbl-f">Keywords (pisah koma)</label>
     <input class="mini-inp" id="ec-keywords" value="${kwStr}" placeholder="e.g. bikin, buat, develop">
     <label class="mlbl-f">Warna</label>
     <input type="color" id="ec-color" value="${c.color}" style="width:100%;height:32px;border-radius:6px;border:1px solid var(--border);cursor:pointer;">`,
    `<button class="btn-cancel" onclick="closeGenericModal()">Batal</button>
     <button class="btn-primary" onclick="submitEditCat('${id}')">Simpan</button>`
  )
  setTimeout(() => gid('ec-name')?.focus(), 100)
}

async function submitEditCat(id: string) {
  const name = (gid<HTMLInputElement>('ec-name')?.value || '').trim()
  const pointsTo = gid<HTMLSelectElement>('ec-points')?.value || 'personal'
  const kwRaw = gid<HTMLInputElement>('ec-keywords')?.value || ''
  const color = gid<HTMLInputElement>('ec-color')?.value || '#6d28d9'
  if (!name) { alert('Nama wajib diisi.'); return }
  const keywords = kwRaw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
  try {
    const updated = await api('/api/todo-categories', 'PATCH', { id, name, color, keywords, points_to: pointsTo })
    const idx = todoCategories.findIndex(c => c.id === id)
    if (idx >= 0) todoCategories[idx] = updated
    if (todoCat === todoCategories[idx]?.name || todoCat === name) todoCat = name
    closeGenericModal()
    renderCatBar(); renderTodos()
  } catch (e) { alert('Gagal: ' + (e as Error).message) }
}

function openAddCatModal() {
  const cats = todoCategories.filter(c => c.mode === todoMode)
  if (cats.length >= 5) { showToast("Don't too much stuff brads, keep focus 🎯"); return }
  const actLabel = todoMode === 'doing' ? 'Doing' : 'Learning'
  const actCatOptions = getActCats().map((a: Any) => `<option value="${a.key}">${a.label}</option>`).join('')
  openModal('Tambah Kategori ' + actLabel,
    `<label class="mlbl-f">Nama Kategori</label>
     <input class="mini-inp" id="mc-name" placeholder="e.g. Working Stage, Market...">
     <label class="mlbl-f">Poin masuk ke</label>
     <select class="mini-sel" id="mc-points">${actCatOptions}</select>
     <label class="mlbl-f">Keywords (pisah koma, untuk auto-detect)</label>
     <input class="mini-inp" id="mc-keywords" placeholder="e.g. bikin, buat, develop, build">
     <label class="mlbl-f">Warna</label>
     <input type="color" id="mc-color" value="#6d28d9" style="width:100%;height:32px;border-radius:6px;border:1px solid var(--border);cursor:pointer;">`,
    `<button class="btn-cancel" onclick="closeGenericModal()">Batal</button>
     <button class="btn-primary" onclick="submitAddCat()">Tambah</button>`
  )
  setTimeout(() => gid('mc-name')?.focus(), 100)
}

async function submitAddCat() {
  const name = (gid<HTMLInputElement>('mc-name')?.value || '').trim()
  const pointsTo = gid<HTMLSelectElement>('mc-points')?.value || 'personal'
  const kwRaw = gid<HTMLInputElement>('mc-keywords')?.value || ''
  const color = gid<HTMLInputElement>('mc-color')?.value || '#6d28d9'
  if (!name) { alert('Nama kategori wajib diisi.'); return }
  const keywords = kwRaw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
  try {
    const c = await api('/api/todo-categories', 'POST', { mode: todoMode, name, color, keywords, points_to: pointsTo })
    todoCategories.push(c)
    closeGenericModal()
    renderCatBar()
  } catch (e) {
    const msg = (e as Error).message
    if (msg?.includes('max_categories')) showToast("Don't too much stuff brads, keep focus 🎯")
    else alert('Gagal: ' + msg)
  }
}

// ── ACTIVITY LOG MODAL ──
function renderActList(cat: string) {
  const dstr = logDate || todayStr()
  const list = gid('act-list-' + cat)
  const countEl = gid('act-count-' + cat)
  if (!list) return
  const items = activities.filter(a => a.date === dstr && a.category === cat)
  if (countEl) countEl.textContent = items.length ? items.length + ' aktivitas' : ''
  list.innerHTML = items.length
    ? items.map(a => `<div class="act-item"><span class="act-item-text">${a.text}</span><button class="act-del" onclick="delActivity('${a.id}','${cat}')">✕</button></div>`).join('')
    : ''
}

async function addActivity(cat: string) {
  const inp = gid<HTMLInputElement>('act-inp-' + cat)
  const text = (inp?.value || '').trim(); if (!text) return
  const dstr = logDate || todayStr()
  const btn = inp?.nextElementSibling as HTMLButtonElement | null
  if (btn) btn.disabled = true
  try {
    const act = await api('/api/activities', 'POST', { date: dstr, category: cat, text })
    activities.push(act); if (inp) inp.value = ''
    renderActList(cat); render()
  } catch (err) {
    alert('Gagal simpan aktivitas.\n\nError: ' + (err as Error).message + '\n\nCoba refresh halaman lalu coba lagi.')
  } finally { if (btn) btn.disabled = false }
  inp?.focus()
}

async function delActivity(id: string, cat: string) {
  await api('/api/activities?id=' + id, 'DELETE')
  activities = activities.filter(a => a.id !== id)
  renderActList(cat); render()
}

function openLogDate(dstr: string) {
  logDate = dstr
  const badge = gid('mdbadge'); if (badge) badge.textContent = fmtFull(dstr)
  getActCats().forEach((c: Any) => {
    const inp = gid<HTMLInputElement>('act-inp-' + c.key)
    if (inp) inp.value = ''
    renderActList(c.key)
  })
  gid('mo')?.classList.add('open')
  setTimeout(() => gid('act-inp-' + (getActCats()[0]?.key || ''))?.focus(), 100)
}
function closeModal() { gid('mo')?.classList.remove('open'); render() }

// ── WISHES ──
function saveWishDB(w: Any) {
  api('/api/wishes', 'POST', { id: w.id, text: w.text, done: w.done, done_date: w.doneDate || null, achievement_story: w.achievementStory || null, created_at: w.createdAt || new Date().toISOString() }).catch(console.error)
}
function delWishDB(id: string) {
  api('/api/wishes?id=' + id, 'DELETE').catch(console.error)
}
function addWish() {
  const inp = gid<HTMLInputElement>('wish-inp')
  const text = (inp?.value || '').trim(); if (!text) return
  const w = { id: crypto.randomUUID(), text, done: false, doneDate: null, achievementStory: null, createdAt: new Date().toISOString() }
  wishes.push(w); saveWishDB(w)
  if (inp) inp.value = ''; renderStats()
}
function delWish(id: string) {
  showConfirm('Wish ini akan dihapus permanen.', () => {
    wishes = wishes.filter(w => w.id !== id); delWishDB(id); renderStats(); renderWishList()
  }, { title: 'Hapus Wish?', icon: '🗑️', okLabel: 'Hapus' })
}
function selectWishCat(cat: string) {
  wishAchieveCat = cat
  renderActCatButtons('#wish-cat-btns', 'selectWishCat', cat)
  document.querySelectorAll<HTMLElement>('#wish-cat-btns .dyn-cat-btn').forEach(b => {
    const active = b.dataset.cat === cat
    b.style.background = active ? 'var(--red)' : 'var(--bg)'
    b.style.color = active ? '#fff' : 'var(--text2)'
    b.style.borderColor = active ? 'var(--red)' : 'var(--border)'
  })
}
function openAchieveWish(id: string) {
  const w = wishes.find(x => x.id === id); if (!w) return
  wishAchieveCat = null
  renderActCatButtons('#wish-cat-btns', 'selectWishCat', null)
  const textEl = gid('achieve-wish-text'); if (textEl) textEl.textContent = '"' + w.text + '"'
  const storyEl = gid<HTMLTextAreaElement>('achieve-wish-story'); if (storyEl) storyEl.value = ''
  const modal = gid('achieve-wish-modal')
  if (modal) { modal.dataset.id = id; modal.classList.add('open') }
}
async function confirmAchieveWish() {
  const modal = gid('achieve-wish-modal')
  const id = modal?.dataset.id || ''
  const story = (gid<HTMLTextAreaElement>('achieve-wish-story')?.value || '').trim()
  if (!story) { alert('Ceritakan dulu gimana lo mencapai ini! 💪'); return }
  if (!wishAchieveCat) { alert('Pilih kategori untuk 10 poin aktivitas dulu!'); return }
  const w = wishes.find(x => x.id === id); if (!w) return
  w.done = true; w.doneDate = todayStr(); w.achievementStory = story; w.achieveCategory = wishAchieveCat
  saveWishDB(w)
  const today = todayStr()
  for (let i = 0; i < 10; i++) {
    try { const act = await api('/api/activities', 'POST', { date: today, category: wishAchieveCat, text: '[W] ' + w.text }); activities.push(act) }
    catch (e) { console.error(e) }
  }
  modal?.classList.remove('open')
  renderStats(); renderChain()
}
function cancelAchieveWish(id: string) {
  showConfirm('10 poin aktivitas yang ditambahkan akan dihapus.', async () => {
    const w = wishes.find(x => x.id === id); if (!w) return
    const prevDate = w.doneDate
    const prevCat = w.achieveCategory
    const prefix = '[W] ' + w.text
    w.done = false; w.doneDate = null; w.achievementStory = null; w.achieveCategory = null
    saveWishDB(w)
    const toDelete = activities
      .filter(a => a.date === prevDate && a.text === prefix && (!prevCat || a.category === prevCat))
      .slice(0, 10)
    await Promise.all(toDelete.map(a => api('/api/activities?id=' + a.id, 'DELETE').catch(console.error)))
    activities = activities.filter(a => !toDelete.find((d: Any) => d.id === a.id))
    renderWishList(); renderStats(); renderChain()
  }, { title: 'Batalkan Wish?', icon: '💔', okLabel: 'Ya, batalkan' })
}
function openWishesModal() {
  renderWishList()
  gid('wish-modal')?.classList.add('open')
}
function closeWishesModal() { gid('wish-modal')?.classList.remove('open') }
function renderWishList() {
  const body = gid('wish-modal-body')
  const badge = gid('wish-modal-count')
  if (!body) return
  if (badge) badge.textContent = wishes.filter(w => !w.done).length + ' belum tercapai'
  const esc = (s: string) => (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
  if (!wishes.length) { body.innerHTML = '<div class="empty-note" style="padding:24px;">Belum ada wish. Tambahkan impian pertama lo!</div>'; return }
  body.innerHTML = wishes.map(w => `
    <div class="wish-item${w.done ? ' wish-done' : ''}">
      <div class="wish-cb-wrap">
        ${w.done
      ? `<div class="wish-cb checked" onclick="cancelAchieveWish('${w.id}')" style="cursor:pointer;" title="Klik untuk batalkan pencapaian">✓</div>`
      : `<div class="wish-cb" onclick="openAchieveWish('${w.id}')"></div>`}
      </div>
      <div class="wish-content">
        <div class="wish-text">${esc(w.text)}</div>
        ${w.done ? `<div class="wish-meta">✦ Achieved ${w.doneDate || ''} — <em>${esc(w.achievementStory || '')}</em></div>` : ''}
      </div>
      ${w.done ? '' : '<button class="wish-del" onclick="delWish(\'' + w.id + '\')">✕</button>'}
    </div>`).join('')
}

// ── TARGET QUOTES ──
function renderQuote() {
  const q = TARGET_QUOTES[tqIdx]
  const tEl = gid('tq-text'); const bEl = gid('tq-by')
  if (!tEl || !bEl) return
  tEl.textContent = q.t; bEl.textContent = q.by ? '— ' + q.by : ''
}
function rotateQuote() { tqIdx = (tqIdx + 1) % TARGET_QUOTES.length; renderQuote() }
function startQuoteRotation() { tqIdx = Math.floor(Math.random() * TARGET_QUOTES.length); renderQuote(); quoteTimer = setInterval(rotateQuote, 12000) }

// ── CLOCK ──
function startClock() {
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const dn = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  function drawAnalog(n: Date) {
    const canvas = gid<HTMLCanvasElement>('analog-clock')
    if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, r = w / 2 - 1.5
    ctx.clearRect(0, 0, w, h)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1.5; ctx.stroke()
    for (let i = 0; i < 12; i++) {
      const a = (i * 30) * Math.PI / 180
      const x1 = cx + (r - 3) * Math.sin(a), y1 = cy - (r - 3) * Math.cos(a)
      const x2 = cx + (r - 6) * Math.sin(a), y2 = cy - (r - 6) * Math.cos(a)
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
      ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1; ctx.stroke()
    }
    const hrs = n.getHours() % 12, mins = n.getMinutes(), secs = n.getSeconds()
    const ha = (hrs * 30 + mins * 0.5) * Math.PI / 180
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.lineTo(cx + (r * 0.52) * Math.sin(ha), cy - (r * 0.52) * Math.cos(ha))
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke()
    const ma = (mins * 6 + secs * 0.1) * Math.PI / 180
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.lineTo(cx + (r * 0.75) * Math.sin(ma), cy - (r * 0.75) * Math.cos(ma))
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 2 * Math.PI)
    ctx.fillStyle = '#ef4444'; ctx.fill()
  }
  function tick() {
    const n = new Date()
    const hdate = gid('hdate'); if (hdate) hdate.textContent = `${dn[n.getDay()]}, ${n.getDate()} ${mn[n.getMonth()]} ${n.getFullYear()}`
    drawAnalog(n)
  }
  tick()
  if (clockTimer) clearInterval(clockTimer)
  clockTimer = setInterval(tick, 1000)
}

// ── VIEW TOGGLE / CHARTS ──
function switchView(v: string) {
  currentView = v
  const cp = gid('cp'); if (cp) cp.style.display = v === 'chain' ? 'block' : 'none'
  const pc = gid('panel-chart'); if (pc) pc.style.display = v === 'chart' ? 'block' : 'none'
  document.querySelectorAll('.vtab').forEach(t => t.classList.remove('active'))
  gid('tab-' + v)?.classList.add('active')
  if (v === 'chart') { renderBarChart(); renderLineChart() }
}

function setRange(type: string, el: HTMLElement) {
  document.querySelectorAll(`#range-${type} .rchip`).forEach(c => c.classList.remove('active'))
  el.classList.add('active')
  if (type === 'bar') { barRange = el.dataset.r || 'all'; renderBarChart() }
  else { lineRange = el.dataset.r || 'all'; renderLineChart() }
}

function buildDayData(date: string) {
  const cats = getActCats()
  const row: Any = { date }
  const dayActs = activities.filter(a => a.date === date)
  if (dayActs.length) {
    cats.forEach((c: Any) => { row[c.key] = dayActs.filter((a: Any) => a.category === c.key).length })
    return row
  }
  // Fallback gst_entries lama: skor rs/ws/ms/ps dipetakan ke key asli kalau kategorinya masih ada
  const e = entries.find(x => x.date === date)
  const legacy: Record<string, number> = e ? { religion: e.rs || 0, work: e.ws || 0, personal: e.ms || 0, exercise: e.ps || 0 } : {}
  cats.forEach((c: Any) => { row[c.key] = legacy[c.key] || 0 })
  return row
}

function fillDateGaps(range: string) {
  const allDates = [...new Set([...activities.map(a => a.date), ...entries.map(e => e.date)])].sort()
  if (!allDates.length) return []
  let filtered = allDates
  if (range !== 'all' && range.startsWith('m')) {
    const yr = new Date().getFullYear(); const mo = parseInt(range.slice(1))
    const start = `${yr}-${String(mo).padStart(2, '0')}-01`; const end = tds(new Date(yr, mo, 0))
    filtered = allDates.filter(d => d >= start && d <= end)
  }
  if (!filtered.length) return []
  const result: Any[] = []
  const cur = new Date(filtered[0] + 'T00:00:00')
  const end = new Date(filtered[filtered.length - 1] + 'T00:00:00')
  while (cur <= end) { const s = tds(cur); result.push(buildDayData(s)); cur.setDate(cur.getDate() + 1) }
  return result
}

function rolling(arr: Any[], key: string, window = 7) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - window + 1), i + 1)
    return +(slice.reduce((s, e) => s + (e[key] || 0), 0) / slice.length).toFixed(2)
  })
}

function toggleDataset(chartId: string, idx: number, el: HTMLElement) {
  const inst = chartId === 'bar' ? chartBarInstance : chartLineInstance
  if (!inst) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (inst as Any).getDatasetMeta(idx)
  meta.hidden = !meta.hidden
  inst.update()
  el.classList.toggle('off', meta.hidden)
}

function hexA(hex: string, a: number) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Legend chart dibangun dinamis dari kategori user (bukan hardcoded)
function renderChartLegend(containerId: string, chartId: string) {
  const el = gid(containerId); if (!el) return
  const escL = (s: string) => (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
  el.innerHTML = getActCats().map((c: Any, i: number) =>
    `<div class="cl-item" data-idx="${i}"><div class="cl-dot" style="background:${c.color}"></div>${escL(c.label)}</div>`
  ).join('')
  el.querySelectorAll<HTMLElement>('.cl-item').forEach(item => {
    item.onclick = () => toggleDataset(chartId, Number(item.dataset.idx || 0), item)
  })
}

async function renderBarChart() {
  renderChartLegend('bar-legend', 'bar')
  const data = fillDateGaps(barRange)
  if (!data.length) return
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const labels = data.map(e => { const d = new Date(e.date + 'T00:00:00'); return `${d.getDate()} ${mn[d.getMonth()]}` })
  const canvas = gid<HTMLCanvasElement>('chart-bar')
  if (!canvas) return
  canvas.style.height = '260px'; canvas.style.width = Math.max(600, data.length * 18) + 'px'
  if (canvas.parentElement) canvas.parentElement.style.overflowX = 'auto'
  if (chartBarInstance) { chartBarInstance.destroy(); chartBarInstance = null }
  const Chart = await getChart()
  chartBarInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels, datasets: getActCats().map((c: Any) => ({
        label: c.label, data: data.map((e: Any) => e[c.key] || 0), backgroundColor: c.color, stack: 's',
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      layout: { padding: { top: 10, right: 8, bottom: 2, left: 2 } },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { title: ctx => ctx[0].label, label: ctx => `${ctx.dataset.label}: ${ctx.raw}x` } } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, color: '#8089a0', maxRotation: 45, minRotation: 45, maxTicksLimit: 40 } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,.06)' }, ticks: { font: { size: 9 }, color: '#8089a0' }, min: 0 },
      },
    },
  })
}

async function renderLineChart() {
  renderChartLegend('line-legend', 'line')
  const data = fillDateGaps(lineRange)
  if (!data.length) return
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const labels = data.map(e => { const d = new Date(e.date + 'T00:00:00'); return `${d.getDate()} ${mn[d.getMonth()]}` })
  const lineOpts = { tension: .4, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, fill: true }
  const canvasLine = gid<HTMLCanvasElement>('chart-line')
  if (!canvasLine) return
  canvasLine.style.height = '240px'; canvasLine.style.width = Math.max(600, data.length * 14) + 'px'
  if (chartLineInstance) { chartLineInstance.destroy(); chartLineInstance = null }
  const Chart = await getChart()
  chartLineInstance = new Chart(canvasLine, {
    type: 'line',
    data: {
      labels, datasets: getActCats().map((c: Any) => ({
        label: c.label, data: rolling(data, c.key), borderColor: c.color, backgroundColor: hexA(c.color, 0.06), ...lineOpts,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      layout: { padding: { top: 10, right: 8, bottom: 2, left: 2 } },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: ctx => ctx[0].label } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#8089a0', maxRotation: 45, minRotation: 45, maxTicksLimit: 30 } },
        y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { font: { size: 9 }, color: '#8089a0' }, min: 0 },
      },
    },
  })

  const totalKeys = getActCats().map((c: Any) => c.key)
  const totalData = data.map((e: Any) => totalKeys.reduce((s: number, k: string) => s + (e[k] || 0), 0))
  const rollingTotal = rolling(totalData.map(v => ({ v })), 'v', 7)
  const canvasTotal = gid<HTMLCanvasElement>('chart-total')
  if (!canvasTotal) return
  canvasTotal.style.height = '180px'; canvasTotal.style.width = Math.max(600, data.length * 14) + 'px'
  if (chartTotalInstance) { chartTotalInstance.destroy(); chartTotalInstance = null }
  chartTotalInstance = new Chart(canvasTotal, {
    type: 'line',
    data: {
      labels, datasets: [
        { label: 'Raw Total', data: totalData, borderColor: 'rgba(62,109,240,0.25)', backgroundColor: 'transparent', tension: .1, pointRadius: 0, borderWidth: 1, fill: false },
        { label: '7D Avg', data: rollingTotal, borderColor: '#3e6df0', backgroundColor: 'rgba(62,109,240,0.1)', tension: .4, pointRadius: 0, borderWidth: 2, fill: true },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      layout: { padding: { top: 10, right: 8, bottom: 2, left: 2 } },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: ctx => ctx[0].label } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#8089a0', maxRotation: 45, minRotation: 45, maxTicksLimit: 30 } },
        y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { font: { size: 9 }, color: '#8089a0' }, min: 0 },
      },
    },
  })
}

// ── GOALS ──
function saveGoalDB(g: Any) {
  api('/api/goals', 'POST', { id: g.id, text: g.text, scope: g.scope, yr: g.yr || null, ym: g.ym || null, done: g.done, done_date: g.doneDate || null }).catch(console.error)
}
function delGoalDB(id: string) {
  api('/api/goals?id=' + id, 'DELETE').catch(console.error)
}
function switchGoalTab(t: string) {
  goalTab = t
  document.querySelectorAll<HTMLElement>('.gtab').forEach(el => el.classList.toggle('active', el.dataset.tab === t))
  renderGoals()
}
function goalNav(d: number) {
  if (goalTab === 'year') { goalNavYr += d }
  else { goalNavM += d; if (goalNavM < 0) { goalNavM = 11; goalNavY-- } else if (goalNavM > 11) { goalNavM = 0; goalNavY++ } }
  renderGoals()
}
function goalNow() { const n = new Date(); goalNavY = n.getFullYear(); goalNavM = n.getMonth(); goalNavYr = n.getFullYear(); renderGoals() }
function addGoal() {
  const inp = gid<HTMLInputElement>('gi'); const text = (inp?.value || '').trim(); if (!text) return
  const yr = goalNavYr, ym = `${goalNavY}-${p2(goalNavM + 1)}`
  const g = { id: crypto.randomUUID(), text, scope: goalTab, yr: goalTab === 'year' ? yr : null, ym: goalTab === 'month' ? ym : null, done: false, doneDate: null }
  goals.unshift(g); saveGoalDB(g)
  if (inp) inp.value = ''; renderGoals()
}

async function toggleGoal(id: string) {
  const g = goals.find(x => x.id === id); if (!g) return
  if (!g.done) {
    goalAchieveId = id; goalAchieveCat = null
    const textEl = gid('goal-achieve-text'); if (textEl) textEl.textContent = g.text
    const ptsEl = gid('goal-achieve-pts'); if (ptsEl) ptsEl.textContent = g.scope === 'year' ? '+7 poin aktivitas' : '+3 poin aktivitas'
    renderActCatButtons('#goal-cat-btns', 'selectGoalCat', null)
    gid('goal-achieve-modal')?.classList.add('open')
  } else {
    showConfirm((g.scope === 'year' ? '7' : '3') + ' poin aktivitas yang ditambahkan akan dihapus.', async () => {
      const prevDate = g.doneDate; const n = g.scope === 'year' ? 7 : 3
      const prefix = '[G] ' + g.text
      const prevCat = g.achieveCategory
      g.done = false; g.doneDate = null; g.achieveCategory = null; saveGoalDB(g)
      const toDelete = activities
        .filter(a => a.date === prevDate && a.text === prefix && (!prevCat || a.category === prevCat))
        .slice(0, n)
      await Promise.all(toDelete.map((a: Any) => api('/api/activities?id=' + a.id, 'DELETE').catch(console.error)))
      activities = activities.filter(a => !toDelete.find((d: Any) => d.id === a.id))
      render()
    }, { title: 'Batalkan Goal?', icon: '🎯', okLabel: 'Ya, batalkan' })
  }
}

function selectGoalCat(cat: string) {
  goalAchieveCat = cat
  renderActCatButtons('#goal-cat-btns', 'selectGoalCat', cat)
  document.querySelectorAll<HTMLElement>('#goal-cat-btns .dyn-cat-btn').forEach(b => {
    const active = b.dataset.cat === cat
    b.style.background = active ? 'var(--blk)' : 'var(--bg)'
    b.style.color = active ? '#fff' : 'var(--text2)'
    b.style.borderColor = active ? 'var(--blk)' : 'var(--border)'
  })
  const btn = gid<HTMLButtonElement>('goal-achieve-confirm')
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer' }
}

async function confirmGoalAchieve() {
  if (!goalAchieveId) return
  if (!goalAchieveCat) { showToast('Pilih kategori dulu buat poin aktivitasnya 🎯'); return }
  const g = goals.find(x => x.id === goalAchieveId); if (!g) return
  const n = g.scope === 'year' ? 7 : 3; const today = todayStr()
  g.done = true; g.doneDate = today; g.achieveCategory = goalAchieveCat; saveGoalDB(g)
  for (let i = 0; i < n; i++) {
    try { const act = await api('/api/activities', 'POST', { date: today, category: goalAchieveCat, text: '[G] ' + g.text }); activities.push(act) }
    catch (e) { console.error(e) }
  }
  closeGoalAchieveModal(); render()
}

function closeGoalAchieveModal() {
  gid('goal-achieve-modal')?.classList.remove('open')
  goalAchieveId = null; goalAchieveCat = null
}

function delGoal(id: string) { goals = goals.filter(x => x.id !== id); delGoalDB(id); renderGoals() }
function renderGoals() {
  const n = new Date(); const curYr = n.getFullYear()
  const ymStr = `${goalNavY}-${p2(goalNavM + 1)}`
  goals.forEach(g => { if (g.scope === 'year' && !g.yr) g.yr = curYr })
  const yearGoals = goals.filter(g => g.scope === 'year' && g.yr === goalNavYr)
  const monthGoals = goals.filter(g => g.scope === 'month' && g.ym === ymStr)
  const MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const yearTabLbl = gid('year-tab-lbl'); if (yearTabLbl) yearTabLbl.textContent = String(goalNavYr)
  const monthTabLbl = gid('month-tab-lbl'); if (monthTabLbl) monthTabLbl.textContent = MN[goalNavM].toUpperCase()
  const gcYear = gid('gc-year'); if (gcYear) gcYear.textContent = `${yearGoals.filter(g => g.done).length}/${yearGoals.length}`
  const gcMonth = gid('gc-month'); if (gcMonth) gcMonth.textContent = `${monthGoals.filter(g => g.done).length}/${monthGoals.length}`
  const gnavLbl = gid('gnav-lbl'); if (gnavLbl) gnavLbl.textContent = goalTab === 'year' ? String(goalNavYr) : `${MN[goalNavM]} ${goalNavY}`
  const list = goalTab === 'year' ? yearGoals : monthGoals
  const doneN = list.filter(g => g.done).length
  const pct = list.length ? Math.round(doneN / list.length * 100) : 0
  const gpFill = gid('gp-fill'); if (gpFill) gpFill.style.width = pct + '%'
  const gpPct = gid('gp-pct'); if (gpPct) gpPct.textContent = pct + '%'
  const wrap = gid('goals-list')
  if (!wrap) return
  if (!list.length) { wrap.innerHTML = `<div class="goals-empty">Belum ada goal di ${goalTab === 'year' ? goalNavYr : MN[goalNavM] + ' ' + goalNavY}. Tambah di bawah.</div>`; return }
  const sorted = [...list].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))
  wrap.innerHTML = sorted.map(g => `
    <div class="gitem${g.done ? ' done' : ''}" onclick="toggleGoal('${g.id}')">
      <div class="gcb"></div>
      <div style="flex:1">
        <div class="gtxt">${g.text}</div>
        ${g.done && g.doneDate ? `<span class="gdate">✓ ${fmtShort(g.doneDate)}</span>` : ''}
      </div>
      <button class="gdel" onclick="event.stopPropagation();delGoal('${g.id}')">✕</button>
    </div>`).join('')
}

// ── LESSONS MODAL ──
function openLessonsModal() {
  const yr = new Date().getFullYear()
  const yrLessons = [...lessons].filter(l => l.date.startsWith(yr + '-')).sort((a, b) => b.date.localeCompare(a.date))
  const totalItems = yrLessons.reduce((s, l) => s + (l.items ? l.items.length : 1), 0)
  const countEl = gid('lmo-count'); if (countEl) countEl.textContent = totalItems + ' pelajaran'
  const body = gid('lmo-body')
  if (!body) return
  if (!yrLessons.length) { body.innerHTML = '<div class="empty-note" style="padding:30px;">Belum ada pelajaran terkunci tahun ini.</div>' }
  else {
    const fmt = (d: string) => { const dt = new Date(d + 'T00:00:00'); const m = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']; const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']; return days[dt.getDay()] + ', ' + dt.getDate() + ' ' + m[dt.getMonth()] + ' ' + dt.getFullYear() }
    const esc = (s: string) => (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
    const fmtTs = (ts: string) => { try { const d = new Date(ts); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') } catch { return '' } }
    body.innerHTML = yrLessons.map(l => {
      const items = l.items || [{ text: l.text, ts: null }]
      return items.map((item: Any, i: number) => `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:3px solid #22c55e;border-radius:6px;padding:12px 14px 12px 14px;margin-bottom:10px;position:relative;"><div style="font-size:9px;letter-spacing:.1em;color:#15803d;font-weight:700;margin-bottom:5px;text-transform:uppercase;padding-right:48px;">🔒 ${fmt(l.date)}${items.length > 1 ? ' — Pelajaran ' + (i + 1) : ''}${item.ts ? ' (' + fmtTs(item.ts) + ')' : ''}</div><div style="font-size:12px;color:#14532d;line-height:1.6;font-style:italic;padding-right:48px;">${esc(item.text)}</div><div style="position:absolute;top:10px;right:10px;display:flex;gap:4px;"><button onclick="editLesson('${item.id}',this.closest('[data-text]')||this.parentNode.parentNode)" data-id="${item.id}" data-text="${esc(item.text)}" style="background:none;border:1px solid #bbf7d0;border-radius:4px;cursor:pointer;color:#15803d;font-size:11px;padding:2px 5px;transition:all .15s;" title="Edit" onmouseenter="this.style.background='#bbf7d0'" onmouseleave="this.style.background='none'">✏</button><button onclick="delLessonFromModal('${item.id}')" style="background:none;border:1px solid #bbf7d0;border-radius:4px;cursor:pointer;color:#dc2626;font-size:11px;padding:2px 5px;transition:all .15s;" title="Hapus" onmouseenter="this.style.background='#fee2e2'" onmouseleave="this.style.background='none'">✕</button></div></div>`).join('')
    }).join('')
  }
  gid('lmo')?.classList.add('open')
}
function closeLessonsModal() { gid('lmo')?.classList.remove('open') }

function editLesson(id: string, _el: Any) {
  editingLessonId = id
  const btn = document.querySelector(`button[data-id="${id}"]`)
  const text = btn ? btn.getAttribute('data-text') : ''
  const ta = gid<HTMLTextAreaElement>('lesson-edit-text'); if (ta) ta.value = text || ''
  gid('lesson-edit-modal')?.classList.add('open')
  setTimeout(() => gid<HTMLTextAreaElement>('lesson-edit-text')?.focus(), 100)
}
function closeLessonEditModal() { gid('lesson-edit-modal')?.classList.remove('open') }
async function confirmLessonEdit() {
  const text = (gid<HTMLTextAreaElement>('lesson-edit-text')?.value || '').trim()
  if (!text || !editingLessonId) return
  try {
    await api('/api/lesson-items?id=' + editingLessonId, 'PATCH', { text })
    lessons.forEach(l => { if (l.items) { const item = l.items.find((i: Any) => i.id === editingLessonId); if (item) item.text = text } })
    closeLessonEditModal()
    openLessonsModal()
    render()
  } catch (e) { alert('Gagal: ' + (e as Error).message) }
}

// ── GOALS MODAL ──
function openGoalsModal() {
  const yr = new Date().getFullYear(); const m = new Date().getMonth(); const ymStr = `${yr}-${p2(m + 1)}`
  const yearOpen = goals.filter(g => g.scope === 'year' && g.yr === yr && !g.done)
  const monthOpen = goals.filter(g => g.scope === 'month' && g.ym === ymStr && !g.done)
  const countEl = gid('gmo-count'); if (countEl) countEl.textContent = (yearOpen.length + monthOpen.length) + ' belum tercapai'
  const esc = (s: string) => (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
  const MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const col = (title: string, sub: string, arr: Any[]) => {
    const items = arr.length ? arr.map(g => `<div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--red);border-radius:6px;padding:10px 12px;margin-bottom:8px;font-size:12px;color:var(--text);line-height:1.5;">• ${esc(g.text)}</div>`).join('') : `<div class="empty-note" style="padding:20px 8px;">Semua goals sudah tercapai 🎉</div>`
    return `<div><div style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--red);margin-bottom:4px;">${title}</div><div style="font-size:10px;color:var(--text3);margin-bottom:10px;">${sub} — <strong style="color:var(--text2);">${arr.length} open</strong></div>${items}</div>`
  }
  const body = gid('gmo-body')
  if (body) body.innerHTML = col('Tahun ' + yr, 'Goals tahunan', yearOpen) + col(MN[m].toUpperCase(), 'Goals bulan ini', monthOpen)
  gid('gmo')?.classList.add('open')
}
function closeGoalsModal() { gid('gmo')?.classList.remove('open') }

function closeAchieveWishModal() { gid('achieve-wish-modal')?.classList.remove('open') }

// ── Custom date picker buat lesson (popup native browser gak bisa di-tema) ──
let lessonDate = ''
const LDP_MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const LDP_DN = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
function LessonDatePicker() {
  const today = todayStr()
  const [value, setValue] = useState(today)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(today.slice(0, 7))
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { lessonDate = value }, [value])
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.lsn-dp')) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function openPop() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 248) })
    setView(value.slice(0, 7))
    setOpen(true)
  }

  const [vy, vm] = view.split('-').map(Number)
  const startDow = (new Date(vy, vm - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(vy, vm, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${vy}-${String(vm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  function nav(delta: number) { const dt = new Date(vy, vm - 1 + delta, 1); setView(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`) }
  function label(v: string) { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}` }

  return (
    <div className="lsn-dp" style={{ position: 'relative', marginTop: 5 }}>
      <button type="button" ref={btnRef} className="lsn-date-btn" onClick={() => (open ? setOpen(false) : openPop())}>
        <span>{label(value)}</span>
        <span className="lsn-date-ic">📅</span>
      </button>
      {open && pos && (
        <div className="lsn-date-pop" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 600 }}>
          <div className="ldp-nav">
            <button type="button" onClick={() => nav(-1)}>‹</button>
            <span>{LDP_MN[vm - 1]} {vy}</span>
            <button type="button" onClick={() => nav(1)}>›</button>
          </div>
          <div className="ldp-grid">
            {LDP_DN.map(n => <div key={n} className="ldp-dn">{n}</div>)}
            {cells.map((c, i) => c === null
              ? <div key={'e' + i} />
              : <div key={c} className={'ldp-day' + (c === value ? ' sel' : '') + (c === today ? ' today' : '')} onClick={() => { setValue(c); setOpen(false) }}>{Number(c.split('-')[2])}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}

const WINDOW_FNS = [
  'openEditActCatModal', 'addActivity', 'delActivity', 'openAddActCatModal',
  'selectWishCat', 'selectGoalCat', 'selectLearningCat', 'selectDoingCat',
  'closeGenericModal', 'submitAddActCat', 'submitEditActCat',
  'filterCat', 'openEditCatModal', 'openAddCatModal', 'submitEditCat', 'submitAddCat',
  'delWish', 'openAchieveWish', 'cancelAchieveWish',
  'toggleTodo', 'delTodo', 'openLogDate', 'toggleRow',
  'editLesson', 'delLessonFromModal', 'toggleGoal', 'delGoal',
] as const

export default function GstPage() {
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const w = window as unknown as Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fns: Record<string, Any> = {
      openEditActCatModal, addActivity, delActivity, openAddActCatModal,
      selectWishCat, selectGoalCat, selectLearningCat, selectDoingCat,
      closeGenericModal, submitAddActCat, submitEditActCat,
      filterCat, openEditCatModal, openAddCatModal, submitEditCat, submitAddCat,
      delWish, openAchieveWish, cancelAchieveWish,
      toggleTodo, delTodo, openLogDate, toggleRow,
      editLesson, delLessonFromModal, toggleGoal, delGoal,
    }
    WINDOW_FNS.forEach(fn => { w[fn] = fns[fn] })
    init()
    const sugBox = document.getElementById('lta-cat-sug')
    const onSug = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest('.cat-sug-row') as HTMLElement | null
      if (!row) return
      e.preventDefault()
      const inp = document.getElementById('lta-cat') as HTMLInputElement | null
      if (inp) inp.value = row.dataset.cat || ''
      hideCatSug()
    }
    sugBox?.addEventListener('mousedown', onSug)
    const onDocDown = (e: MouseEvent) => {
      const tg = e.target as HTMLElement
      if (tg.closest('#lta-cat') || tg.closest('#lta-cat-sug')) return
      hideCatSug()
    }
    document.addEventListener('mousedown', onDocDown)
    return () => {
      sugBox?.removeEventListener('mousedown', onSug)
      document.removeEventListener('mousedown', onDocDown)
      if (chartBarInstance) { chartBarInstance.destroy(); chartBarInstance = null }
      if (chartLineInstance) { chartLineInstance.destroy(); chartLineInstance = null }
      if (chartTotalInstance) { chartTotalInstance.destroy(); chartTotalInstance = null }
      if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
      if (quoteTimer) { clearInterval(quoteTimer); quoteTimer = null }
      if (tokenRefreshTimer) { clearInterval(tokenRefreshTimer); tokenRefreshTimer = null }
      WINDOW_FNS.forEach(fn => delete w[fn])
    }
  }, [])

  return (
    <DashboardShell title="GST">
      <style>{`
        :root{
          --bg:#0b0c10;--bg2:#1c1e27;--white:#15161c;
          --border:rgba(255,255,255,.08);--border2:rgba(255,255,255,.16);
          --text:#eef0f5;--text2:#97a0b3;--text3:#687087;--text4:rgba(255,255,255,.14);
          --blk:#eef0f5;
          --red:#3e6df0;--red2:#2f56d1;--red-bg:rgba(62,109,240,.14);--red-border:rgba(62,109,240,.35);
          --green:#34d399;--green-bg:rgba(52,211,153,.12);--green-border:rgba(52,211,153,.3);
          --gold:#f0b429;--gold-bg:rgba(240,180,41,.12);--gold-border:rgba(240,180,41,.3);
          --blue:#60a5fa;--blue-bg:rgba(96,165,250,.12);
          --r:10px;--r2:7px;
          --s1:0 1px 3px rgba(0,0,0,.4);--s2:0 6px 20px rgba(0,0,0,.45);--s3:0 10px 36px rgba(0,0,0,.55);--sb:0 2px 8px rgba(0,0,0,.30),0 3px 11px rgba(62,109,240,.22);
        }
        .cnav-btn,.now-btn,.gnav-btn,.gnav-now,.todo-addbtn,.goal-addbtn,.cchip,.sbtn,.rchip,.lock-btn,.btn-cancel,.btn-save,.scopt,.vtab{transition:all .18s cubic-bezier(.4,0,.2,1);}
        .cnav-btn:active,.now-btn:active,.gnav-btn:active,.gnav-now:active,.todo-addbtn:active,.goal-addbtn:active{transform:scale(.92);}
        .btn-save:active{transform:translateY(1px);}
        .titem,.gitem,.lsn-item,.drow{transition:all .2s cubic-bezier(.4,0,.2,1);}
        .titem:hover,.gitem:hover{transform:translateX(2px);}
        .sbox{transition:all .18s ease;}
        .sbox:hover{border-color:var(--border2);transform:translateY(-1px);box-shadow:var(--s1);}
        .tag{transition:transform .15s ease;}
        .tag:hover{transform:scale(1.05);}


        .gst-app{display:grid;grid-template-columns:342px 1fr 318px;height:calc(100vh - 52px);overflow:hidden;}
        .lp{background:var(--bg);display:flex;flex-direction:column;overflow:hidden;min-height:0;padding:16px;gap:16px;}

        .cal-wrap{padding:12px 14px;flex-shrink:0;background:var(--white);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--sb);}
        .sec-lbl{font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;}
        .cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
        .cal-mnth{font-size:12px;font-weight:700;color:var(--text);}
        .cnav-btn{background:none;border:1px solid var(--border);width:22px;height:22px;border-radius:var(--r2);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:11px;}
        .cnav-btn:hover{border-color:var(--red);color:var(--red);}

        .target-quote{margin-top:8px;font-size:10px;font-style:italic;line-height:1.55;color:var(--text2);cursor:pointer;padding:6px 0 2px;border-top:1px dashed var(--border);transition:color .2s;}
        .target-quote:hover{color:var(--red);}
        .target-quote .tq-by{display:block;font-style:normal;font-size:9px;letter-spacing:.06em;color:var(--text3);margin-top:3px;text-transform:uppercase;}
        .target-quote .tq-by:empty{display:none;}
        .goals-wrap{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--white);border:1px solid var(--border);border-radius:10px;box-shadow:var(--sb);overflow:hidden;}
        .goals-tabs{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--white);}
        .gtab{flex:1;background:none;border:none;padding:9px 10px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;gap:2px;border-bottom:2px solid transparent;transition:all .15s;}
        .gtab:hover{background:var(--bg);}
        .gtab.active{border-bottom-color:var(--red);background:var(--white);}
        .gtab.active .gtab-lbl{color:var(--red);}
        .gtab-lbl{font-size:9px;font-weight:700;letter-spacing:.1em;color:var(--text2);}
        .gtab-count{font-size:8px;color:var(--text3);font-weight:500;}
        .goals-nav{display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--border);background:var(--white);flex-shrink:0;}
        .gnav-btn{background:none;border:1px solid var(--border);width:22px;height:22px;border-radius:var(--r2);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:11px;flex-shrink:0;}
        .gnav-btn:hover{border-color:var(--red);color:var(--red);}
        .gnav-lbl{flex:1;text-align:center;font-size:10px;font-weight:700;color:var(--text);letter-spacing:.05em;}
        .gnav-now{background:none;border:1px solid var(--border);padding:0 7px;height:22px;border-radius:var(--r2);font-size:8px;font-weight:600;letter-spacing:.06em;cursor:pointer;color:var(--text2);flex-shrink:0;}
        .gnav-now:hover{border-color:var(--red);color:var(--red);}
        .goals-progress{padding:8px 14px 6px;display:flex;align-items:center;gap:8px;flex-shrink:0;}
        .gp-bar{flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;}
        .gp-fill{height:100%;background:linear-gradient(90deg,var(--red),#e85d5d);transition:width .35s cubic-bezier(.4,0,.2,1);width:0%;}
        .gp-pct{font-size:9px;font-weight:700;color:var(--text);min-width:28px;text-align:right;}
        .goals-list{flex:1;overflow-y:auto;padding:4px 10px 8px;display:flex;flex-direction:column;gap:4px;}
        .goals-list::-webkit-scrollbar{width:3px;}
        .goals-list::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
        .gitem{display:flex;align-items:flex-start;gap:8px;padding:7px 9px;background:var(--white);border:1px solid var(--border);border-radius:var(--r2);cursor:pointer;position:relative;}
        .gitem:hover{border-color:var(--red-border);background:var(--red-bg);}
        .gitem.done{background:var(--green-bg);border-color:var(--green-border);}
        .gitem.done:hover{background:var(--green-bg);}
        .gcb{width:14px;height:14px;border:2px solid var(--red);border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--red-bg);transition:all .18s;margin-top:1px;}
        .gitem.done .gcb{background:var(--green);border-color:var(--green);}
        .gitem.done .gcb::after{content:'✓';color:#fff;font-size:9px;font-weight:700;}
        .gtxt{font-size:11px;color:var(--text);line-height:1.45;flex:1;font-weight:500;}
        .gitem.done .gtxt{text-decoration:line-through;color:var(--text3);font-weight:400;}
        .gdate{font-size:7.5px;color:var(--green);font-weight:600;letter-spacing:.05em;margin-top:2px;display:block;}
        .gdel{background:none;border:none;color:var(--text4);cursor:pointer;font-size:11px;padding:0 2px;transition:color .15s;flex-shrink:0;opacity:0;}
        .gitem:hover .gdel{opacity:1;}
        .gdel:hover{color:var(--red);}
        .goal-add{display:flex;gap:5px;padding:7px 10px 10px;border-top:1px solid var(--border);background:var(--white);flex-shrink:0;}
        .goal-inp{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:6px 9px;font-size:10.5px;color:var(--text);outline:none;transition:border-color .15s;}
        .goal-inp:focus{border-color:var(--red);}
        .goal-inp::placeholder{color:var(--text4);}
        .goal-addbtn{background:var(--red);color:#fff;border:none;border-radius:var(--r2);width:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;font-weight:300;flex-shrink:0;}
        .goal-addbtn:hover{background:var(--red2);}
        .goals-empty{text-align:center;padding:22px 12px;color:var(--text2);font-size:12px;line-height:1.6;}

        .tag.tg{background:#fef2f8;color:#be185d;border:1px solid #fbcfe8;}
        .dgoal-card{background:var(--gold-bg);border:1px solid var(--gold-border);border-radius:var(--r2);padding:10px 12px;margin-top:6px;}
        .dgoal-lbl{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:5px;}
        .dgoal-row{display:flex;align-items:flex-start;gap:6px;font-size:11px;color:var(--text);line-height:1.5;padding:2px 0;}
        .dgoal-row::before{content:'✓';color:var(--green);font-weight:700;flex-shrink:0;}
        .dgoal-scope{font-size:7.5px;color:var(--text3);background:var(--bg2);padding:1px 5px;border-radius:8px;font-weight:600;flex-shrink:0;}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;}
        .cdname{text-align:center;font-size:8px;font-weight:600;color:var(--text4);letter-spacing:.05em;padding:2px 0 3px;}
        .cday{text-align:center;font-size:11px;padding:2px 1px;border-radius:var(--r2);cursor:pointer;transition:all .12s;color:var(--text2);line-height:1.2;position:relative;}
        .cday:hover{background:var(--bg);}
        .cday.othermon{color:var(--text4);}
        .cday.hasdata{font-weight:600;color:var(--text);}
        .cday.hasdata::after{content:'';display:block;width:4px;height:4px;border-radius:50%;background:var(--red);margin:1px auto 0;}
        .cday.haslesson::after{background:var(--gold)!important;}
        .cday.todaycal{background:var(--red);color:#fff;font-weight:700;}
        .cday.todaycal::after{background:#fff!important;}
        .cday.selweek{background:rgba(62,109,240,.30);color:#fff;}
        .cday.selweek::after{background:#fff!important;}

        .stats-wrap{padding:14px 16px;flex-shrink:0;background:var(--white);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--sb);}
        .stats-wrap .sec-lbl{color:var(--text);font-size:11px;font-weight:700;letter-spacing:.12em;}
        .sval.left-val{color:var(--text);}
        .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}
        .sbox{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:9px 10px 7px;}
        .sval{font-size:19px;font-weight:700;color:var(--text);line-height:1;}
        .sval.red{color:var(--red);}
        .sval.gold{color:var(--gold);}
        .slbl{font-size:9px;font-weight:500;color:var(--text3);margin-top:2px;}

        .wknav{padding:10px 18px 8px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;}
        .wknav-lbl{font-size:9px;font-weight:600;letter-spacing:.08em;color:var(--text);}
        .wk-btns{display:flex;gap:4px;}
        .now-btn{background:none;border:1px solid var(--border);padding:0 8px;height:26px;border-radius:var(--r2);font-size:8px;font-weight:600;letter-spacing:.08em;cursor:pointer;color:var(--text2);}
        .now-btn:hover{border-color:var(--red);color:var(--red);}

        #center-panel{display:flex;flex-direction:column;overflow:hidden;background:var(--white);border:1px solid var(--border);border-radius:10px;box-shadow:var(--s1);margin:12px 0;}
        .cp{overflow-y:auto;background:var(--white);padding:14px 18px;flex:1;}
        .cp::-webkit-scrollbar{width:4px;}
        .cp::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}

        .wk-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
        .wk-range{font-size:14px;font-weight:700;color:var(--text);}
        .wk-badge{font-size:8px;padding:3px 10px;border-radius:20px;background:var(--red-bg);color:var(--red);border:1px solid var(--red-border);font-weight:600;letter-spacing:.06em;}
        .wk-sumbar{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;}
        .wsb{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--text3);background:var(--white);border:1px solid var(--border);padding:4px 9px;border-radius:20px;}
        .wdot{width:6px;height:6px;border-radius:50%;}

        .view-toggle{display:flex;gap:0;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--white);border-top-left-radius:10px;border-top-right-radius:10px;overflow:hidden;}
        .vtab{flex:1;padding:9px 0;text-align:center;font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);cursor:pointer;border-bottom:2px solid transparent;background:none;border-left:none;border-right:none;border-top:none;}
        .vtab:hover{color:var(--text);}
        .vtab.active{color:var(--red);border-bottom-color:var(--red);}

        .chart-panel{display:none;overflow-y:auto;background:var(--white);padding:18px 22px;flex:1;}
        .chart-section{background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:20px 22px;margin-bottom:16px;box-shadow:var(--s1);}
        .chart-title{font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;}
        .chart-sub{font-size:9px;color:var(--text3);letter-spacing:.06em;margin-bottom:14px;}
        .chart-wrap{position:relative;width:100%;overflow-x:auto;}
        .chart-wrap canvas{min-width:600px;}

        .chart-range-bar{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap;}
        .rchip{font-size:9px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid var(--border);cursor:pointer;background:var(--bg);color:var(--text2);letter-spacing:.04em;}
        .rchip.active{background:var(--red);color:#fff;border-color:var(--red);}
        .rchip:not(.active):hover{border-color:var(--red);color:var(--red);}

        .chart-legend{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;}
        .cl-item{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);font-weight:500;cursor:pointer;user-select:none;transition:opacity .2s;}
        .cl-item:hover{opacity:.7;}
        .cl-item.off{opacity:.3;}
        .cl-item.off .cl-dot{filter:grayscale(1);}
        .cl-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0;}

        .drow{background:var(--white);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden;box-shadow:var(--s1);}
        .drow:hover{box-shadow:var(--s2);}
        .drow.todayrow{border-color:var(--red);border-width:1.5px;}
        .drow-hdr{display:flex;align-items:center;padding:13px 16px;cursor:pointer;gap:10px;transition:background .1s;user-select:none;}
        .drow-hdr:hover{background:var(--bg);}
        .dnb{min-width:72px;flex-shrink:0;}
        .dname{font-size:12px;font-weight:700;color:var(--text);}
        .ddate{font-size:9px;color:var(--text3);letter-spacing:.05em;}
        .drow.todayrow .dname{color:var(--red);}
        .drow.todayrow .ddate{color:var(--red);}
        .dtags{display:flex;flex-wrap:wrap;gap:4px;flex:1;min-width:0;}
        .tag{font-size:9px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap;letter-spacing:.02em;}
        .tw{background:#eff6ff;color:#2563eb;}
        .tm{background:#f0fdf4;color:#15a34a;}
        .tr{background:#fffbf0;color:#b45309;}
        .tp{background:var(--red-bg);color:var(--red);}
        .ts{background:#f5f3ff;color:#7c3aed;}
        .te{background:var(--bg);color:var(--text4);font-style:italic;font-weight:400;}
        .tdone-tag{background:var(--green-bg);color:var(--green);}
        .dpips{display:flex;gap:2px;flex-shrink:0;}
        .pip{width:5px;height:5px;border-radius:1px;background:var(--border);}
        .pip.on{background:var(--red);}
        .dlsn-dot{width:7px;height:7px;border-radius:50%;background:var(--red);flex-shrink:0;}
        .dchev{font-size:10px;color:var(--text4);transition:transform .2s;flex-shrink:0;}
        .drow.open .dchev{transform:rotate(180deg);}

        .ddetail{display:none;border-top:1px solid var(--border);padding:14px;background:var(--white);}
        .drow.open .ddetail{display:block;}
        .ddet-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
        .dcard{background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:9px 11px;}
        .dcard-lbl{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);font-weight:600;margin-bottom:3px;}
        .dcard-val{font-size:11px;color:var(--text);line-height:1.5;font-weight:500;}
        .dcard-val.empty{color:var(--text4);font-style:italic;font-weight:400;}
        .dlesn-card{background:var(--red-bg);border:1px solid var(--red-border);border-radius:var(--r2);padding:10px 12px;margin-top:4px;}
        .dlesn-lbl{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--red);font-weight:600;margin-bottom:4px;}
        .dlesn-txt{font-size:11px;color:var(--text2);line-height:1.6;font-style:italic;}
        .add-chain-btn{width:100%;background:none;border:1.5px dashed var(--border2);border-radius:var(--r2);padding:8px;color:var(--text3);font-size:10px;cursor:pointer;text-align:center;margin-top:8px;}
        .add-chain-btn:hover{border-color:var(--red);color:var(--red);background:var(--red-bg);}
        .edit-entry-btn{background:none;border:1px solid var(--border2);border-radius:var(--r2);padding:5px 12px;color:var(--text3);font-size:10px;cursor:pointer;margin-top:8px;}
        .edit-entry-btn:hover{border-color:var(--red);color:var(--red);background:var(--red-bg);}
        .done-in-chain{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--green);padding:2px 0;font-weight:500;}
        .done-in-chain::before{content:'✓';font-weight:700;}

        .rp{background:var(--bg);display:flex;flex-direction:column;overflow:hidden;padding:16px;gap:16px;}

        .lsn-sec{flex:0 0 auto;display:flex;flex-direction:column;background:var(--white);border:1px solid var(--border);border-radius:10px;box-shadow:var(--sb);overflow:visible;}
        .ph{padding:11px 18px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;gap:8px;}
        .ph-title{font-size:12px;font-weight:700;color:var(--text);}
        .lsn-input-area{padding:11px 16px;border-bottom:1px solid var(--border);flex-shrink:0;}
        .lsn-ta{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:7px 9px;font-size:11.5px;color:#fff;resize:none;min-height:58px;outline:none;line-height:1.5;transition:border-color .15s;}
        .lsn-ta:focus{border-color:var(--gold);}
        .lsn-ta::placeholder{color:var(--text3);}
        .lsn-cat-inp{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:6px 9px;font-size:10.5px;color:#fff;outline:none;transition:border-color .15s;}
        .lsn-cat-inp:focus{border-color:var(--gold);}
        .lsn-cat-inp::placeholder{color:var(--text3);}
        .cat-inp-wrap{position:relative;margin-top:5px;}
        .cat-sug{display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:60;max-height:208px;overflow-y:auto;background:var(--white);border:1px solid var(--border2);border-radius:9px;box-shadow:var(--s3);padding:4px;}
        .cat-sug-row{display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:6px;font-size:11px;font-weight:500;color:var(--text2);cursor:pointer;transition:background .12s,color .12s;}
        .cat-sug-row:hover{background:var(--gold-bg);color:var(--text);}
        .cat-sug-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);flex-shrink:0;}
        .lsn-date-btn{width:100%;display:flex;align-items:center;justify-content:space-between;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:7px 10px;font-size:11px;color:var(--text);cursor:pointer;margin-top:5px;transition:border-color .15s;font-family:inherit;}
        .lsn-date-btn:hover{border-color:var(--red-border);}
        .lsn-date-ic{font-size:12px;opacity:.65;}
        .lsn-date-pop{background:var(--white);border:1px solid var(--border2);border-radius:16px;box-shadow:var(--s3);padding:11px;width:236px;}
        .ldp-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;padding:0 2px;}
        .ldp-nav span{font-size:11px;font-weight:700;color:var(--text);}
        .ldp-nav button{width:24px;height:24px;border:1px solid var(--border);background:var(--bg);border-radius:8px;color:var(--text2);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
        .ldp-nav button:hover{border-color:var(--red);color:var(--red);}
        .ldp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
        .ldp-dn{text-align:center;font-size:8px;font-weight:600;color:var(--text4);padding:2px 0 3px;}
        .ldp-day{text-align:center;font-size:11px;padding:6px 0;border-radius:9px;cursor:pointer;color:var(--text2);transition:all .12s;}
        .ldp-day:hover{background:var(--bg);color:var(--text);}
        .ldp-day.today{color:var(--red);font-weight:700;}
        .ldp-day.sel{background:var(--red);color:#fff;font-weight:700;}
        .lsn-cat-tag{display:inline-flex;align-items:center;font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:10px;background:var(--gold-bg);color:var(--gold);border:1px solid var(--gold-border);margin-right:4px;}
        .lock-btn{margin-top:6px;width:100%;background:var(--gold-bg);border:1px solid var(--gold-border);color:var(--gold);border-radius:var(--r2);padding:6px;font-size:10px;font-weight:600;letter-spacing:.02em;cursor:pointer;}
        .lock-btn:hover{filter:brightness(.9);}
        .lsn-list{overflow-y:auto;padding:10px 16px;max-height:200px;display:flex;flex-direction:column;gap:7px;}
        .empty-note{text-align:center;padding:24px 16px;color:var(--text2);font-size:12px;line-height:1.6;}

        .todo-sec{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--white);border:1px solid var(--border);border-radius:10px;box-shadow:var(--sb);}
        .mode-bar{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;}
        .mbtn{flex:1;padding:8px 10px;border:none;background:none;font-size:10px;font-weight:600;color:var(--text3);cursor:pointer;border-bottom:2px solid transparent;display:flex;align-items:center;justify-content:center;gap:5px;}
        .mbtn:hover{color:var(--text);background:var(--bg);}
        .mbtn.active{color:var(--red);border-bottom-color:var(--red);}
        .mbtn-doing.active{color:var(--red);border-bottom-color:var(--red);}
        .mbtn-learning.active{color:var(--red);border-bottom-color:var(--red);}
        .mbtn .mct{font-size:8px;font-weight:700;padding:1px 5px;border-radius:8px;background:var(--bg);color:var(--text3);}
        .mbtn.active .mct{background:rgba(255,255,255,.08);}
        .cat-bar{padding:6px 16px;border-bottom:1px solid var(--border);display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0;align-items:center;}
        .cchip{font-size:9px;font-weight:600;padding:3px 9px;border-radius:20px;border:1px solid var(--border);cursor:pointer;background:var(--bg);color:var(--text);letter-spacing:.02em;}
        .cchip.active{background:var(--red);color:#fff;border-color:var(--red);}
        .cchip:not(.active):hover{border-color:var(--red-border);color:var(--red);}
        .cchip-add{font-size:13px;font-weight:400;padding:1px 7px;border-radius:20px;border:1px dashed var(--border2);cursor:pointer;background:none;color:var(--text3);line-height:1.5;}
        .cchip-add:hover{border-color:var(--text2);color:var(--text);}
        .cchip-edit{display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.3);color:#fff;font-size:8px;margin-left:3px;vertical-align:middle;cursor:pointer;font-weight:700;line-height:1;}
        .cchip-edit:hover{background:rgba(255,255,255,.5);}
        .cat-hint{padding:3px 16px 5px;font-size:10px;color:var(--text3);display:none;align-items:center;gap:4px;flex-wrap:wrap;}
        .cat-hint.show{display:flex;}

        .status-bar{display:flex;gap:6px;padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg2);}
        .sbtn{display:flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border);background:var(--white);border-radius:20px;cursor:pointer;font-size:10px;font-weight:600;color:var(--text2);}
        .sbtn .sct{font-size:9px;font-weight:700;background:var(--bg);color:var(--text2);padding:1px 6px;border-radius:10px;min-width:18px;text-align:center;}
        .sdot-st{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .sdot-red{background:var(--red);box-shadow:0 0 0 2px rgba(209,43,43,.15);}
        .sdot-green{background:var(--red);box-shadow:0 0 0 2px rgba(62,109,240,.15);}
        .sbtn-todo.active{background:var(--red);border-color:var(--red);color:#fff;}
        .sbtn-todo.active .sct{background:rgba(255,255,255,.25);color:#fff;}
        .sbtn-todo.active .sdot-red{background:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.3);}
        .sbtn-done.active{background:var(--red);border-color:var(--red);color:#fff;}
        .sbtn-done.active .sct{background:rgba(255,255,255,.25);color:#fff;}
        .sbtn-done.active .sdot-green{background:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.3);}
        .sbtn:not(.active):hover{border-color:var(--text2);}
        .todo-add{padding:10px 16px;border-bottom:1px solid var(--border);display:flex;gap:6px;flex-shrink:0;}
        .todo-inp{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:7px 10px;font-size:11px;color:var(--text);outline:none;transition:border-color .15s;}
        .todo-inp:focus{border-color:var(--red);}
        .todo-inp::placeholder{color:var(--text4);}
        .todo-addbtn{background:var(--red);color:#fff;border:none;border-radius:var(--r2);width:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:300;flex-shrink:0;}
        .todo-addbtn:hover{background:var(--red2);}
        .wish-compact-wrap{background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:13px 15px;flex-shrink:0;box-shadow:var(--sb);}
        .wish-compact-row{display:flex;gap:6px;}
        .wish-compact-inp{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:7px 10px;font-size:11.5px;color:#fff;outline:none;transition:border-color .15s;}
        .wish-compact-inp:focus{border-color:var(--red);}
        .wish-compact-inp::placeholder{color:var(--text3);}
        .wish-compact-btn{background:var(--red);color:#fff;border:none;border-radius:var(--r2);padding:7px 14px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;}
        .wish-compact-btn:hover{filter:brightness(.9);}
        .wish-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--r2);border:1px solid var(--border);background:var(--white);margin-bottom:8px;}
        .wish-item.wish-done{background:var(--gold-bg);border-color:var(--gold-border);opacity:.75;}
        .wish-cb-wrap{flex-shrink:0;padding-top:1px;}
        .wish-cb{width:18px;height:18px;border-radius:4px;border:2px solid var(--border2);cursor:pointer;flex-shrink:0;}
        .wish-cb:hover{border-color:var(--red);}
        .wish-cb.checked{background:var(--red);border-color:var(--red);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;}
        .wish-content{flex:1;min-width:0;}
        .wish-text{font-size:12px;color:var(--text);line-height:1.5;font-weight:500;}
        .wish-done .wish-text{text-decoration:line-through;color:var(--text3);}
        .wish-meta{font-size:10px;color:var(--red);margin-top:4px;line-height:1.5;font-style:italic;}
        .wish-del{background:none;border:none;color:var(--text4);cursor:pointer;font-size:12px;padding:2px 4px;flex-shrink:0;}
        .wish-del:hover{color:var(--red);}
        .todo-list{overflow-y:auto;overflow-x:hidden;padding:10px 14px;flex:1;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;scrollbar-color:var(--border2) transparent;}
        .todo-list::-webkit-scrollbar{width:3px;}
        .todo-list::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
        .titem{display:flex;align-items:flex-start;gap:10px;padding:11px 13px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);cursor:pointer;}
        .titem:hover{border-color:var(--red-border);background:var(--red-bg);}
        .titem.done{opacity:.55;background:var(--red-bg);border-color:var(--red-border);}
        .titem.done:hover{background:var(--red-bg);border-color:var(--red-border);}
        .tcb{width:15px;height:15px;border:2px solid var(--red);border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--red-bg);margin-top:1px;}
        .titem.done .tcb{background:var(--red);border-color:var(--red);}
        .titem.done .tcb::after{content:'✓';color:#fff;font-size:9px;font-weight:700;}
        .ttxt{font-size:11px;color:var(--text);line-height:1.5;flex:1;min-width:0;font-weight:400;overflow-wrap:anywhere;}
        .titem.done .ttxt{text-decoration:line-through;color:var(--text3);}
        .tcat{font-size:8px;padding:2px 6px;border-radius:10px;background:rgba(255,255,255,.05);color:var(--text2);border:1px solid var(--border);white-space:nowrap;align-self:flex-start;font-weight:500;}
        .tdone-badge{font-size:8px;padding:2px 6px;border-radius:10px;background:var(--red-bg);color:var(--red);border:1px solid var(--red-border);white-space:nowrap;align-self:flex-start;}
        .tdel{background:none;border:none;color:var(--text4);cursor:pointer;font-size:11px;padding:1px 3px;flex-shrink:0;}
        .tdel:hover{color:var(--red);}

        .moverlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;display:none;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);}
        .moverlay.open{display:flex;}
        .confirm-box{background:var(--white);border-radius:16px;border:1.5px solid var(--border);width:100%;max-width:360px;box-shadow:var(--s3);padding:32px 24px 22px;text-align:center;}
        .confirm-icon{font-size:40px;margin-bottom:12px;line-height:1;display:block;}
        .confirm-title{font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;letter-spacing:-.01em;}
        .confirm-desc{font-size:11.5px;color:var(--text2);line-height:1.65;margin-bottom:24px;}
        .confirm-btns{display:flex;gap:8px;}
        .confirm-btn-cancel{flex:1;padding:10px 14px;border:1.5px solid var(--border);background:var(--bg);color:var(--text2);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;}
        .confirm-btn-cancel:hover{border-color:var(--border2);color:var(--text);}
        .confirm-btn-ok{flex:1;padding:10px 14px;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;color:#fff;}
        .confirm-btn-ok:hover{filter:brightness(.88);}
        .modal{background:var(--white);border-radius:10px;border:1.5px solid var(--border);width:100%;max-width:510px;max-height:88vh;overflow-y:auto;box-shadow:var(--s3);}
        .modal::-webkit-scrollbar{width:4px;}
        .modal::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
        .mhdr{padding:14px 18px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .mtitle{font-size:13px;font-weight:700;color:var(--text);}
        .mdbadge{font-size:9px;color:var(--red);background:var(--red-bg);border:1px solid var(--red-border);padding:3px 10px;border-radius:20px;font-weight:600;letter-spacing:.05em;}
        .mclose{background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;}
        .mclose:hover{color:var(--red);background:var(--red-bg);}
        .mbody{padding:14px 18px;}
        .fsec{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text);font-weight:800;margin:16px 0 10px;padding-top:14px;border-top:1px solid var(--border);}
        .fsec:first-child{margin-top:0;padding-top:0;border-top:none;}
        .finp,.fsel,.fta,.mini-inp,.mini-sel{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:7px 9px;font-size:12px;color:var(--text);outline:none;transition:border-color .15s;box-sizing:border-box;}
        .finp:focus,.fsel:focus,.fta:focus,.mini-inp:focus{border-color:var(--red);}
        .fta{resize:vertical;min-height:65px;line-height:1.5;}
        .mlbl-f{font-size:10px;font-weight:600;color:var(--text2);display:block;margin-bottom:3px;margin-top:10px;}
        .mlbl-f:first-child{margin-top:0;}
        .mfooter{padding:12px 18px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border);}
        .btn-cancel{background:none;border:1px solid var(--border);color:var(--text2);padding:8px 18px;border-radius:var(--r2);font-size:12px;cursor:pointer;font-weight:500;}
        .btn-cancel:hover{border-color:var(--text2);}
        .btn-primary{background:var(--red);color:#fff;border:none;padding:8px 18px;border-radius:var(--r2);font-size:12px;font-weight:600;cursor:pointer;}
        .btn-primary:hover{background:var(--red2);}
        .btn-save{background:var(--red);border:none;color:#fff;padding:8px 22px;border-radius:var(--r2);font-size:12px;font-weight:700;cursor:pointer;}
        .btn-save:hover{filter:brightness(.9);}
        .btn-save:disabled{opacity:.4;cursor:not-allowed;}

        .act-input-row{display:flex;gap:6px;margin-bottom:6px;}
        .act-add-btn{background:var(--red);color:#fff;border:none;border-radius:var(--r2);padding:0 14px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;}
        .act-add-btn:hover{filter:brightness(.9);}
        .act-add-btn:disabled{background:var(--border2);cursor:not-allowed;}
        .act-list{margin-bottom:6px;display:flex;flex-direction:column;gap:3px;}
        .act-item{display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:6px 10px;font-size:11px;color:var(--text);}
        .act-item-text{flex:1;line-height:1.4;}
        .act-del{background:none;border:none;color:var(--text4);cursor:pointer;font-size:12px;padding:0 2px;flex-shrink:0;}
        .act-del:hover{color:var(--red);}
        .act-count{font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.06em;margin-bottom:10px;text-transform:uppercase;}

        @media(max-width:1024px){
          .gst-app{grid-template-columns:1fr;height:auto;overflow:visible;}
          .lp,.rp{overflow:visible;}
        }
        @media(max-width:768px){
          .gst-app{display:flex;flex-direction:column;height:auto;overflow:visible;padding:8px;gap:10px;}
          .lp{border-radius:10px;border:1px solid var(--border);min-height:auto;overflow:visible;}
          .stat-grid{grid-template-columns:repeat(2,1fr)!important;}
          .cday{padding:8px 2px;font-size:13px;}
          #center-panel{margin:0;border-radius:10px;min-height:60vh;}
          .cp{overflow-y:visible;height:auto;min-height:400px;}
          .chart-panel{height:auto;}
          .chart-wrap canvas{min-width:0;width:100%!important;}
          .rp{border-radius:10px;border:1px solid var(--border);overflow:visible;}
          .lsn-list{max-height:none;}
          .titem{padding:12px 14px;}
          .gitem{padding:10px 12px;}
          .gcb{width:18px;height:18px;}
          .todo-inp,.goal-inp,.lsn-ta,.finp,.fsel,.fta{font-size:16px;}
          .lsn-ta{min-height:80px;}
          .lock-btn,.todo-addbtn,.goal-addbtn{min-height:38px;}
          .btn-save,.btn-cancel{padding:11px 22px;font-size:13px;}
          .cnav-btn{width:34px;height:34px;}
          .sbtn{padding:6px 12px;font-size:11px;}
          .cchip{padding:5px 12px;font-size:11px;}
          .moverlay{padding:0;align-items:flex-end;}
          .modal{border-radius:16px 16px 0 0;max-height:92vh;max-width:100%;border-bottom:none;}
        }
      `}</style>

      <div className="gst-app">
        <div className="lp">
          <div className="stats-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="sec-lbl" style={{ fontSize: 14, marginBottom: 0 }}>Overview</div>
              <canvas id="analog-clock" width={34} height={34} style={{ borderRadius: '50%', flexShrink: 0, boxShadow: '0 1px 5px rgba(0,0,0,.18)' }}></canvas>
            </div>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="sbox"><div className="sval" id="st0">—</div><div className="slbl">Hari</div></div>
              <div className="sbox" style={{ cursor: 'pointer' }} onClick={openWishesModal} title="Lihat semua dream lo"><div className="sval red" id="st1">—</div><div className="slbl">Dream</div></div>
              <div className="sbox" style={{ cursor: 'pointer' }} onClick={openLessonsModal} title="Lihat semua pelajaran tahun ini"><div className="sval gold" id="st2">—</div><div className="slbl">Lesson</div></div>
              <div className="sbox" style={{ cursor: 'pointer' }} onClick={openGoalsModal} title="Lihat goals yang belum tercapai"><div className="sval left-val" id="st5">—</div><div className="slbl">Left</div></div>
            </div>
          </div>

          <div className="cal-wrap">
            <div className="sec-lbl" style={{ fontSize: 14, color: 'var(--blk)' }}>DATE</div>
            <div className="cal-nav">
              <button className="cnav-btn" onClick={cPrev}>‹</button>
              <div className="cal-mnth" id="calmnth">—</div>
              <button className="cnav-btn" onClick={cNext}>›</button>
            </div>
            <div className="cal-grid" id="calgrid">
              <div className="cdname">Sen</div><div className="cdname">Sel</div><div className="cdname">Rab</div>
              <div className="cdname">Kam</div><div className="cdname">Jum</div><div className="cdname">Sab</div><div className="cdname">Min</div>
            </div>
          </div>

          <div className="wknav" style={{ display: 'none' }}>
            <div className="wknav-lbl" id="wknav-lbl">WEEK —</div>
            <div className="wk-btns">
              <button className="cnav-btn" onClick={wkPrev}>‹</button>
              <button className="now-btn" onClick={wkNow}>NOW</button>
              <button className="cnav-btn" onClick={wkNext}>›</button>
            </div>
          </div>

          <div className="wish-compact-wrap">
            <div className="sec-lbl" style={{ fontSize: 14, color: 'var(--blk)', marginBottom: 8 }}>Make your wish</div>
            <div className="wish-compact-row">
              <input type="text" className="wish-compact-inp" id="wish-inp" placeholder="Whats really u want?" onKeyDown={e => { if (e.key === 'Enter') addWish() }} />
              <button className="wish-compact-btn" onClick={addWish}>Make it</button>
            </div>
          </div>

          <div className="goals-wrap">
            <div style={{ padding: '12px 14px 4px' }}>
              <div className="sec-lbl" style={{ fontSize: 14, color: 'var(--blk)' }}>Target</div>
              <div className="target-quote" id="target-quote" onClick={rotateQuote} title="Klik untuk quote berikutnya">&ldquo;<span id="tq-text">—</span>&rdquo; <span className="tq-by" id="tq-by"></span></div>
            </div>
            <div className="goals-tabs">
              <button className="gtab active" data-tab="year" onClick={() => switchGoalTab('year')}><span className="gtab-lbl" id="year-tab-lbl" style={{ fontSize: 10 }}>2026</span><span className="gtab-count" id="gc-year">0/0</span></button>
              <button className="gtab" data-tab="month" onClick={() => switchGoalTab('month')}><span className="gtab-lbl" id="month-tab-lbl" style={{ fontSize: 10 }}>JANUARI</span><span className="gtab-count" id="gc-month">0/0</span></button>
            </div>
            <div className="goals-nav">
              <button className="gnav-btn" onClick={() => goalNav(-1)}>‹</button>
              <div className="gnav-lbl" id="gnav-lbl">—</div>
              <button className="gnav-btn" onClick={() => goalNav(1)}>›</button>
              <button className="gnav-now" onClick={goalNow}>NOW</button>
            </div>
            <div className="goals-progress">
              <div className="gp-bar"><div className="gp-fill" id="gp-fill"></div></div>
              <div className="gp-pct" id="gp-pct">0%</div>
            </div>
            <div className="goals-list" id="goals-list"></div>
            <div className="goal-add">
              <input type="text" className="goal-inp" id="gi" placeholder="+ Tambah goal baru..." onKeyDown={e => { if (e.key === 'Enter') addGoal() }} />
              <button className="goal-addbtn" onClick={addGoal}>+</button>
            </div>
          </div>
        </div>
        <div id="center-panel">
          <div className="view-toggle">
            <button className="vtab active" id="tab-chain" onClick={() => switchView('chain')}>Weekly Chain</button>
            <button className="vtab" id="tab-chart" onClick={() => switchView('chart')}>Productivity Chart</button>
          </div>

          <div className="cp" id="cp"></div>

          <div className="chart-panel" id="panel-chart">
            <div className="chart-range-bar" id="range-bar">
              <div className="rchip active" data-r="all" onClick={e => setRange('bar', e.currentTarget)}>All</div>
              <div className="rchip" data-r="m01" onClick={e => setRange('bar', e.currentTarget)}>Jan</div>
              <div className="rchip" data-r="m02" onClick={e => setRange('bar', e.currentTarget)}>Feb</div>
              <div className="rchip" data-r="m03" onClick={e => setRange('bar', e.currentTarget)}>Mar</div>
              <div className="rchip" data-r="m04" onClick={e => setRange('bar', e.currentTarget)}>Apr</div>
              <div className="rchip" data-r="m05" onClick={e => setRange('bar', e.currentTarget)}>May</div>
              <div className="rchip" data-r="m06" onClick={e => setRange('bar', e.currentTarget)}>Jun</div>
              <div className="rchip" data-r="m07" onClick={e => setRange('bar', e.currentTarget)}>Jul</div>
              <div className="rchip" data-r="m08" onClick={e => setRange('bar', e.currentTarget)}>Aug</div>
              <div className="rchip" data-r="m09" onClick={e => setRange('bar', e.currentTarget)}>Sep</div>
              <div className="rchip" data-r="m10" onClick={e => setRange('bar', e.currentTarget)}>Oct</div>
              <div className="rchip" data-r="m11" onClick={e => setRange('bar', e.currentTarget)}>Nov</div>
              <div className="rchip" data-r="m12" onClick={e => setRange('bar', e.currentTarget)}>Dec</div>
            </div>
            <div className="chart-section">
              <div className="chart-title">Your Productivity Graph</div>
              <div className="chart-sub">STACKED BAR — DAILY SCORE DISTRIBUTION</div>
              <div className="chart-legend" id="bar-legend"></div>
              <div className="chart-wrap"><canvas id="chart-bar"></canvas></div>
            </div>
            <div className="chart-range-bar" id="range-line" style={{ marginTop: 8 }}>
              <div className="rchip active" data-r="all" onClick={e => setRange('line', e.currentTarget)}>All</div>
              <div className="rchip" data-r="m01" onClick={e => setRange('line', e.currentTarget)}>Jan</div>
              <div className="rchip" data-r="m02" onClick={e => setRange('line', e.currentTarget)}>Feb</div>
              <div className="rchip" data-r="m03" onClick={e => setRange('line', e.currentTarget)}>Mar</div>
              <div className="rchip" data-r="m04" onClick={e => setRange('line', e.currentTarget)}>Apr</div>
              <div className="rchip" data-r="m05" onClick={e => setRange('line', e.currentTarget)}>May</div>
              <div className="rchip" data-r="m06" onClick={e => setRange('line', e.currentTarget)}>Jun</div>
              <div className="rchip" data-r="m07" onClick={e => setRange('line', e.currentTarget)}>Jul</div>
              <div className="rchip" data-r="m08" onClick={e => setRange('line', e.currentTarget)}>Aug</div>
              <div className="rchip" data-r="m09" onClick={e => setRange('line', e.currentTarget)}>Sep</div>
              <div className="rchip" data-r="m10" onClick={e => setRange('line', e.currentTarget)}>Oct</div>
              <div className="rchip" data-r="m11" onClick={e => setRange('line', e.currentTarget)}>Nov</div>
              <div className="rchip" data-r="m12" onClick={e => setRange('line', e.currentTarget)}>Dec</div>
            </div>
            <div className="chart-section">
              <div className="chart-title">Trend Line — Semua Kategori</div>
              <div className="chart-sub">7-DAY ROLLING AVERAGE PER KATEGORI</div>
              <div className="chart-legend" id="line-legend"></div>
              <div className="chart-wrap"><canvas id="chart-line"></canvas></div>
            </div>
            <div className="chart-section">
              <div className="chart-title">Total Daily Score</div>
              <div className="chart-sub">COMBINED SCORE — SEMUA KATEGORI PER HARI</div>
              <div className="chart-wrap"><canvas id="chart-total"></canvas></div>
            </div>
          </div>
        </div>
        <div className="rp">
          <div className="lsn-sec">
            <div className="ph">
              <div className="ph-title">What i&apos;ve got today?</div>
            </div>
            <div className="lsn-input-area">
              <textarea className="lsn-ta" id="lta" placeholder="Tulis insight atau pelajaran hari ini..."></textarea>
              <div className="cat-inp-wrap">
                <input type="text" className="lsn-cat-inp" id="lta-cat" placeholder="# Kategori? (AI, Bisnis, Coding...)" autoComplete="off" onFocus={showCatSug} onInput={showCatSug} onKeyDown={e => { if (e.key === 'Enter') { hideCatSug(); lockLesson() } }} />
                <div className="cat-sug" id="lta-cat-sug"></div>
              </div>
              <LessonDatePicker />
              <button className="lock-btn" onClick={lockLesson} style={{ color: 'var(--red)', background: 'var(--red-bg)', borderColor: 'var(--red-border)' }}>Send to my mind</button>
            </div>
            <div className="lsn-list" id="lsn-list" style={{ display: 'none' }}></div>
          </div>

          <div className="todo-sec">
            <div className="ph">
              <div className="ph-title">Get Shit Things</div>
            </div>
            <div className="mode-bar">
              <button className="mbtn mbtn-doing active" id="mbtn-doing" onClick={() => filterMode('doing')}>Doing <span className="mct" id="mct-doing">0</span></button>
              <button className="mbtn mbtn-learning" id="mbtn-learning" onClick={() => filterMode('learning')}>Learning <span className="mct" id="mct-learning">0</span></button>
            </div>
            <div className="status-bar">
              <button className="sbtn sbtn-todo active" data-status="todo" onClick={e => filterStatus(e.currentTarget)}>
                <span className="sdot-st sdot-red"></span>
                <span>To Do</span>
                <span className="sct" id="sct-todo">0</span>
              </button>
              <button className="sbtn sbtn-done" data-status="done" onClick={e => filterStatus(e.currentTarget)}>
                <span className="sdot-st sdot-green"></span>
                <span>Done</span>
                <span className="sct" id="sct-done">0</span>
              </button>
            </div>
            <div className="todo-add">
              <input type="text" className="todo-inp" id="ti" placeholder="Tambah task baru..." onKeyDown={e => { if (e.key === 'Enter') addTodo() }} onInput={e => updateCatHint(e.currentTarget.value)} />
              <button className="todo-addbtn" onClick={addTodo}>+</button>
            </div>
            <div className="cat-hint" id="cat-hint"></div>
            <div className="todo-list" id="todo-list"></div>
          </div>
        </div>
        {/* CENTER_PLACEHOLDER */}
        {/* RP_PLACEHOLDER */}
      </div>

      <div className="moverlay" id="gmo" onClick={e => { if (e.target === e.currentTarget) closeGoalsModal() }}>
        <div className="modal" style={{ maxWidth: 780 }}>
          <div className="mhdr">
            <div className="mtitle">★ Goals Belum Tercapai</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="mdbadge" id="gmo-count">0</div>
              <button className="mclose" onClick={closeGoalsModal}>✕</button>
            </div>
          </div>
          <div className="mbody" id="gmo-body" style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}></div>
        </div>
      </div>

      <div className="moverlay" id="lmo" onClick={e => { if (e.target === e.currentTarget) closeLessonsModal() }}>
        <div className="modal" style={{ maxWidth: 600 }}>
          <div className="mhdr">
            <div className="mtitle">Hidup tahun ini mengajarkan . . .</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="mdbadge" id="lmo-count" style={{ borderColor: 'rgb(240,253,244)', color: 'rgb(67,119,87)', background: 'rgb(240,253,244)' }}>0</div>
              <button className="mclose" onClick={closeLessonsModal}>✕</button>
            </div>
          </div>
          <div className="mbody" id="lmo-body" style={{ padding: '18px 22px' }}></div>
        </div>
      </div>

      <div className="moverlay" id="lesson-edit-modal" onClick={e => { if (e.target === e.currentTarget) closeLessonEditModal() }}>
        <div className="modal" style={{ maxWidth: 500 }}>
          <div className="mhdr">
            <div className="mtitle">✏️ Edit Pelajaran</div>
            <button className="mclose" onClick={closeLessonEditModal}>✕</button>
          </div>
          <div className="mbody" style={{ padding: '20px 22px' }}>
            <textarea id="lesson-edit-text" style={{ width: '100%', minHeight: 120, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', padding: '10px 12px', fontSize: 12, color: 'var(--text)', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}></textarea>
          </div>
          <div className="mfooter">
            <button className="btn-cancel" onClick={closeLessonEditModal}>Batal</button>
            <button className="btn-save" onClick={confirmLessonEdit}>Simpan</button>
          </div>
        </div>
      </div>

      <div className="moverlay" id="wish-modal" onClick={e => { if (e.target === e.currentTarget) closeWishesModal() }}>
        <div className="modal" style={{ maxWidth: 560 }}>
          <div className="mhdr">
            <div className="mtitle">✦ Dream List</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="mdbadge" id="wish-modal-count" style={{ background: '#eef3ff', borderColor: '#c7d9fc', color: '#3e6df0' }}>0</div>
              <button className="mclose" onClick={closeWishesModal}>✕</button>
            </div>
          </div>
          <div className="mbody" id="wish-modal-body" style={{ padding: '18px 22px' }}></div>
        </div>
      </div>

      <div className="moverlay" id="generic-modal" onClick={e => { if (e.target === e.currentTarget) closeGenericModal() }}>
        <div className="modal" style={{ maxWidth: 400 }}>
          <div className="mhdr">
            <div className="mtitle" id="gm-title"></div>
            <button className="mclose" onClick={closeGenericModal}>✕</button>
          </div>
          <div className="mbody" id="gm-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}></div>
          <div className="mfooter" id="gm-footer" style={{ padding: '12px 18px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}></div>
        </div>
      </div>
      <div className="moverlay" id="doing-modal" onClick={e => { if (e.target === e.currentTarget) closeDoingModal() }}>
        <div className="modal" style={{ maxWidth: 420 }}>
          <div className="mhdr">
            <div className="mtitle">✅ Task Done!</div>
            <button className="mclose" onClick={closeDoingModal}>✕</button>
          </div>
          <div className="mbody" style={{ padding: '20px 22px' }}>
            <div id="doing-todo-text" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 16 }}></div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Poin masuk ke aktivitas:</div>
            <div id="doing-cat-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}></div>
          </div>
          <div className="mfooter">
            <button className="btn-cancel" onClick={closeDoingModal}>Lewati</button>
            <button className="btn-save" onClick={confirmDoing} style={{ background: 'var(--red)', borderColor: 'var(--red)' }}>✓ Selesai</button>
          </div>
        </div>
      </div>

      <div className="moverlay" id="learning-modal">
        <div className="modal" style={{ maxWidth: 460 }}>
          <div className="mhdr">
            <div className="mtitle">📚 Learning Done!</div>
            <button className="mclose" onClick={closeLearningModal}>✕</button>
          </div>
          <div className="mbody" style={{ padding: '20px 22px' }}>
            <div id="learning-todo-text" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}></div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, marginTop: 14 }}>Apa yang kamu pelajari?</div>
            <textarea id="learning-result-text" placeholder="Tulis kesimpulan, insight, atau hal penting yang kamu tangkap..." style={{ width: '100%', minHeight: 110, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', padding: '10px 12px', fontSize: 12, color: 'var(--text)', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}></textarea>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>Tersimpan ke <strong>Lessons</strong> — bahan bacaan AI agent kamu nanti.</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>Poin masuk ke aktivitas:</div>
            <div id="learning-cat-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}></div>
          </div>
          <div className="mfooter">
            <button className="btn-cancel" onClick={closeLearningModal}>Lewati</button>
            <button className="btn-save" id="lock-learning-btn" onClick={confirmLearning} style={{ background: 'var(--gold)', borderColor: 'var(--gold)' }}>🔒 Lock Learning</button>
          </div>
        </div>
      </div>

      <div className="moverlay" id="achieve-wish-modal" onClick={e => { if (e.target === e.currentTarget) closeAchieveWishModal() }}>
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="mhdr">
            <div className="mtitle">💪 Wish Tercapai!</div>
            <button className="mclose" onClick={closeAchieveWishModal}>✕</button>
          </div>
          <div className="mbody" style={{ padding: '22px 24px' }}>
            <div id="achieve-wish-text" style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--red)', fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}></div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>+10 Poin — Masukkan ke kategori:</div>
            <div id="wish-cat-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}></div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, letterSpacing: '.04em' }}>DENGAN CARA APA LU MENCAPAI INI SEMUA?</div>
            <textarea id="achieve-wish-story" placeholder="Ceritakan perjalanan lo disini..." style={{ width: '100%', minHeight: 100, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r2)', padding: '10px 12px', fontSize: 12, color: 'var(--text)', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}></textarea>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn-cancel" onClick={closeAchieveWishModal} style={{ flex: 1 }}>Batal</button>
              <button className="btn-save" onClick={confirmAchieveWish} style={{ flex: 2, background: 'var(--red)' }}>✓ Save — Wish Tercapai!</button>
            </div>
          </div>
        </div>
      </div>

      <div className="moverlay" id="goal-achieve-modal">
        <div className="modal" style={{ maxWidth: 420 }}>
          <div className="mhdr">
            <div className="mtitle">🎯 Goal Tercapai!</div>
            <button className="mclose" onClick={closeGoalAchieveModal}>✕</button>
          </div>
          <div className="mbody" style={{ padding: '20px 22px' }}>
            <div id="goal-achieve-text" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, marginBottom: 4 }}></div>
            <div id="goal-achieve-pts" style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, letterSpacing: '.04em', marginBottom: 18 }}></div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Masukkan poin ke kategori:</div>
            <div id="goal-cat-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 4 }}></div>
          </div>
          <div className="mfooter">
            <button className="btn-cancel" onClick={closeGoalAchieveModal}>Batal</button>
            <button className="btn-save" id="goal-achieve-confirm" onClick={confirmGoalAchieve}>Konfirmasi</button>
          </div>
        </div>
      </div>

      <div className="moverlay" id="mo" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
        <div className="modal">
          <div className="mhdr">
            <div className="mtitle">Log Aktivitas</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="mdbadge" id="mdbadge">—</div>
              <button className="mclose" onClick={closeModal}>✕</button>
            </div>
          </div>
          <div className="mbody" id="mo-body"></div>
          <div className="mfooter">
            <button className="btn-save" onClick={closeModal}>Selesai</button>
          </div>
        </div>
      </div>

      <div className="moverlay" id="confirm-modal" onClick={e => { if (e.target === e.currentTarget) closeConfirm() }}>
        <div className="confirm-box">
          <span className="confirm-icon" id="confirm-icon">⚠️</span>
          <div className="confirm-title" id="confirm-title">Yakin?</div>
          <div className="confirm-desc" id="confirm-desc"></div>
          <div className="confirm-btns">
            <button className="confirm-btn-cancel" onClick={closeConfirm}>Batal</button>
            <button className="confirm-btn-ok" id="confirm-ok-btn">Lanjut</button>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
