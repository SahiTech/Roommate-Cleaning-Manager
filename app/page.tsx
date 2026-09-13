'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle2, Clock3, Copy, LogOut, Plus, RefreshCw, Settings, Share2, Sparkles, Trash2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type User = { id: string; email?: string | null; user_metadata?: { full_name?: string } };
type Room = { id: string; name: string; owner_user_id: string | null; timezone: string };
type Member = { id: string; room_id: string; user_id: string | null; name: string; email: string | null; role: 'admin' | 'member'; active: boolean; notification_enabled: boolean; reminder_enabled: boolean; escalation_enabled: boolean };
type Schedule = { id: string; room_id: string; member_id: string; weekday: number; duty_time: string; reminder_minutes: number; escalation_minutes: number; duration_minutes: number; title: string; active: boolean };
type Task = { id: string; room_id: string; member_id: string; duty_date: string; due_at: string; status: 'pending' | 'completed' | 'overdue' | 'missed'; completed_at: string | null; confirmation_note?: string | null };
type Notice = { id: string; member_id: string; task_id: string | null; type: string; title: string; body: string; created_at: string; read_at: string | null };

declare global { interface Window { __roommateInstallPrompt?: { prompt: () => Promise<void> } } }

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const b64ToBytes = (value: string) => { const padding = '='.repeat((4 - value.length % 4) % 4); const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

function zonedParts(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday: days.indexOf(get('weekday')) };
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [dutyTime, setDutyTime] = useState('20:00');
  const [invite, setInvite] = useState('');
  const [loginSent, setLoginSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(false);

  const active = members.filter((m) => m.active);
  const me = active.find((m) => m.user_id === user?.id);
  const isAdmin = me?.role === 'admin';
  const timezone = room?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';
  const { date: todayDate, weekday: day } = zonedParts(timezone);
  const todayTask = tasks.find((t) => t.duty_date === todayDate);
  const todaySchedule = schedules.find((s) => s.weekday === day && s.active);
  const todayPerson = active.find((m) => m.id === (todayTask?.member_id || todaySchedule?.member_id));
  const unread = notices.filter((n) => !n.read_at).length;

  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); }, []);

  const localNotify = useCallback((title: string, body: string, tag: string) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(title, { body, tag, icon: '/icon.svg' }); } catch (_) {}
    }
  }, []);

  const loadRooms = useCallback(async () => {
    const db = await supabase();
    const { data, error: roomsError } = await db.from('rooms').select('id,name,owner_user_id,timezone').order('created_at');
    if (roomsError) throw roomsError;
    const list = data || [];
    setRooms(list);
    const selected = list.find((r) => r.id === room?.id) || list[0] || null;
    setRoom(selected);
    return selected;
  }, [room?.id]);

  const loadRoom = useCallback(async (selected: Room) => {
    const db = await supabase();
    const taskResult = await db.rpc('ensure_room_tasks', { p_room_id: selected.id, p_days: 14 });
    if (taskResult.error) throw taskResult.error;
    const [m, s, t] = await Promise.all([
      db.from('members').select('*').eq('room_id', selected.id).eq('active', true).order('created_at'),
      db.from('cleaning_schedules').select('*').eq('room_id', selected.id).eq('active', true).order('weekday'),
      db.from('cleaning_tasks').select('*').eq('room_id', selected.id).order('duty_date', { ascending: false }).limit(100),
    ]);
    if (m.error) throw m.error; if (s.error) throw s.error; if (t.error) throw t.error;
    setMembers(m.data || []); setSchedules(s.data || []); setTasks(t.data || []);
    const currentMember = (m.data || []).find((x) => x.user_id === user?.id);
    if (currentMember) {
      const n = await db.from('notification_events').select('*').eq('member_id', currentMember.id).order('created_at', { ascending: false }).limit(30);
      if (n.error) throw n.error;
      setNotices(n.data || []);
    } else setNotices([]);
  }, [user?.id]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try { const selected = await loadRooms(); if (selected) await loadRoom(selected); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load your workspace.'); }
    finally { setLoading(false); }
  }, [user, loadRooms, loadRoom]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const db = await supabase();
        const { data } = await db.auth.getUser();
        if (mounted) setUser((data.user as User | null) || null);
        const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
          if (mounted) setUser((session?.user as User | null) || null);
        });
        if (!mounted) listener.subscription.unsubscribe();
        else (window as Window & { __roommateAuthCleanup?: () => void }).__roommateAuthCleanup = () => listener.subscription.unsubscribe();
      } catch (e) { if (mounted) setError(e instanceof Error ? e.message : 'Unable to initialize.'); }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
      (window as Window & { __roommateAuthCleanup?: () => void }).__roommateAuthCleanup?.();
      delete (window as Window & { __roommateAuthCleanup?: () => void }).__roommateAuthCleanup;
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const promptEvent = event as Event & { prompt: () => Promise<void> };
      window.__roommateInstallPrompt = { prompt: promptEvent.prompt.bind(promptEvent) };
      setInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('join');
    if (code) { setJoinCode(code); setShowJoin(true); }
  }, [user?.id]);

  useEffect(() => { if (user) void refresh(); }, [user, refresh]);

  useEffect(() => {
    if (!me) return;
    let channel: ReturnType<Awaited<ReturnType<typeof supabase>>['channel']> | null = null;
    void (async () => {
      const db = await supabase();
      channel = db.channel(`notifications-${me.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notification_events', filter: `member_id=eq.${me.id}` }, (payload) => {
        const n = payload.new as Notice;
        setNotices((current) => [n, ...current.filter((x) => x.id !== n.id)].slice(0, 30));
        notify(`${n.title}: ${n.body}`);
        localNotify(n.title, n.body, n.id);
      }).subscribe();
    })();
    return () => { if (channel) void channel.unsubscribe(); };
  }, [me?.id, notify, localNotify]);

  useEffect(() => {
    if (!user || !me || !tasks.length) return;
    const check = () => {
      const now = Date.now();
      tasks.filter((t) => t.status === 'pending').forEach((t) => {
        const taskDay = new Date(`${t.duty_date}T12:00:00Z`).getUTCDay();
        const schedule = schedules.find((s) => s.member_id === t.member_id && s.weekday === taskDay);
        const reminder = (schedule?.reminder_minutes ?? 15) * 60_000;
        const escalation = (schedule?.escalation_minutes ?? 120) * 60_000;
        const due = new Date(t.due_at).getTime();
        const keys = [`rem:${room?.id}:${t.id}`, `due:${room?.id}:${t.id}`, `esc:${room?.id}:${t.id}`];
        const fire = (key: string, title: string, body: string) => { if (!localStorage.getItem(key)) { localStorage.setItem(key, '1'); localNotify(title, body, key); notify(body); } };
        if (now >= due - reminder && now < due && t.member_id === me.id) fire(keys[0], 'Cleaning reminder', 'Your bathroom cleaning duty starts soon.');
        if (now >= due && now < due + 60_000 && t.member_id === me.id) fire(keys[1], 'Cleaning duty is due', 'Please clean the bathroom and confirm completion.');
        if (now >= due + escalation && t.member_id !== me.id) fire(keys[2], 'Cleaning duty overdue', 'A scheduled cleaning duty has not been confirmed yet.');
      });
    };
    check(); const timer = window.setInterval(check, 30_000); return () => window.clearInterval(timer);
  }, [user, me?.id, tasks, schedules, room?.id, localNotify, notify]);

  const login = async () => {
    if (!email.trim()) return;
    setBusy(true); setError('');
    try {
      const db = await supabase();
      const redirect = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      const { error: e } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } });
      if (e) throw e;
      setLoginSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send the sign-in link.'); }
    finally { setBusy(false); }
  };

  const logout = async () => { const db = await supabase(); await db.auth.signOut(); setUser(null); setRoom(null); setRooms([]); setMembers([]); setSchedules([]); setTasks([]); setNotices([]); };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    setBusy(true);
    try {
      const db = await supabase();
      const { data, error: e } = await db.rpc('create_room', { p_name: roomName.trim(), p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka' });
      if (e) throw e;
      setRoomName(''); setShowAddRoom(false); notify('New household created ✓');
      const { data: next, error: nextError } = await db.from('rooms').select('id,name,owner_user_id,timezone').eq('id', data).single();
      if (nextError) throw nextError;
      setRooms((current) => [...current.filter((r) => r.id !== next.id), next]); setRoom(next); await loadRoom(next);
    } catch (e) { notify(e instanceof Error ? e.message : 'Unable to create household'); }
    finally { setBusy(false); }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const db = await supabase();
      const { data: joinedId, error: e } = await db.rpc('accept_room_invite', { p_code: joinCode.trim(), p_name: name.trim() || null });
      if (e) throw e;
      const { data: joined, error: joinedError } = await db.from('rooms').select('id,name,owner_user_id,timezone').eq('id', joinedId).single();
      if (joinedError || !joined) throw joinedError || new Error('Joined household could not be loaded.');
      setRooms((current) => [...current.filter((r) => r.id !== joined.id), joined]); setRoom(joined); setJoinCode(''); setShowJoin(false); notify('Joined household ✓');
      await loadRoom(joined);
      const url = new URL(window.location.href); url.searchParams.delete('join'); window.history.replaceState({}, '', url.toString());
    } catch (e) { notify(e instanceof Error ? e.message : 'Invalid or expired invite'); }
    finally { setBusy(false); }
  };

  const makeInvite = async () => {
    if (!room || !isAdmin) return;
    try { const db = await supabase(); const { data, error: e } = await db.rpc('create_room_invite', { p_room_id: room.id }); if (e) throw e; const link = `${window.location.origin}/?join=${data}`; setInvite(link); await navigator.clipboard?.writeText(link); notify('Invite link copied ✓'); }
    catch (e) { notify(e instanceof Error ? e.message : 'Unable to create invite'); }
  };

  const rotate = async () => {
    if (!room || !isAdmin || !active.length) return;
    setBusy(true);
    try {
      const db = await supabase(); const del = await db.from('cleaning_schedules').delete().eq('room_id', room.id); if (del.error) throw del.error;
      const start = zonedParts(room.timezone).weekday;
      const rows = active.map((m, i) => ({ room_id: room.id, member_id: m.id, weekday: (start + i) % 7, duty_time: dutyTime, reminder_minutes: 15, escalation_minutes: 120, duration_minutes: 15, title: 'Bathroom cleaning', active: true }));
      const q = await db.from('cleaning_schedules').insert(rows).select(); if (q.error) throw q.error;
      await db.rpc('ensure_room_tasks', { p_room_id: room.id, p_days: 14 }); setSchedules(q.data || []); notify('Weekly rotation generated ✓'); await loadRoom(room);
    } catch (e) { notify(e instanceof Error ? e.message : 'Unable to generate rotation'); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    if (!todayTask || !me || todayTask.member_id !== me.id) return;
    setBusy(true);
    try { const db = await supabase(); const { error: e } = await db.rpc('complete_cleaning_task', { p_task_id: todayTask.id, p_note: 'Confirmed from Roommate Cleaning Manager' }); if (e) throw e; notify('Cleaning confirmed ✓ — next duty has been notified.'); await loadRoom(room!); }
    catch (e) { notify(e instanceof Error ? e.message : 'Unable to confirm cleaning'); }
    finally { setBusy(false); }
  };

  const enableNotifications = async () => {
    try {
      if (!me) throw new Error('Your account is not linked to a roommate yet.');
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notifications are not supported by this browser.');
      const permission = await Notification.requestPermission(); if (permission !== 'granted') throw new Error('Notification permission was not granted.');
      const registration = await navigator.serviceWorker.ready;
      const response = await fetch('/api/push/config'); const config = await response.json();
      if (!config.publicKey) throw new Error('Push notification configuration is unavailable.');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(config.publicKey) });
      const json = subscription.toJSON(); if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Could not create push subscription.');
      const db = await supabase(); const { error: e } = await db.from('notification_subscriptions').upsert({ member_id: me.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint' }); if (e) throw e;
      notify('Notifications enabled ✓');
    } catch (e) { notify(e instanceof Error ? e.message : 'Unable to enable notifications'); }
  };

  const markRead = async (id: string) => {
    try {
      const db = await supabase();
      const { error: e } = await db.rpc('mark_notification_read', { p_notification_id: id });
      if (e) throw e;
      setNotices((x) => x.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (e) { notify(e instanceof Error ? e.message : 'Unable to mark notification as read'); }
  };

  const install = async () => { if (window.__roommateInstallPrompt) { await window.__roommateInstallPrompt.prompt(); window.__roommateInstallPrompt = undefined; setInstallPrompt(false); } };

  if (loading) return <main className="shell"><div className="card empty">Loading your cleaning manager…</div></main>;

  if (!user) return <main className="shell"><section className="auth-card"><div className="logo">RC</div><div className="eyebrow">ROOMMATE CLEANING MANAGER</div><h1>Keep the home clean. Keep it fair.</h1><p className="muted">Sign in with your email. No password to remember. Your household, schedules and confirmations stay tied to your account.</p>{loginSent ? <div className="success-box"><strong>Check your email</strong><p className="muted">We sent you a secure sign-in link. Open it on this device to continue.</p><button className="btn secondary" onClick={() => setLoginSent(false)}>Use another email</button></div> : <div className="form"><input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void login(); }}/><button className="btn primary" disabled={busy} onClick={()=>void login()}>{busy ? 'Sending…' : 'Send secure sign-in link'}</button></div>}{error&&<p className="error-text">{error}</p>}<div className="auth-foot"><span>🔒 Passwordless login</span><span>📱 Installable PWA</span><span>🔔 Smart alerts</span></div></section></main>;

  if (!room) return <main className="shell"><section className="auth-card"><div className="logo">RC</div><h1>Set up your household</h1><p className="muted">Create a new household or join one using an invite code.</p><div className="form"><input className="input" placeholder="Your display name" value={name} onChange={(e)=>setName(e.target.value)}/><input className="input" placeholder="Household name" value={roomName} onChange={(e)=>setRoomName(e.target.value)}/><button className="btn primary" disabled={busy} onClick={()=>void createRoom()}>Create household</button><div className="muted small" style={{textAlign:'center'}}>or</div><input className="input" placeholder="Invite code" value={joinCode} onChange={(e)=>setJoinCode(e.target.value)}/><button className="btn secondary" disabled={busy} onClick={()=>void joinRoom()}>Join household</button></div>{error&&<p className="error-text">{error}</p>}<button className="btn secondary" onClick={()=>void logout()}><LogOut size={16}/> Sign out</button></section></main>;

  const completionRate = tasks.length ? Math.round((tasks.filter((t)=>t.status==='completed').length / tasks.length) * 100) : 0;

  return <main className="shell">
    <header className="topbar"><div className="brand"><div className="logo">RC</div><div><strong>{room.name}</strong><div className="muted small">{user.email}</div></div></div><div className="row"><button className="btn secondary" onClick={()=>void refresh()}><RefreshCw size={16}/></button><button className="btn secondary" onClick={()=>void logout()}><LogOut size={16}/></button></div></header>
    <section className="hero"><div className="row"><Sparkles size={20}/><span className="small">TODAY · {days[day]}</span></div><h1>Keep it clean. Keep it fair.</h1><div className="muted">Automated duties, confirmations, reminders and accountability.</div><div className="stats"><div className="stat"><span className="small">Household</span><strong>{active.length}</strong></div><div className="stat"><span className="small">Completion</span><strong>{completionRate}%</strong></div><div className="stat"><span className="small">Alerts</span><strong>{unread}</strong></div></div></section>

    <div className="toolbar"><div className="row"><select className="input compact" value={room.id} onChange={(e)=>{const r=rooms.find((x)=>x.id===e.target.value);if(r){setRoom(r);void loadRoom(r)}}}>{rooms.map((r)=><option key={r.id} value={r.id}>{r.name}</option>)}</select><button className="btn secondary" onClick={()=>setShowAddRoom(true)}><Plus size={16}/> New</button><button className="btn secondary" onClick={()=>setShowJoin(true)}>Join</button></div><div className="row"><button className="btn secondary" onClick={()=>void enableNotifications()}><Bell size={16}/> Notifications</button>{installPrompt&&<button className="btn primary" onClick={()=>void install()}>Install app</button>}<button className="btn secondary" onClick={()=>setShowSettings(!showSettings)}><Settings size={16}/></button></div></div>

    {showAddRoom&&<section className="card modal-card"><div className="section-title"><h2>Create household</h2><button className="btn secondary" onClick={()=>setShowAddRoom(false)}>Close</button></div><div className="form"><input className="input" placeholder="Household name" value={roomName} onChange={(e)=>setRoomName(e.target.value)}/><button className="btn primary" disabled={busy} onClick={()=>void createRoom()}>Create</button></div></section>}
    {showJoin&&<section className="card modal-card"><div className="section-title"><h2>Join household</h2><button className="btn secondary" onClick={()=>setShowJoin(false)}>Close</button></div><div className="form"><input className="input" placeholder="Invite code" value={joinCode} onChange={(e)=>setJoinCode(e.target.value)}/><input className="input" placeholder="Display name" value={name} onChange={(e)=>setName(e.target.value)}/><button className="btn primary" disabled={busy} onClick={()=>void joinRoom()}>Join</button></div></section>}

    {showSettings&&<section className="card modal-card"><div className="section-title"><h2>Household settings</h2><button className="btn secondary" onClick={()=>setShowSettings(false)}>Close</button></div><p className="muted small">Timezone: {room.timezone}</p>{isAdmin&&<><div className="form"><label className="small">Duty time for weekly rotation<input className="input" type="time" value={dutyTime} onChange={(e)=>setDutyTime(e.target.value)}/></label><button className="btn primary" disabled={busy} onClick={()=>void rotate()}>Generate / reset weekly rotation</button></div><div className="invite-box"><strong>Invite roommates</strong><p className="muted small">Create a private join link. Share it only with people you trust.</p><button className="btn secondary" onClick={()=>void makeInvite()}><Share2 size={16}/> Create invite</button>{invite&&<div className="invite-link"><code>{invite}</code><button className="btn secondary" onClick={()=>navigator.clipboard?.writeText(invite)}><Copy size={15}/></button></div>}</div></>}</section>}

    <div className="grid">
      <section className="card"><div className="section-title"><div><h2>Today’s duty</h2><div className="muted small">Bathroom cleaning · {todaySchedule?.duty_time?.slice(0,5) || 'Not scheduled'}</div></div><span className={`badge ${todayTask?.status==='completed'?'done':todayTask?.status==='overdue'||todayTask?.status==='missed'?'late':'pending'}`}>{todayTask?.status || 'pending'}</span></div>{todayPerson?<div className="task"><div><strong>{todayPerson.name}</strong><div className="muted small"><Clock3 size={13}/> Reminder {todaySchedule?.reminder_minutes ?? 15} min before · Escalation {todaySchedule?.escalation_minutes ?? 120} min after</div>{todayTask?.completed_at&&<div className="muted small">Confirmed {new Date(todayTask.completed_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>}</div>{todayTask?.status==='completed'?<span className="badge done"><CheckCircle2 size={14}/> Done</span>:todayTask?.member_id===me?.id?<button disabled={busy} className="btn primary" onClick={()=>void complete()}><CheckCircle2 size={16}/> Confirm cleaning</button>:<span className="badge pending">Waiting for {todayPerson.name}</span>}</div>:<div className="empty">Add roommates and generate the weekly rotation.</div>}</section>

      <section className="card"><div className="section-title"><div><h2>Roommates</h2><div className="muted small">{active.length} active members</div></div>{isAdmin&&<button className="btn secondary" onClick={()=>setShowJoin(true)}><Plus size={16}/> Invite</button>}</div>{active.map((m)=><div className="member" key={m.id}><div className="row"><Users size={17}/><div><strong>{m.name}</strong><div className="muted small">{m.role==='admin'?'Household admin':'Roommate'}{m.email?` · ${m.email}`:''}</div></div></div>{isAdmin&&m.id!==me?.id&&<button className="btn danger" onClick={async()=>{const db=await supabase();const q=await db.from('members').update({active:false}).eq('id',m.id);if(q.error)notify(q.error.message);else{notify(`${m.name} removed`);await loadRoom(room)}}}><Trash2 size={15}/></button>}</div>)}</section>

      <section className="card"><div className="section-title"><div><h2>Weekly rotation</h2><div className="muted small">Automatic duty ownership</div></div>{isAdmin&&<button className="btn primary" disabled={busy||!active.length} onClick={()=>void rotate()}>Generate</button>}</div>{schedules.map((s)=><div className="member" key={s.id}><span>{days[s.weekday]}</span><strong>{active.find((m)=>m.id===s.member_id)?.name || '—'}</strong><span className="muted small">{s.duty_time.slice(0,5)}</span></div>)}{!schedules.length&&<div className="empty">No rotation yet.</div>}</section>

      <section className="card"><div className="section-title"><div><h2><Bell size={18}/> Notifications</h2><div className="muted small">Reminders, overdue alerts and next-duty updates</div></div>{unread>0&&<span className="badge late">{unread} unread</span>}</div>{notices.length?notices.slice(0,8).map((n)=><div className="task" key={n.id} onClick={()=>!n.read_at&&void markRead(n.id)}><div><strong>{n.title}</strong><div className="muted small">{n.body}</div><div className="muted small">{new Date(n.created_at).toLocaleString()}</div></div>{!n.read_at&&<span className="badge pending">New</span>}</div>):<div className="empty">You’re all caught up.</div>}</section>
    </div>

    <section className="card roadmap"><h2>Automation status</h2><div className="task"><span>Account & household isolation</span><span className="badge done">Active</span></div><div className="task"><span>Weekly task generation</span><span className="badge done">Active</span></div><div className="task"><span>Realtime in-app alerts</span><span className="badge done">Active</span></div><div className="task"><span>Browser notification subscription</span><span className="badge pending">Enable</span></div><div className="task"><span>Server-side background push engine</span><span className="badge done">Active</span></div></section>

    {error&&<div className="toast">{error}</div>}{toast&&<div className="toast">{toast}</div>}
  </main>;
}
