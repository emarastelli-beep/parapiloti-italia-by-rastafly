import React, { useEffect, useMemo, useState } from "react";
import { Wrench, Plus, CheckCircle2, AlertTriangle, Trash2, Settings2 } from "lucide-react";

export default function Equipment({ supabase, userId, onStatus }) {
  const [equipment, setEquipment] = useState([]);
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gearForm, setGearForm] = useState({ category: "Paramotore", name: "", model: "", consumption_lph: "3.5" });
  const [taskForm, setTaskForm] = useState({ equipment_id: "", title: "", interval_hours: "", interval_days: "", notes: "" });

  async function load() {
    if (!supabase || !userId) return;
    setLoading(true);
    const [g, m, e, f] = await Promise.all([
      supabase.from("pilot_equipment").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("maintenance_items").select("*,pilot_equipment(name,category)").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("maintenance_events").select("*,maintenance_items(title),pilot_equipment(name)").eq("user_id", userId).order("completed_at", { ascending: false }).limit(30),
      supabase.from("flight_sessions").select("started_at,ended_at").eq("pilot_id", userId).not("ended_at", "is", null)
    ]);
    if (g.error || m.error || e.error) onStatus?.("Errore caricamento attrezzatura/manutenzione: " + (g.error || m.error || e.error).message);
    setEquipment(g.data || []); setItems(m.data || []); setEvents(e.data || []);
    const ms = (f.data || []).reduce((sum, x) => sum + Math.max(0, new Date(x.ended_at) - new Date(x.started_at)), 0);
    setTotalHours(ms / 3600000);
    setLoading(false);
  }
  useEffect(() => { load(); }, [userId]);

  const alerts = useMemo(() => items.filter(x => {
    const byDate = x.next_due_at && new Date(x.next_due_at) <= new Date();
    const byHours = x.next_due_flight_hours != null && totalHours >= Number(x.next_due_flight_hours);
    return byDate || byHours;
  }), [items, totalHours]);

  async function addEquipment(e) {
    e.preventDefault();
    const { error } = await supabase.from("pilot_equipment").insert({ user_id: userId, ...gearForm, consumption_lph: Number(gearForm.consumption_lph) || 0 });
    if (error) onStatus?.(error.message);
    else { setGearForm({ category: "Paramotore", name: "", model: "", consumption_lph: "3.5" }); onStatus?.("Attrezzatura salvata."); load(); }
  }
  async function addTask(e) {
    e.preventDefault();
    const { error } = await supabase.from("maintenance_items").insert({
      user_id: userId, equipment_id: taskForm.equipment_id || null, title: taskForm.title,
      interval_hours: taskForm.interval_hours ? Number(taskForm.interval_hours) : null,
      interval_days: taskForm.interval_days ? Number(taskForm.interval_days) : null, notes: taskForm.notes,
      next_due_flight_hours: taskForm.interval_hours ? totalHours + Number(taskForm.interval_hours) : null,
      next_due_at: taskForm.interval_days ? new Date(Date.now() + Number(taskForm.interval_days) * 86400000).toISOString() : null
    });
    if (error) onStatus?.(error.message);
    else { setTaskForm({ equipment_id: "", title: "", interval_hours: "", interval_days: "", notes: "" }); onStatus?.("Scadenza manutenzione aggiunta."); load(); }
  }
  async function completeTask(item) {
    const doneAt = new Date().toISOString();
    const updates = {
      last_done_at: doneAt, last_done_flight_hours: totalHours,
      next_due_flight_hours: item.interval_hours ? totalHours + Number(item.interval_hours) : null,
      next_due_at: item.interval_days ? new Date(Date.now() + Number(item.interval_days) * 86400000).toISOString() : null
    };
    const { error: eventError } = await supabase.from("maintenance_events").insert({
      user_id: userId, maintenance_item_id: item.id, equipment_id: item.equipment_id,
      title: item.title, completed_at: doneAt, flight_hours_at_completion: totalHours, notes: item.notes
    });
    if (eventError) { onStatus?.(eventError.message); return; }
    const { error } = await supabase.from("maintenance_items").update(updates).eq("id", item.id).eq("user_id", userId);
    if (error) onStatus?.(error.message); else { onStatus?.("Manutenzione registrata nello storico."); load(); }
  }
  async function removeEquipment(id) {
    if (!window.confirm("Eliminare questa attrezzatura e le relative scadenze?")) return;
    const { error } = await supabase.from("pilot_equipment").delete().eq("id", id).eq("user_id", userId);
    if (error) onStatus?.(error.message); else load();
  }

  if (!supabase || !userId) return <div className="notice">Accedi per gestire attrezzatura e manutenzioni.</div>;
  if (loading) return <p>Caricamento attrezzatura...</p>;
  return <div className="equipment-page">
    <div className="panel-heading"><div><div className="eyebrow dark">AREA TECNICA</div><h2>Attrezzatura e manutenzione</h2><p>La tua attrezzatura, le ore volo e le scadenze in un unico posto.</p></div><Wrench /></div>
    <div className="equipment-summary"><div><b>{totalHours.toFixed(1)} h</b><span>Ore di volo registrate</span></div><div><b>{equipment.length}</b><span>Attrezzature</span></div><div><b>{alerts.length}</b><span>Manutenzioni scadute</span></div></div>
    {alerts.length > 0 && <div className="maintenance-alert"><AlertTriangle/><div><b>Attenzione: manutenzione da verificare</b><span>{alerts.map(x => x.title).join(" · ")}</span></div></div>}
    <section className="equipment-section"><h3><Settings2 size={18}/> La mia attrezzatura</h3>
      {equipment.map(g => <div className="equipment-row" key={g.id}><div><b>{g.name}</b><span>{g.category} {g.model ? "· " + g.model : ""}{g.category === "Paramotore" ? " · " + Number(g.consumption_lph || 0).toFixed(1) + " L/h" : ""}</span></div><button className="icon-btn" onClick={() => removeEquipment(g.id)} aria-label="Elimina attrezzatura"><Trash2 size={16}/></button></div>)}
      <form className="equipment-form" onSubmit={addEquipment}>
        <select value={gearForm.category} onChange={e => setGearForm({...gearForm,category:e.target.value})}><option>Paramotore</option><option>Vela</option><option>Casco</option><option>Strumentazione</option><option>Altro</option></select>
        <input required placeholder="Nome (es. Vittorazi Moster)" value={gearForm.name} onChange={e => setGearForm({...gearForm,name:e.target.value})}/>
        <input placeholder="Modello / note" value={gearForm.model} onChange={e => setGearForm({...gearForm,model:e.target.value})}/>
        {gearForm.category === "Paramotore" && <input type="number" min="0" step="0.1" aria-label="Consumo litri ora" placeholder="L/h" value={gearForm.consumption_lph} onChange={e => setGearForm({...gearForm,consumption_lph:e.target.value})}/>}
        <button className="primary-btn" type="submit"><Plus size={16}/> Aggiungi</button>
      </form>
    </section>
    <section className="equipment-section"><h3><Wrench size={18}/> Piano manutenzioni</h3>
      {items.map(item => {
        const dueDate = item.next_due_at ? new Date(item.next_due_at) : null;
        const overdue = alerts.some(a => a.id === item.id);
        return <div className="maintenance-row" key={item.id}><div className="maintenance-row-main"><b>{item.title}</b><span>{item.pilot_equipment?.name || "Attrezzatura"} · {item.interval_hours ? "ogni " + item.interval_hours + " h volo" : ""}{item.interval_days ? " · ogni " + item.interval_days + " giorni" : ""}</span><small>{overdue ? "SCADUTA / DA CONTROLLARE" : "Prossima scadenza: " + (dueDate ? dueDate.toLocaleDateString("it-IT") : item.next_due_flight_hours != null ? item.next_due_flight_hours.toFixed(1) + " h volo" : "non impostata")}</small></div><button className="outline-btn" onClick={() => completeTask(item)}><CheckCircle2 size={15}/> Eseguita</button></div>;
      })}
      <form className="equipment-form maintenance-form" onSubmit={addTask}>
        <input required placeholder="Intervento (es. candela, riduttore...)" value={taskForm.title} onChange={e => setTaskForm({...taskForm,title:e.target.value})}/>
        <select value={taskForm.equipment_id} onChange={e => setTaskForm({...taskForm,equipment_id:e.target.value})}><option value="">Attrezzatura (facoltativa)</option>{equipment.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <input type="number" min="1" step="1" placeholder="Intervallo ore volo" value={taskForm.interval_hours} onChange={e => setTaskForm({...taskForm,interval_hours:e.target.value})}/>
        <input type="number" min="1" step="1" placeholder="Intervallo giorni" value={taskForm.interval_days} onChange={e => setTaskForm({...taskForm,interval_days:e.target.value})}/>
        <input placeholder="Note (facoltative)" value={taskForm.notes} onChange={e => setTaskForm({...taskForm,notes:e.target.value})}/>
        <button className="primary-btn" type="submit"><Plus size={16}/> Aggiungi scadenza</button>
      </form>
    </section>
    <section className="equipment-section"><h3><CheckCircle2 size={18}/> Storico manutenzioni</h3>
      {events.length === 0 ? <p className="muted">Gli interventi completati compariranno qui.</p> : events.map(ev => <div className="equipment-row" key={ev.id}><div><b>{ev.title || ev.maintenance_items?.title}</b><span>{new Date(ev.completed_at).toLocaleString("it-IT")} · {Number(ev.flight_hours_at_completion || 0).toFixed(1)} ore totali</span></div></div>)}
    </section>
    <p className="equipment-footnote">Le scadenze sono promemoria personali: verifica sempre gli intervalli prescritti dal costruttore e dal manuale della tua attrezzatura.</p>
  </div>;
}
