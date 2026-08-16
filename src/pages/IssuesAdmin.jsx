import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = {
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังแก้ไข',
  resolved: 'แก้ไขแล้ว',
}

function IssuesAdmin() {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [filter, setFilter] = useState('all')

  const loadIssues = async () => {
    const { data } = await supabase
      .from('room_issues')
      .select('*, rooms(name)')
      .order('created_at', { ascending: false })
    setIssues(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadIssues()

    // ✅ subscribe realtime เพื่อให้เห็นปัญหาที่แจ้งเข้ามาใหม่ทันที
    const channel = supabase
      .channel('issues-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_issues' }, () => {
        loadIssues()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id)
    await supabase
      .from('room_issues')
      .update({
        status: newStatus,
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', id)
    setUpdatingId(null)
  }

  const counts = {
    pending: issues.filter((i) => i.status === 'pending').length,
    in_progress: issues.filter((i) => i.status === 'in_progress').length,
    resolved: issues.filter((i) => i.status === 'resolved').length,
  }

  const filteredIssues = filter === 'all' ? issues : issues.filter((i) => i.status === filter)

  if (loading) return <p style={{ padding: 30, textAlign: 'center' }}>กำลังโหลด...</p>

  return (
    <main className="page-container">
      <section className="card isa-wrap">
        <div className="page-header">
          <h1>🛠️ จัดการปัญหาห้อง</h1>
          <p>รายการปัญหาที่ผู้ใช้แจ้งเข้ามาผ่านระบบ</p>
        </div>

        <div className="isa-stats">
          <button type="button" className={`isa-stat isa-stat-pending ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
            <span>⏳ รอดำเนินการ</span>
            <strong>{counts.pending}</strong>
          </button>
          <button type="button" className={`isa-stat isa-stat-progress ${filter === 'in_progress' ? 'active' : ''}`} onClick={() => setFilter('in_progress')}>
            <span>🔧 กำลังแก้ไข</span>
            <strong>{counts.in_progress}</strong>
          </button>
          <button type="button" className={`isa-stat isa-stat-resolved ${filter === 'resolved' ? 'active' : ''}`} onClick={() => setFilter('resolved')}>
            <span>✅ แก้ไขแล้ว</span>
            <strong>{counts.resolved}</strong>
          </button>
          <button type="button" className={`isa-stat isa-stat-all ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            <span>📋 ทั้งหมด</span>
            <strong>{issues.length}</strong>
          </button>
        </div>

        <div className="isa-list">
          {filteredIssues.length === 0 && (
            <p className="text-empty" style={{ textAlign: 'center', padding: '20px 0' }}>ไม่มีรายการในหมวดนี้</p>
          )}
          {filteredIssues.map((issue) => (
            <div className={`isa-card isa-card-${issue.status}`} key={issue.id}>
              <div className="isa-card-header">
                <div>
                  <span className="isa-room">{issue.rooms?.name || 'ไม่ระบุห้อง'}</span>
                  <span className="isa-type">{issue.issue_type}</span>
                </div>
                <span className={`status isa-badge-${issue.status}`}>{STATUS_LABEL[issue.status]}</span>
              </div>

              <p className="isa-desc">{issue.description}</p>

              <div className="isa-card-footer">
                <div className="isa-reporter">
                  <span>👤 {issue.reporter_name || issue.reporter_email || 'ไม่ทราบผู้แจ้ง'}</span>
                  <span>🕒 {new Date(issue.created_at).toLocaleString('th-TH')}</span>
                </div>
                <select
                  value={issue.status}
                  disabled={updatingId === issue.id}
                  onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                >
                  <option value="pending">รอดำเนินการ</option>
                  <option value="in_progress">กำลังแก้ไข</option>
                  <option value="resolved">แก้ไขแล้ว</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>

      <IssuesAdminStyles />
    </main>
  )
}

// สไตล์ scope ด้วย prefix "isa-" — ใช้ CSS variables จริงของระบบ และ mapping สีความหมายเดียวกับ .status ที่มีอยู่แล้ว
// pending → warning (ทอง) / in_progress → primary (ทองเข้ม) / resolved → success (เขียว)
function IssuesAdminStyles() {
  return (
    <style>{`
      .isa-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      .isa-stat {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-start;
        background: var(--card-solid);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 14px 16px;
        cursor: pointer;
        color: var(--text-muted);
        font-family: var(--font-body);
        border-left: 3px solid var(--border-color);
        box-shadow: var(--shadow-sm);
        transition: opacity 0.15s ease, border-color 0.15s ease;
      }
      .isa-stat strong { font-size: 1.6rem; color: var(--text-main); font-family: var(--font-display); }
      .isa-stat:not(.active) { opacity: 0.6; }
      .isa-stat.active { opacity: 1; }
      .isa-stat-pending.active { border-left-color: var(--warning-color); }
      .isa-stat-progress.active { border-left-color: var(--primary-color); }
      .isa-stat-resolved.active { border-left-color: var(--success-color); }
      .isa-stat-all.active { border-left-color: var(--text-muted); }

      .isa-list { display: flex; flex-direction: column; gap: 12px; }

      .isa-card {
        background: var(--card-solid);
        border: 1px solid var(--border-color);
        border-left: 3px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 16px 18px;
        box-shadow: var(--shadow-sm);
      }
      .isa-card-pending { border-left-color: var(--warning-color); }
      .isa-card-in_progress { border-left-color: var(--primary-color); }
      .isa-card-resolved { border-left-color: var(--success-color); }

      .isa-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }
      .isa-room { color: var(--text-main); font-weight: 700; margin-right: 10px; font-family: var(--font-display); }
      .isa-type { color: var(--text-muted); font-size: 0.85rem; }

      .isa-badge-pending { background: var(--warning-light); color: #f0d189; border-color: rgba(232, 192, 104, 0.3); }
      .isa-badge-in_progress { background: var(--primary-light); color: var(--primary-color); border-color: var(--border-strong); }
      .isa-badge-resolved { background: var(--success-light); color: #a8e8c8; border-color: rgba(111, 200, 154, 0.3); }

      .isa-desc { color: var(--text-main); font-size: 0.9rem; margin: 8px 0 14px; line-height: 1.5; }

      .isa-card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .isa-reporter {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.78rem;
        color: var(--text-muted);
      }
      .isa-card-footer select {
        background: rgba(15, 34, 28, 0.6);
        border: 1.5px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 8px 12px;
        color: var(--text-main);
        font-size: 0.85rem;
      }
    `}</style>
  )
}

export default IssuesAdmin