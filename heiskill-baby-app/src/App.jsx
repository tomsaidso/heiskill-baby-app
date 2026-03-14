import { useState, useEffect } from 'react'
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, updateDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

const FAMILY_ID    = 'heiskill'
const FEED_TYPES   = ['Breast Left', 'Breast Right', 'Bottle', 'Formula']
const DIAPER_TYPES = ['Wet', 'Dirty', 'Both', 'Dry']
const NOTE_TAGS    = {
  moment:    { label: '✨ Moment',    bg: '#FEF3C7', color: '#92400E' },
  milestone: { label: '🌟 Milestone', bg: '#D1FAE5', color: '#065F46' },
  health:    { label: '💊 Health',    bg: '#EDE9FE', color: '#5B21B6' },
  love:      { label: '💕 Love Note', bg: '#FCE7F3', color: '#9D174D' },
}

function timeSince(ts) {
  if (!ts) return '—'
  const m = Math.floor((Date.now() - ts.toDate()) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
function fmtTime(ts) {
  if (!ts) return ''
  return ts.toDate().toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true })
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
}
function sameDay(ts, dateStr) {
  if (!ts) return false
  const a = ts.toDate(), b = new Date(dateStr)
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}

const col = (name) => collection(db, 'families', FAMILY_ID, name)

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#FDF6F0;font-family:'DM Serif Display',Georgia,serif;color:#2C1810}
.input{font-family:'DM Sans',sans-serif;font-size:14px;border:1.5px solid #E8D5C4;border-radius:12px;padding:10px 14px;background:#FFFAF7;color:#2C1810;outline:none;width:100%;transition:border-color .15s}
.input:focus{border-color:#D4856A}
select.input{appearance:none}
.tag{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;font-family:'DM Sans',sans-serif;letter-spacing:.04em;text-transform:uppercase}
.tag-feed{background:#FDE8D8;color:#C05621}.tag-diaper{background:#D4EDE1;color:#276749}.tag-sleep{background:#E8E4F3;color:#5B4B8A}
.tag-jada{background:#FCE4EC;color:#B0003A}.tag-tony{background:#E3F0FB;color:#1565C0}.tag-high{background:#FFEBEE;color:#C62828}
.log-item{border-left:3px solid;padding:12px 16px;border-radius:0 14px 14px 0;background:#fff;box-shadow:0 1px 6px rgba(44,24,16,.05)}
.log-feed{border-color:#E8845C}.log-diaper{border-color:#52A97A}.log-sleep{border-color:#9B89C4}
.tab-bar{display:flex;gap:4px;padding:12px 16px;background:#fff;border-bottom:1px solid #F0E0D4;overflow-x:auto;scrollbar-width:none;position:sticky;top:0;z-index:10}
.tab-bar::-webkit-scrollbar{display:none}
.tab-btn{font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;padding:8px 16px;border-radius:30px;cursor:pointer;border:none;transition:all .2s;white-space:nowrap}
.tab-active{background:#D4856A;color:#fff;box-shadow:0 3px 10px rgba(212,133,106,.35)}
.tab-inactive{background:#F5E6DE;color:#9B7B6E}
.overlay{position:fixed;inset:0;background:rgba(44,24,16,.4);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:flex-end;justify-content:center}
.sheet{background:#FDF6F0;border-radius:28px 28px 0 0;padding:28px 24px 48px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto}
.close-btn{position:absolute;top:16px;right:20px;background:#F0E0D4;border:none;border-radius:50%;width:32px;height:32px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#9B7B6E}
.task-item{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:#fff;border-radius:16px;box-shadow:0 1px 8px rgba(44,24,16,.05)}
.task-done{opacity:.45}
.checkbox{width:22px;height:22px;border-radius:8px;border:2px solid #D4856A;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.checkbox-checked{background:#D4856A;border-color:#D4856A}
.fab{position:fixed;bottom:28px;right:24px;width:56px;height:56px;border-radius:50%;background:#D4856A;color:#fff;font-size:26px;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(212,133,106,.5);display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:50}
.fab:hover{transform:scale(1.08)}
.pill{font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;padding:6px 14px;border-radius:20px;cursor:pointer;border:1.5px solid transparent;transition:all .15s}
.pill-active{background:#D4856A;color:#fff}
.pill-inactive{background:#F5E6DE;color:#9B7B6E}
.stat-box{border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 12px rgba(44,24,16,.06)}
.note-card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 1px 8px rgba(44,24,16,.05)}
.xbtn{background:none;border:none;color:#D4A095;cursor:pointer;font-size:14px;padding-left:8px;flex-shrink:0}
.sync-dot{width:8px;height:8px;border-radius:50%;background:#52A97A;display:inline-block;margin-right:6px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.loading{display:flex;align-items:center;justify-content:center;padding:48px 0;color:#C4A090;font-family:'DM Sans',sans-serif;font-size:15px;gap:10px}
.spinner{width:20px;height:20px;border:2px solid #F0E0D4;border-top-color:#D4856A;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media print{.no-print{display:none!important}.fab{display:none!important}body{background:white}}
`

function SelBtn({ active, label, onClick, ac, bg }) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:'10px 6px', borderRadius:12, border:'2px solid', fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600, cursor:'pointer',
      borderColor: active ? ac : '#E8D5C4', background: active ? bg : '#fff', color: active ? ac : '#9B7B6E' }}>
      {label}
    </button>
  )
}

export default function App() {
  const [tab, setTab]           = useState('tracker')
  const [logs, setLogs]         = useState([])
  const [tasks, setTasks]       = useState([])
  const [notes, setNotes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [synced, setSynced]     = useState(false)
  const [logForm,  setLogForm]  = useState({ type:'feed', feedType:'Breast Left', amount:'', diaperType:'Wet', duration:'', note:'', who:'Jada' })
  const [taskForm, setTaskForm] = useState({ text:'', assignedTo:'Jada', priority:'normal' })
  const [noteForm, setNoteForm] = useState({ text:'', tag:'moment' })
  const [showLog,  setShowLog]  = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [filterLog, setFilterLog] = useState('all')
  const [sumDate, setSumDate]   = useState(new Date().toISOString())

  useEffect(() => {
    const unsubLogs = onSnapshot(
      query(col('logs'), orderBy('createdAt', 'desc')),
      snap => { setLogs(snap.docs.map(d => ({ id:d.id, ...d.data() }))); setLoading(false); setSynced(true) },
      () => setLoading(false)
    )
    const unsubTasks = onSnapshot(
      query(col('tasks'), orderBy('createdAt', 'desc')),
      snap => setTasks(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    )
    const unsubNotes = onSnapshot(
      query(col('notes'), orderBy('createdAt', 'desc')),
      snap => setNotes(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    )
    return () => { unsubLogs(); unsubTasks(); unsubNotes() }
  }, [])

  const addLog = async () => {
    await addDoc(col('logs'), { ...logForm, createdAt: serverTimestamp() })
    setLogForm({ type:'feed', feedType:'Breast Left', amount:'', diaperType:'Wet', duration:'', note:'', who:'Jada' })
    setShowLog(false)
  }
  const addTask = async () => {
    if (!taskForm.text.trim()) return
    await addDoc(col('tasks'), { ...taskForm, done:false, createdAt: serverTimestamp() })
    setTaskForm({ text:'', assignedTo:'Jada', priority:'normal' })
    setShowTask(false)
  }
  const addNote = async () => {
    if (!noteForm.text.trim()) return
    await addDoc(col('notes'), { ...noteForm, createdAt: serverTimestamp() })
    setNoteForm({ text:'', tag:'moment' })
    setShowNote(false)
  }
  const toggleTask = (id, done) => updateDoc(doc(db, 'families', FAMILY_ID, 'tasks', id), { done: !done })

  const filteredLogs = filterLog === 'all' ? logs : logs.filter(l => l.type === filterLog)
  const lastFeed     = logs.find(l => l.type === 'feed')
  const lastDiaper   = logs.find(l => l.type === 'diaper')
  const lastSleep    = logs.find(l => l.type === 'sleep')
  const pending      = tasks.filter(t => !t.done)
  const done         = tasks.filter(t => t.done)
  const todayLogs    = logs.filter(l => sameDay(l.createdAt, sumDate))
  const feedLogs     = todayLogs.filter(l => l.type === 'feed')
  const diaperLogs   = todayLogs.filter(l => l.type === 'diaper')
  const sleepLogs    = todayLogs.filter(l => l.type === 'sleep')
  const totalSleep   = sleepLogs.reduce((a,l) => a + (parseInt(l.duration)||0), 0)
  const totalOz      = feedLogs.reduce((a,l) => a + (parseFloat(l.amount)||0), 0)

  const exportCSV = () => {
    const rows = [['Type','Who','Detail','Amount/Duration','Note','Time']]
    logs.forEach(l => rows.push([l.type, l.who,
      l.type==='feed'?l.feedType:l.type==='diaper'?l.diaperType:'Sleep',
      l.type==='feed'?(l.amount?`${l.amount} oz`:''):l.duration?`${l.duration} min`:'',
      l.note||'', fmtTime(l.createdAt)
    ]))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')],{type:'text/csv'}))
    a.download = 'heiskill-baby-log.csv'; a.click()
  }

  return (
    <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", minHeight:'100vh', background:'#FDF6F0', color:'#2C1810', maxWidth:480, margin:'0 auto' }}>
      <style>{CSS}</style>

      <div style={{ background:'linear-gradient(135deg,#E8845C 0%,#C96B48 100%)', padding:'28px 24px 24px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }}/>
        {synced && (
          <div style={{ position:'absolute', top:16, right:20, display:'flex', alignItems:'center', fontFamily:"'DM Sans',sans-serif", fontSize:11, color:'rgba(255,255,255,0.8)' }}>
            <span className="sync-dot"/>Live
          </div>
        )}
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontFamily:"'DM Sans',sans-serif", fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>Baby Tracker</div>
        <div style={{ fontSize:28, color:'#fff', lineHeight:1.15, marginBottom:2 }}>The Heiskill Baby 🎀</div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', fontFamily:"'DM Sans',sans-serif" }}>Jada & Tony — waiting on her name!</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:18 }}>
          {[
            { l:'Last Feed',   v:timeSince(lastFeed?.createdAt),   i:'🍼' },
            { l:'Last Diaper', v:timeSince(lastDiaper?.createdAt), i:'👶' },
            { l:'Last Sleep',  v:timeSince(lastSleep?.createdAt),  i:'😴' },
          ].map(s => (
            <div key={s.l} style={{ background:'rgba(255,255,255,0.15)', borderRadius:14, padding:'10px 6px', textAlign:'center' }}>
              <div style={{ fontSize:16, marginBottom:2 }}>{s.i}</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:"'DM Sans',sans-serif" }}>{s.v}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.65)', fontFamily:"'DM Sans',sans-serif", letterSpacing:'0.05em', textTransform:'uppercase', marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tab-bar no-print">
        {[['tracker','🍼 Tracker'],['summary','📊 Summary'],['tasks',`✅ Tasks${pending.length?` (${pending.length})`:''}`],['notes','📝 Notes']].map(([t,l]) => (
          <button key={t} className={`tab-btn ${tab===t?'tab-active':'tab-inactive'}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      <div style={{ padding:'20px 20px 100px' }}>
        {loading && (
          <div className="loading"><div className="spinner"/>Connecting to Heiskill HQ...</div>
        )}

        {!loading && tab==='tracker' && (
          <>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {['all','feed','diaper','sleep'].map(f => (
                <button key={f} className={`pill ${filterLog===f?'pill-active':'pill-inactive'}`} onClick={() => setFilterLog(f)}>
                  {f==='all'?'All':f==='feed'?'🍼 Feeds':f==='diaper'?'👶 Diapers':'😴 Sleep'}
                </button>
              ))}
            </div>
            {filteredLogs.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px 0', color:'#C4A090' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🌸</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15 }}>No logs yet — tap + to start!</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {filteredLogs.map(log => (
                  <div key={log.id} className={`log-item log-${log.type}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                        <span className={`tag tag-${log.type}`}>{log.type==='feed'?'🍼':log.type==='diaper'?'👶':'😴'} {log.type}</span>
                        <span className={`tag tag-${log.who==='Jada'?'jada':'tony'}`}>{log.who}</span>
                      </div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'#5C3D2E' }}>
                        {log.type==='feed' && <>{log.feedType}{log.amount?` · ${log.amount} oz`:''}{log.duration?` · ${log.duration} min`:''}</>}
                        {log.type==='diaper' && log.diaperType}
                        {log.type==='sleep' && (log.duration?`${log.duration} min`:'Sleep logged')}
                        {log.note && <span style={{ color:'#9B7B6E' }}> · {log.note}</span>}
                      </div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:'#C4A090', marginTop:4 }}>{fmtTime(log.createdAt)}</div>
                    </div>
                    <button className="xbtn" onClick={() => deleteDoc(doc(db,'families',FAMILY_ID,'logs',log.id))}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && tab==='summary' && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <button onClick={() => { const d=new Date(sumDate); d.setDate(d.getDate()-1); setSumDate(d.toISOString()) }} style={{ background:'#F5E6DE', border:'none', borderRadius:10, padding:'8px 14px', fontFamily:"'DM Sans',sans-serif", cursor:'pointer', color:'#9B7B6E', fontWeight:700, fontSize:16 }}>‹</button>
              <div style={{ flex:1, textAlign:'center', fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, color:'#5C3D2E' }}>{fmtDate(sumDate)}</div>
              <button onClick={() => { const d=new Date(sumDate); d.setDate(d.getDate()+1); setSumDate(d.toISOString()) }} style={{ background:'#F5E6DE', border:'none', borderRadius:10, padding:'8px 14px', fontFamily:"'DM Sans',sans-serif", cursor:'pointer', color:'#9B7B6E', fontWeight:700, fontSize:16 }}>›</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {[
                { l:'Feedings',       v:feedLogs.length,   sub:totalOz>0?`${totalOz} oz total`:null, i:'🍼', bg:'#FDE8D8' },
                { l:'Diapers',        v:diaperLogs.length, sub:null, i:'👶', bg:'#D4EDE1' },
                { l:'Sleep Sessions', v:sleepLogs.length,  sub:totalSleep>0?`${Math.floor(totalSleep/60)}h ${totalSleep%60}m`:null, i:'😴', bg:'#E8E4F3' },
                { l:'Total Logs',     v:todayLogs.length,  sub:null, i:'📋', bg:'#FEF3C7' },
              ].map(s => (
                <div key={s.l} className="stat-box" style={{ background:s.bg }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{s.i}</div>
                  <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:32, color:'#2C1810', lineHeight:1 }}>{s.v}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600, color:'#7C5A4E', marginTop:4 }}>{s.l}</div>
                  {s.sub && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:'#9B7B6E', marginTop:2 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
            {todayLogs.length>0 && (
              <div style={{ background:'#fff', borderRadius:16, padding:16, marginBottom:20, boxShadow:'0 1px 8px rgba(44,24,16,.05)' }}>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#C4A090', marginBottom:12 }}>Who Did What</div>
                {['Jada','Tony'].map(who => {
                  const c = todayLogs.filter(l=>l.who===who).length
                  const p = todayLogs.length>0 ? Math.round(c/todayLogs.length*100) : 0
                  return (
                    <div key={who} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600, color:'#5C3D2E', marginBottom:5 }}>
                        <span>{who}</span><span>{c} logs · {p}%</span>
                      </div>
                      <div style={{ height:8, background:'#F5E6DE', borderRadius:8, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${p}%`, background:who==='Jada'?'#F06292':'#64B5F6', borderRadius:8, transition:'width .4s' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#C4A090', marginBottom:10 }}>Export</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={exportCSV} style={{ flex:1, padding:12, borderRadius:12, border:'1.5px solid #F5C9A8', background:'#FDE8D8', color:'#C05621', fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>📥 Download CSV</button>
              <button onClick={() => window.print()} style={{ flex:1, padding:12, borderRadius:12, border:'1.5px solid #C9C0E8', background:'#E8E4F3', color:'#5B4B8A', fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>🖨️ Print / PDF</button>
            </div>
          </>
        )}

        {!loading && tab==='tasks' && (
          <>
            {pending.length===0 && done.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px 0', color:'#C4A090' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✨</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15 }}>All clear — tap + to add a task!</div>
              </div>
            ) : (
              <>
                {pending.length>0 && (
                  <>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#C4A090', marginBottom:10 }}>To Do</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                      {pending.map(t => (
                        <div key={t.id} className="task-item">
                          <div className="checkbox" onClick={() => toggleTask(t.id, t.done)}/>
                          <div style={{ flex:1 }}>
                            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:500 }}>{t.text}</div>
                            <div style={{ display:'flex', gap:6, marginTop:5 }}>
                              <span className={`tag tag-${t.assignedTo==='Jada'?'jada':'tony'}`}>{t.assignedTo}</span>
                              {t.priority==='high' && <span className="tag tag-high">Urgent</span>}
                            </div>
                          </div>
                          <button className="xbtn" onClick={() => deleteDoc(doc(db,'families',FAMILY_ID,'tasks',t.id))}>✕</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {done.length>0 && (
                  <>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#C4A090', marginBottom:10 }}>Done ✓</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {done.map(t => (
                        <div key={t.id} className="task-item task-done">
                          <div className="checkbox checkbox-checked" onClick={() => toggleTask(t.id, t.done)}><span style={{ color:'#fff', fontSize:13 }}>✓</span></div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:'#9B7B6E', textDecoration:'line-through' }}>{t.text}</div>
                            <span className={`tag tag-${t.assignedTo==='Jada'?'jada':'tony'}`} style={{ marginTop:4, display:'inline-flex' }}>{t.assignedTo}</span>
                          </div>
                          <button className="xbtn" onClick={() => deleteDoc(doc(db,'families',FAMILY_ID,'tasks',t.id))}>✕</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {!loading && tab==='notes' && (
          <>
            <div style={{ background:'linear-gradient(135deg,#FCE4EC,#FEF3C7)', borderRadius:18, padding:16, marginBottom:20, textAlign:'center' }}>
              <div style={{ fontSize:24, marginBottom:4 }}>📝</div>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:'#2C1810', marginBottom:4 }}>Baby Memory Book</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:'#9B7B6E' }}>Capture moments, milestones & love notes for your little girl</div>
            </div>
            {notes.length===0 ? (
              <div style={{ textAlign:'center', padding:'32px 0', color:'#C4A090' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🌸</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15 }}>Write your first memory!</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {notes.map(n => {
                  const ti = NOTE_TAGS[n.tag]||NOTE_TAGS.moment
                  return (
                    <div key={n.id} className="note-card">
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, fontFamily:"'DM Sans',sans-serif", background:ti.bg, color:ti.color }}>{ti.label}</span>
                        <button className="xbtn" onClick={() => deleteDoc(doc(db,'families',FAMILY_ID,'notes',n.id))}>✕</button>
                      </div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:'#2C1810', lineHeight:1.6 }}>{n.text}</div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:'#C4A090', marginTop:8 }}>{fmtTime(n.createdAt)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <button className="fab no-print" onClick={() => { if(tab==='tracker')setShowLog(true); else if(tab==='tasks')setShowTask(true); else if(tab==='notes')setShowNote(true); else setShowLog(true) }}>+</button>

      {showLog && (
        <div className="overlay" onClick={() => setShowLog(false)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <div style={{ position:'relative', marginBottom:20 }}>
              <div style={{ fontSize:22 }}>Add Log</div>
              <button className="close-btn" onClick={() => setShowLog(false)}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', gap:8 }}>
                <SelBtn active={logForm.type==='feed'}   label="🍼 Feed"   onClick={()=>setLogForm(f=>({...f,type:'feed'}))}   ac="#C05621" bg="#FDE8D8"/>
                <SelBtn active={logForm.type==='diaper'} label="👶 Diaper" onClick={()=>setLogForm(f=>({...f,type:'diaper'}))} ac="#276749" bg="#D4EDE1"/>
                <SelBtn active={logForm.type==='sleep'}  label="😴 Sleep"  onClick={()=>setLogForm(f=>({...f,type:'sleep'}))}  ac="#5B4B8A" bg="#E8E4F3"/>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <SelBtn active={logForm.who==='Jada'} label="Jada" onClick={()=>setLogForm(f=>({...f,who:'Jada'}))} ac="#B0003A" bg="#FCE4EC"/>
                <SelBtn active={logForm.who==='Tony'} label="Tony" onClick={()=>setLogForm(f=>({...f,who:'Tony'}))} ac="#1565C0" bg="#E3F0FB"/>
              </div>
              {logForm.type==='feed' && <>
                <select className="input" value={logForm.feedType} onChange={e=>setLogForm(f=>({...f,feedType:e.target.value}))}>{FEED_TYPES.map(ft=><option key={ft}>{ft}</option>)}</select>
                <input className="input" type="number" placeholder="Amount (oz) — optional" value={logForm.amount} onChange={e=>setLogForm(f=>({...f,amount:e.target.value}))}/>
                <input className="input" type="number" placeholder="Duration (min) — optional" value={logForm.duration} onChange={e=>setLogForm(f=>({...f,duration:e.target.value}))}/>
              </>}
              {logForm.type==='diaper' && <select className="input" value={logForm.diaperType} onChange={e=>setLogForm(f=>({...f,diaperType:e.target.value}))}>{DIAPER_TYPES.map(dt=><option key={dt}>{dt}</option>)}</select>}
              {logForm.type==='sleep'  && <input className="input" type="number" placeholder="Duration (minutes)" value={logForm.duration} onChange={e=>setLogForm(f=>({...f,duration:e.target.value}))}/>}
              <input className="input" placeholder="Note — optional" value={logForm.note} onChange={e=>setLogForm(f=>({...f,note:e.target.value}))}/>
              <button onClick={addLog} style={{ background:'#D4856A', color:'#fff', borderRadius:14, padding:14, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15, cursor:'pointer', border:'none' }}>Save Log</button>
            </div>
          </div>
        </div>
      )}

      {showTask && (
        <div className="overlay" onClick={() => setShowTask(false)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <div style={{ position:'relative', marginBottom:20 }}>
              <div style={{ fontSize:22 }}>Add Task</div>
              <button className="close-btn" onClick={() => setShowTask(false)}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input className="input" placeholder="What needs to get done?" value={taskForm.text} onChange={e=>setTaskForm(f=>({...f,text:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addTask()}/>
              <div style={{ display:'flex', gap:8 }}>
                <SelBtn active={taskForm.assignedTo==='Jada'} label="Jada"      onClick={()=>setTaskForm(f=>({...f,assignedTo:'Jada'}))} ac="#B0003A" bg="#FCE4EC"/>
                <SelBtn active={taskForm.assignedTo==='Tony'} label="Tony"      onClick={()=>setTaskForm(f=>({...f,assignedTo:'Tony'}))} ac="#1565C0" bg="#E3F0FB"/>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <SelBtn active={taskForm.priority==='normal'} label="Normal"    onClick={()=>setTaskForm(f=>({...f,priority:'normal'}))} ac="#C05621" bg="#FDE8D8"/>
                <SelBtn active={taskForm.priority==='high'}   label="🔴 Urgent" onClick={()=>setTaskForm(f=>({...f,priority:'high'}))}   ac="#C62828" bg="#FFEBEE"/>
              </div>
              <button onClick={addTask} style={{ background:'#D4856A', color:'#fff', borderRadius:14, padding:14, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15, cursor:'pointer', border:'none' }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {showNote && (
        <div className="overlay" onClick={() => setShowNote(false)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <div style={{ position:'relative', marginBottom:20 }}>
              <div style={{ fontSize:22 }}>Add Memory</div>
              <button className="close-btn" onClick={() => setShowNote(false)}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <textarea className="input" rows={4} placeholder="Write a memory, milestone, or love note..." value={noteForm.text} onChange={e=>setNoteForm(f=>({...f,text:e.target.value}))} style={{ resize:'none', lineHeight:1.5 }}/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {Object.entries(NOTE_TAGS).map(([k,v]) => (
                  <button key={k} onClick={()=>setNoteForm(f=>({...f,tag:k}))} style={{ padding:'9px 6px', borderRadius:12, border:'2px solid', fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:600, cursor:'pointer', borderColor:noteForm.tag===k?v.color:'#E8D5C4', background:noteForm.tag===k?v.bg:'#fff', color:noteForm.tag===k?v.color:'#9B7B6E' }}>
                    {v.label}
                  </button>
                ))}
              </div>
              <button onClick={addNote} style={{ background:'#D4856A', color:'#fff', borderRadius:14, padding:14, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15, cursor:'pointer', border:'none' }}>Save Memory</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
