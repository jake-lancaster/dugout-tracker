import { useState, useEffect, useRef } from "react";

const PLAYERS_INIT = [
  { id: "billy", name: "Billy", bats: "R", power: "High", consistency: "High", speed: "High" },
  { id: "crawford", name: "Crawford", bats: "R", power: "Med", consistency: "High", speed: "High" },
  { id: "davis", name: "Davis", bats: "L", power: "High", consistency: "Med", speed: "Low" },
  { id: "haile", name: "Haile", bats: "R", power: "Low", consistency: "Med", speed: "High" },
  { id: "james", name: "James", bats: "R", power: "Low", consistency: "Low", speed: "Low" },
  { id: "kit", name: "Kit", bats: "R", power: "Low", consistency: "Med", speed: "High" },
  { id: "stewart", name: "Stewart", bats: "R", power: "Low", consistency: "Med", speed: "Low" },
  { id: "thomas", name: "Thomas", bats: "L", power: "Med", consistency: "Med", speed: "High" },
  { id: "trow", name: "Trow", bats: "R", power: "High", consistency: "Med", speed: "Low" },
  { id: "wilder", name: "Wilder", bats: "R", power: "Med", consistency: "Med", speed: "High" },
  { id: "willie", name: "Willie", bats: "R", power: "Low", consistency: "Low", speed: "High" },
];

const DEFAULT_ORDER = ["crawford","billy","thomas","davis","trow","wilder","kit","haile","willie","stewart","james"];
const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "LCF", "RCF", "RF", "SIT"];
const BAT_RESULTS = ["1B", "2B", "3B", "HR", "K", "GO", "FO", "FC", "E"];
const FIELD_GRADES = ["\u2713", "\u2605", "X", "\u2014", "?"];
const FIELD_GRADE_LABELS = { "\u2713": "Routine", "\u2605": "Great", "X": "Error", "\u2014": "No action", "?": "Mental lapse" };

// ─── Storage with robust save/load ───
const STORAGE_KEY = "cpbt-all-data-v2";

function loadAllData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error("Load failed:", e); }
  return null;
}

function saveAllData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.error("Save failed:", e); }
}

const TABS = [
  { id: "gameday", label: "Game Day", icon: "\u26be" },
  { id: "season", label: "Season", icon: "\ud83d\udcca" },
  { id: "roster", label: "Roster", icon: "\ud83d\udc65" },
  { id: "rotation", label: "Rotation", icon: "\ud83d\udd04" },
];

const btnBase = { border: "none", cursor: "pointer", fontFamily: "inherit" };
const headingStyle = { margin: 0, fontFamily: "'Archivo Black', sans-serif" };

// ─── Inning Scoreboard ───
function InningScoreboard({ game, setGame }) {
  const runs = game.runsPerInning || {};
  const setRuns = (inning, team, value) => {
    const key = `${team}-${inning}`;
    const updated = { ...runs, [key]: Math.max(0, parseInt(value) || 0) };
    // Recalculate totals
    let ourTotal = 0, theirTotal = 0;
    for (let i = 1; i <= 5; i++) {
      ourTotal += updated[`us-${i}`] || 0;
      theirTotal += updated[`them-${i}`] || 0;
    }
    setGame({ ...game, runsPerInning: updated, ourScore: ourTotal, theirScore: theirTotal });
  };
  const getRuns = (team, inning) => runs[`${team}-${inning}`] || 0;
  const ourTotal = [1,2,3,4,5].reduce((s, i) => s + getRuns("us", i), 0);
  const theirTotal = [1,2,3,4,5].reduce((s, i) => s + getRuns("them", i), 0);

  return (
    <div style={{ marginBottom: 14 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "center" }}>
        <thead>
          <tr>
            <th style={{ padding: 4, textAlign: "left", color: "var(--text-dim)", fontWeight: 700 }}></th>
            {[1,2,3,4,5].map(i => <th key={i} style={{ padding: 4, color: "var(--text-dim)", fontWeight: 700 }}>I{i}</th>)}
            <th style={{ padding: 4, color: "var(--accent)", fontWeight: 700 }}>R</th>
          </tr>
        </thead>
        <tbody>
          {[{label: "Us", team: "us"}, {label: "Them", team: "them"}].map(row => (
            <tr key={row.team}>
              <td style={{ padding: 4, textAlign: "left", fontWeight: 700, color: "var(--text)", fontSize: 11 }}>{row.label}</td>
              {[1,2,3,4,5].map(i => (
                <td key={i} style={{ padding: 2 }}>
                  <input type="number" min={0} max={5} value={getRuns(row.team, i)}
                    onChange={(e) => setRuns(i, row.team, e.target.value)}
                    style={{ width: 28, padding: 2, textAlign: "center", borderRadius: 4, border: "1px solid var(--border)",
                      background: "var(--card)", color: "var(--text)", fontSize: 12, fontWeight: 700 }} />
                </td>
              ))}
              <td style={{ padding: 4, fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>
                {row.team === "us" ? ourTotal : theirTotal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Lineup & Attendance Panel ───
function LineupPanel({ game, setGame, players }) {
  const battingOrder = game.battingOrder || DEFAULT_ORDER;
  const absent = game.absent || [];
  const moveUp = (idx) => {
    if (idx === 0) return;
    const n = [...battingOrder]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]];
    setGame({ ...game, battingOrder: n });
  };
  const moveDown = (idx) => {
    if (idx >= battingOrder.length - 1) return;
    const n = [...battingOrder]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]];
    setGame({ ...game, battingOrder: n });
  };
  const toggleAbsent = (pid) => {
    const n = absent.includes(pid) ? absent.filter(id => id !== pid) : [...absent, pid];
    setGame({ ...game, absent: n });
  };
  const activeCount = battingOrder.filter(pid => !absent.includes(pid)).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h3 style={{ ...headingStyle, fontSize: 16, color: "var(--accent)" }}>LINEUP & ATTENDANCE</h3>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>{activeCount} active</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>Arrows to reorder. OUT to mark absent.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {battingOrder.map((pid, idx) => {
          const p = players.find(pl => pl.id === pid);
          if (!p) return null;
          const isOut = absent.includes(pid);
          const activeIdx = isOut ? null : battingOrder.slice(0, idx + 1).filter(id => !absent.includes(id)).length;
          return (
            <div key={pid} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", borderRadius: 8,
              background: isOut ? "var(--out-bg)" : "var(--card)", opacity: isOut ? 0.6 : 1, border: "2px solid transparent" }}>
              <span style={{ width: 22, fontSize: 12, fontWeight: 700, textAlign: "center",
                color: isOut ? "var(--out-text)" : "var(--text-dim)" }}>{isOut ? "\u2014" : `#${activeIdx}`}</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: isOut ? "var(--out-text)" : "var(--text)",
                textDecoration: isOut ? "line-through" : "none" }}>
                {p.name}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4,
                  color: p.bats === "L" ? "var(--accent)" : "var(--text-dim)" }}>({p.bats})</span>
              </span>
              <button onClick={() => moveUp(idx)} disabled={idx === 0}
                style={{ ...btnBase, width: 28, height: 28, borderRadius: 6, fontSize: 14, fontWeight: 700,
                  background: "var(--tag-bg)", color: idx === 0 ? "var(--border)" : "var(--text-dim)" }}>{"\u2191"}</button>
              <button onClick={() => moveDown(idx)} disabled={idx >= battingOrder.length - 1}
                style={{ ...btnBase, width: 28, height: 28, borderRadius: 6, fontSize: 14, fontWeight: 700,
                  background: "var(--tag-bg)", color: idx >= battingOrder.length - 1 ? "var(--border)" : "var(--text-dim)" }}>{"\u2193"}</button>
              <button onClick={() => toggleAbsent(pid)}
                style={{ ...btnBase, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: isOut ? "var(--hit-bg)" : "var(--out-bg)", color: isOut ? "var(--hit-text)" : "var(--out-text)" }}>
                {isOut ? "IN" : "OUT"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Batting Panel (scoped to current inning) ───
function BattingPanel({ game, setGame, players }) {
  const [selPlayer, setSelPlayer] = useState(null);
  const [rbiCount, setRbiCount] = useState(0);
  const inning = game.currentInning || 1;
  const absent = game.absent || [];
  const battingOrder = (game.battingOrder || DEFAULT_ORDER).filter(pid => !absent.includes(pid));

  // Only this inning's ABs
  const getInningABs = (pid) => (game.batting || []).filter(b => b.playerId === pid && b.inning === inning);
  // All game ABs for summary line
  const getAllABs = (pid) => (game.batting || []).filter(b => b.playerId === pid);

  const recordAB = (result) => {
    if (!selPlayer) return;
    const ab = { playerId: selPlayer, inning, result, rbis: rbiCount, ts: Date.now() };
    setGame({ ...game, batting: [...(game.batting || []), ab] });
    setSelPlayer(null);
    setRbiCount(0);
  };

  const undoLast = (pid) => {
    // Only undo from current inning
    const allBatting = [...(game.batting || [])];
    for (let i = allBatting.length - 1; i >= 0; i--) {
      if (allBatting[i].playerId === pid && allBatting[i].inning === inning) {
        allBatting.splice(i, 1);
        break;
      }
    }
    setGame({ ...game, batting: allBatting });
  };

  // Count inning runs
  const inningRuns = (game.batting || []).filter(b => b.inning === inning).reduce((s, b) => s + (b.rbis || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ ...headingStyle, fontSize: 16, color: "var(--accent)" }}>BATTING \u2014 INNING {inning}</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {[1,2,3,4,5].map(i => (
            <button key={i} onClick={() => { setGame({ ...game, currentInning: i }); setSelPlayer(null); }}
              style={{ ...btnBase, width: 32, height: 32, borderRadius: "50%", fontWeight: 700, fontSize: 13,
                background: inning === i ? "var(--accent)" : "var(--card)", color: inning === i ? "#fff" : "var(--text-dim)" }}>{i}</button>
          ))}
        </div>
      </div>

      <InningScoreboard game={game} setGame={setGame} />

      {absent.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8, padding: "4px 8px", background: "var(--out-bg)", borderRadius: 6 }}>
          Out: {absent.map(pid => players.find(p => p.id === pid)?.name).filter(Boolean).join(", ")}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {battingOrder.map((pid, idx) => {
          const p = players.find(pl => pl.id === pid);
          if (!p) return null;
          const inningABs = getInningABs(pid);
          const allABs = getAllABs(pid);
          const allHits = allABs.filter(b => ["1B","2B","3B","HR"].includes(b.result)).length;
          const isSelected = selPlayer === pid;
          return (
            <div key={pid} onClick={() => setSelPlayer(isSelected ? null : pid)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                background: isSelected ? "var(--accent-dim)" : "var(--card)", cursor: "pointer",
                border: isSelected ? "2px solid var(--accent)" : "2px solid transparent" }}>
              <span style={{ width: 22, fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>#{idx + 1}</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                {p.name} <span style={{ fontSize: 11, color: p.bats === "L" ? "var(--accent)" : "var(--text-dim)", fontWeight: 400 }}>({p.bats})</span>
              </span>
              {/* This inning's ABs */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {inningABs.map((ab, i) => (
                  <span key={i} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 600,
                    background: ["1B","2B","3B","HR"].includes(ab.result) ? "var(--hit-bg)" : ab.result === "E" ? "var(--reach-bg)" : "var(--out-bg)",
                    color: ["1B","2B","3B","HR"].includes(ab.result) ? "var(--hit-text)" : ab.result === "E" ? "var(--reach-text)" : "var(--out-text)" }}>
                    {ab.result}{ab.rbis > 0 ? `/${ab.rbis}` : ""}
                  </span>
                ))}
              </div>
              {/* Game total mini */}
              {allABs.length > 0 && (
                <span style={{ fontSize: 10, color: "var(--text-dim)", minWidth: 28, textAlign: "right" }}>{allHits}-{allABs.length}</span>
              )}
              {inningABs.length > 0 && (
                <button onClick={(e) => { e.stopPropagation(); undoLast(pid); }}
                  style={{ ...btnBase, fontSize: 10, padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4,
                    background: "transparent", color: "var(--text-dim)" }}>{"\u21a9"}</button>
              )}
            </div>
          );
        })}
      </div>

      {selPlayer && (
        <div style={{ marginTop: 12, padding: 12, background: "var(--card)", borderRadius: 10, border: "2px solid var(--accent)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--accent)" }}>
            {players.find(p => p.id === selPlayer)?.name} \u2014 Record AB:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {BAT_RESULTS.map(r => {
              const isHit = ["1B", "2B", "3B", "HR"].includes(r);
              return (
                <button key={r} onClick={() => recordAB(r)}
                  style={{ ...btnBase, padding: "8px 14px", borderRadius: 6, fontWeight: 700, fontSize: 13,
                    background: isHit ? "var(--hit-bg)" : r === "E" ? "var(--reach-bg)" : "var(--out-bg)",
                    color: isHit ? "var(--hit-text)" : r === "E" ? "var(--reach-text)" : "var(--out-text)" }}>{r}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>RBIs:</span>
            {[0,1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRbiCount(n)}
                style={{ ...btnBase, width: 28, height: 28, borderRadius: "50%", fontWeight: 700, fontSize: 12,
                  background: rbiCount === n ? "var(--accent)" : "var(--tag-bg)", color: rbiCount === n ? "#fff" : "var(--text-dim)" }}>{n}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fielding Panel (scoped to current inning only) ───
function FieldingPanel({ game, setGame, players }) {
  const inning = game.currentFieldInning || 1;
  const fielding = game.fielding || {};
  const absent = game.absent || [];
  const activePlayers = players.filter(p => !absent.includes(p.id));
  const [editPlayer, setEditPlayer] = useState(null);
  const [editMode, setEditMode] = useState(null);

  const getAssignment = (pid, inn) => fielding[`${pid}-${inn}`] || { position: "", grade: "" };
  const setAssignment = (pid, inn, field, value) => {
    const key = `${pid}-${inn}`;
    const current = fielding[key] || { position: "", grade: "" };
    setGame({ ...game, fielding: { ...fielding, [key]: { ...current, [field]: value } } });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ ...headingStyle, fontSize: 16, color: "var(--accent)" }}>FIELDING \u2014 INNING {inning}</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {[1,2,3,4,5].map(i => (
            <button key={i} onClick={() => { setGame({ ...game, currentFieldInning: i }); setEditPlayer(null); }}
              style={{ ...btnBase, width: 32, height: 32, borderRadius: "50%", fontWeight: 700, fontSize: 13,
                background: inning === i ? "var(--accent)" : "var(--card)", color: inning === i ? "#fff" : "var(--text-dim)" }}>{i}</button>
          ))}
        </div>
      </div>

      <InningScoreboard game={game} setGame={setGame} />

      {absent.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8, padding: "4px 8px", background: "var(--out-bg)", borderRadius: 6 }}>
          Out: {absent.map(pid => players.find(p => p.id === pid)?.name).filter(Boolean).join(", ")}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {activePlayers.map(p => {
          const a = getAssignment(p.id, inning);
          const isEditing = editPlayer === p.id;
          return (
            <div key={p.id}>
              <div onClick={() => { setEditPlayer(isEditing ? null : p.id); setEditMode("position"); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                  background: isEditing ? "var(--accent-dim)" : "var(--card)", cursor: "pointer",
                  border: isEditing ? "2px solid var(--accent)" : "2px solid transparent" }}>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{p.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: a.position === "SIT" ? "var(--out-bg)" : a.position ? "var(--tag-bg)" : "transparent",
                  color: a.position === "SIT" ? "var(--out-text)" : a.position ? "var(--text)" : "var(--text-dim)" }}>
                  {a.position || "\u2014"}
                </span>
                <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{a.grade || "\u00b7"}</span>
              </div>
              {isEditing && (
                <div style={{ padding: "8px 10px", background: "var(--card)", borderRadius: "0 0 8px 8px", marginTop: -2, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                    <button onClick={() => setEditMode("position")}
                      style={{ ...btnBase, fontSize: 11, padding: "3px 8px", borderRadius: 4, fontWeight: 600,
                        background: editMode === "position" ? "var(--accent)" : "var(--tag-bg)",
                        color: editMode === "position" ? "#fff" : "var(--text-dim)" }}>Position</button>
                    <button onClick={() => setEditMode("grade")}
                      style={{ ...btnBase, fontSize: 11, padding: "3px 8px", borderRadius: 4, fontWeight: 600,
                        background: editMode === "grade" ? "var(--accent)" : "var(--tag-bg)",
                        color: editMode === "grade" ? "#fff" : "var(--text-dim)" }}>Grade</button>
                  </div>
                  {editMode === "position" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {POSITIONS.map(pos => (
                        <button key={pos} onClick={() => { setAssignment(p.id, inning, "position", pos); setEditMode("grade"); }}
                          style={{ ...btnBase, padding: "6px 10px", borderRadius: 5, fontWeight: 700, fontSize: 12,
                            background: a.position === pos ? "var(--accent)" : "var(--tag-bg)",
                            color: a.position === pos ? "#fff" : "var(--text)" }}>{pos}</button>
                      ))}
                    </div>
                  )}
                  {editMode === "grade" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {FIELD_GRADES.map(g => (
                        <button key={g} onClick={() => { setAssignment(p.id, inning, "grade", g); setEditPlayer(null); }}
                          style={{ ...btnBase, padding: "6px 12px", borderRadius: 5, fontWeight: 700, fontSize: 14,
                            background: a.grade === g ? "var(--accent)" : "var(--tag-bg)",
                            color: a.grade === g ? "#fff" : "var(--text)" }}>
                          {g} <span style={{ fontSize: 10, fontWeight: 400 }}>{FIELD_GRADE_LABELS[g]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Game Notes ───
function GameNotesPanel({ game, setGame }) {
  return (
    <div>
      <h3 style={{ ...headingStyle, fontSize: 16, color: "var(--accent)", marginBottom: 12 }}>GAME NOTES</h3>
      {["Biggest surprise", "Biggest concern", "Change for next game", "General notes"].map(label => (
        <div key={label} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>{label}</label>
          <textarea value={(game.notes || {})[label] || ""} placeholder={`${label}...`}
            onChange={(e) => setGame({ ...game, notes: { ...(game.notes || {}), [label]: e.target.value } })}
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)",
              color: "var(--text)", fontSize: 13, minHeight: 50, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
      ))}
    </div>
  );
}

// ─── Summary & Recommendations ───
function SummaryPanel({ game, allGames, players }) {
  const absent = game.absent || [];
  const activePlayers = players.filter(p => !absent.includes(p.id));
  const batting = game.batting || [];
  const fielding = game.fielding || {};
  const runs = game.runsPerInning || {};

  const playerBatStats = activePlayers.map(p => {
    const abs = batting.filter(b => b.playerId === p.id);
    const hits = abs.filter(b => ["1B","2B","3B","HR"].includes(b.result));
    const xbh = abs.filter(b => ["2B","3B","HR"].includes(b.result)).length;
    const rbis = abs.reduce((s, b) => s + (b.rbis || 0), 0);
    const ks = abs.filter(b => b.result === "K").length;
    const avg = abs.length > 0 ? (hits.length / abs.length) : 0;
    const results = abs.map(a => a.result);
    return { ...p, abs: abs.length, hits: hits.length, xbh, rbis, ks, avg, results };
  });

  const teamABs = playerBatStats.reduce((s, p) => s + p.abs, 0);
  const teamHits = playerBatStats.reduce((s, p) => s + p.hits, 0);
  const teamRBIs = playerBatStats.reduce((s, p) => s + p.rbis, 0);
  const teamKs = playerBatStats.reduce((s, p) => s + p.ks, 0);
  const teamAvg = teamABs > 0 ? (teamHits / teamABs).toFixed(3) : ".000";

  const playerFieldStats = activePlayers.map(p => {
    const entries = [];
    const posGrades = {};
    for (let inn = 1; inn <= 5; inn++) {
      const val = fielding[`${p.id}-${inn}`];
      if (val && val.position) {
        entries.push({ ...val, inning: inn });
        if (val.position !== "SIT" && val.grade) {
          if (!posGrades[val.position]) posGrades[val.position] = [];
          posGrades[val.position].push(val.grade);
        }
      }
    }
    return { ...p, entries, posGrades,
      great: entries.filter(e => e.grade === "\u2605").length,
      errs: entries.filter(e => e.grade === "X").length,
      lapses: entries.filter(e => e.grade === "?").length,
      satOut: entries.filter(e => e.position === "SIT").length };
  });

  const batScored = playerBatStats.map(p => ({
    ...p, score: (p.hits * 2) + (p.xbh) + (p.rbis) - (p.ks)
  }));
  const hotHitters = batScored.filter(p => p.score >= 3 && p.abs >= 2).sort((a, b) => b.score - a.score);
  const coldHitters = batScored.filter(p => p.score <= 0 && p.abs >= 2).sort((a, b) => a.score - b.score);

  const currentOrder = (game.battingOrder || DEFAULT_ORDER).filter(pid => !absent.includes(pid));
  const suggestedOrder = [...currentOrder];
  hotHitters.forEach(h => { const idx = suggestedOrder.indexOf(h.id); if (idx > 2) { suggestedOrder.splice(idx, 1); suggestedOrder.splice(Math.max(1, idx - 2), 0, h.id); } });
  coldHitters.forEach(c => { const idx = suggestedOrder.indexOf(c.id); if (idx >= 0 && idx < suggestedOrder.length - 2) { suggestedOrder.splice(idx, 1); suggestedOrder.splice(Math.min(suggestedOrder.length, idx + 2), 0, c.id); } });

  const fieldRecs = [];
  playerFieldStats.forEach(p => {
    if (p.great > 0) fieldRecs.push({ name: p.name, type: "star", msg: `great at ${Object.entries(p.posGrades).filter(([,g]) => g.includes("\u2605")).map(([pos]) => pos).join(", ")}` });
    if (p.errs > 0) fieldRecs.push({ name: p.name, type: "error", msg: `struggled at ${Object.entries(p.posGrades).filter(([,g]) => g.includes("X")).map(([pos]) => pos).join(", ")}` });
    if (p.lapses > 0) fieldRecs.push({ name: p.name, type: "lapse", msg: `mental lapse at ${Object.entries(p.posGrades).filter(([,g]) => g.includes("?")).map(([pos]) => pos).join(", ")}` });
  });

  const sitCounts = {};
  players.forEach(p => { sitCounts[p.id] = 0; });
  allGames.forEach(g => {
    const gf = g.fielding || {};
    players.forEach(p => { for (let i = 1; i <= 5; i++) { if (gf[`${p.id}-${i}`]?.position === "SIT") sitCounts[p.id]++; } });
    (g.absent || []).forEach(pid => { sitCounts[pid] = (sitCounts[pid] || 0) + 5; });
  });
  const sitSorted = players.map(p => ({ ...p, sits: sitCounts[p.id] || 0 })).sort((a, b) => a.sits - b.sits);

  const cardStyle = { padding: "8px 10px", background: "var(--card)", borderRadius: 8, marginBottom: 4 };

  return (
    <div>
      <h3 style={{ ...headingStyle, fontSize: 16, color: "var(--accent)", marginBottom: 4 }}>GAME SUMMARY</h3>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        vs {game.opponent} \u00b7 {game.ourScore || 0} - {game.theirScore || 0}
        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 8,
          color: (game.ourScore || 0) >= (game.theirScore || 0) ? "var(--hit-text)" : "var(--out-text)" }}>
          {(game.ourScore || 0) > (game.theirScore || 0) ? "WIN" : (game.ourScore || 0) < (game.theirScore || 0) ? "LOSS" : "TIE"}
        </span>
      </div>

      {/* Inning-by-inning score */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "center" }}>
          <thead><tr>
            <th style={{ textAlign: "left", color: "var(--text-dim)", padding: 2 }}></th>
            {[1,2,3,4,5].map(i => <th key={i} style={{ color: "var(--text-dim)", padding: 2 }}>I{i}</th>)}
            <th style={{ color: "var(--accent)", padding: 2 }}>R</th>
          </tr></thead>
          <tbody>
            {[{l:"Us",t:"us"},{l:"Them",t:"them"}].map(r => (
              <tr key={r.t}>
                <td style={{ textAlign: "left", fontWeight: 700, color: "var(--text)", padding: 2 }}>{r.l}</td>
                {[1,2,3,4,5].map(i => <td key={i} style={{ padding: 2, color: "var(--text-dim)" }}>{runs[`${r.t}-${i}`] || 0}</td>)}
                <td style={{ fontWeight: 700, color: "var(--accent)", padding: 2 }}>{r.t === "us" ? game.ourScore || 0 : game.theirScore || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Team batting */}
      <div style={{ ...cardStyle, display: "flex", gap: 16, fontSize: 12, marginBottom: 14 }}>
        <span>AB: <strong>{teamABs}</strong></span>
        <span>H: <strong>{teamHits}</strong></span>
        <span>AVG: <strong style={{ color: "var(--accent)" }}>{teamAvg}</strong></span>
        <span>RBI: <strong>{teamRBIs}</strong></span>
        <span>K: <strong>{teamKs}</strong></span>
      </div>

      {/* Individual batting */}
      {[...playerBatStats].sort((a, b) => b.avg - a.avg || b.hits - a.hits).map(p => (
        <div key={p.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 70, fontWeight: 700, color: "var(--text)" }}>{p.name}</span>
          <span style={{ color: "var(--text-dim)" }}>{p.hits}-{p.abs}</span>
          <span style={{ fontWeight: 700, color: "var(--accent)" }}>{p.abs > 0 ? p.avg.toFixed(3) : ".000"}</span>
          {p.rbis > 0 && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--hit-bg)", color: "var(--hit-text)" }}>{p.rbis}RBI</span>}
          {p.ks > 0 && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--out-bg)", color: "var(--out-text)" }}>{p.ks}K</span>}
          <div style={{ flex: 1, display: "flex", gap: 3, justifyContent: "flex-end" }}>
            {p.results.map((r, i) => (
              <span key={i} style={{ fontSize: 10, padding: "1px 4px", borderRadius: 3, fontWeight: 600,
                background: ["1B","2B","3B","HR"].includes(r) ? "var(--hit-bg)" : r === "E" ? "var(--reach-bg)" : "var(--out-bg)",
                color: ["1B","2B","3B","HR"].includes(r) ? "var(--hit-text)" : r === "E" ? "var(--reach-text)" : "var(--out-text)" }}>{r}</span>
            ))}
          </div>
        </div>
      ))}

      {/* Next game recs */}
      <div style={{ borderTop: "2px solid var(--accent)", paddingTop: 16, marginTop: 16 }}>
        <h3 style={{ ...headingStyle, fontSize: 16, color: "var(--accent)", marginBottom: 12 }}>NEXT GAME RECOMMENDATIONS</h3>

        {hotHitters.length > 0 && <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--hit-text)", marginBottom: 6 }}>{"\ud83d\udd25"} HOT BATS</div>
          {hotHitters.map(h => <div key={h.id} style={{ ...cardStyle, fontSize: 12 }}><strong>{h.name}</strong> <span style={{ color: "var(--text-dim)" }}>{h.hits}-{h.abs}{h.rbis > 0 ? `, ${h.rbis} RBI` : ""}</span></div>)}
        </div>}

        {coldHitters.length > 0 && <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--out-text)", marginBottom: 6 }}>{"\u2744\ufe0f"} COLD BATS</div>
          {coldHitters.map(c => <div key={c.id} style={{ ...cardStyle, fontSize: 12 }}><strong>{c.name}</strong> <span style={{ color: "var(--text-dim)" }}>{c.hits}-{c.abs}{c.ks > 0 ? `, ${c.ks} K` : ""}</span></div>)}
        </div>}

        {/* Suggested order */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>SUGGESTED BATTING ORDER</div>
          {suggestedOrder.map((pid, idx) => {
            const p = players.find(pl => pl.id === pid);
            if (!p) return null;
            const prevIdx = currentOrder.indexOf(pid);
            const moved = prevIdx !== idx;
            const dir = prevIdx > idx ? "\u2191" : prevIdx < idx ? "\u2193" : "";
            return (
              <div key={pid} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 22, fontWeight: 700, color: "var(--text-dim)" }}>#{idx + 1}</span>
                <span style={{ fontWeight: 700, color: moved ? "var(--accent)" : "var(--text)" }}>{p.name}</span>
                {moved && <span style={{ fontSize: 11, color: dir === "\u2191" ? "var(--hit-text)" : "var(--out-text)" }}>{dir}{Math.abs(prevIdx - idx)}</span>}
              </div>
            );
          })}
        </div>

        {fieldRecs.length > 0 && <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>FIELDING NOTES</div>
          {fieldRecs.map((r, i) => <div key={i} style={{ ...cardStyle, fontSize: 12 }}>
            <span style={{ color: r.type === "star" ? "var(--accent)" : r.type === "error" ? "#e74c3c" : "#e67e22" }}>{r.type === "star" ? "\u2605" : r.type === "error" ? "X" : "?"}</span>{" "}
            <strong>{r.name}</strong> <span style={{ color: "var(--text-dim)" }}>{r.msg}</span>
          </div>)}
        </div>}

        {/* Sit fairness */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>SIT FAIRNESS (season)</div>
          {sitSorted.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", fontSize: 11 }}>
              <span style={{ width: 70, fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
              <div style={{ flex: 1, height: 8, background: "var(--tag-bg)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (p.sits / Math.max(1, sitSorted[sitSorted.length - 1].sits)) * 100)}%`,
                  height: "100%", background: "var(--accent)", borderRadius: 4 }} />
              </div>
              <span style={{ width: 20, textAlign: "right", color: "var(--text-dim)", fontSize: 10 }}>{p.sits}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Game Day Tab ───
function GameDayTab({ games, setGames, players }) {
  const [activeGameId, setActiveGameId] = useState(null);
  const [subTab, setSubTab] = useState("lineup");
  const [showNewGame, setShowNewGame] = useState(false);
  const [newOpponent, setNewOpponent] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const activeGame = games.find(g => g.id === activeGameId);

  const createGame = () => {
    const game = { id: `game-${Date.now()}`, date: newDate, opponent: newOpponent || "TBD",
      batting: [], fielding: {}, notes: {}, runsPerInning: {},
      currentInning: 1, currentFieldInning: 1, battingOrder: [...DEFAULT_ORDER], absent: [],
      ourScore: 0, theirScore: 0, status: "active" };
    setGames([...games, game]); setActiveGameId(game.id); setShowNewGame(false); setNewOpponent("");
  };
  const updateGame = (updated) => { setGames(games.map(g => g.id === updated.id ? updated : g)); };
  const endGame = () => { if (activeGame) { updateGame({ ...activeGame, status: "final" }); setSubTab("summary"); } };
  const deleteGame = (id) => { setGames(games.filter(g => g.id !== id)); if (activeGameId === id) setActiveGameId(null); };

  if (!activeGame) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ ...headingStyle, fontSize: 20, color: "var(--text)" }}>GAMES</h2>
          <button onClick={() => setShowNewGame(true)} style={{ ...btnBase, padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, background: "var(--accent)", color: "#fff" }}>+ New Game</button>
        </div>
        {showNewGame && (
          <div style={{ padding: 14, background: "var(--card)", borderRadius: 10, marginBottom: 14, border: "2px solid var(--accent)" }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Date</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Opponent</label>
              <input type="text" value={newOpponent} onChange={(e) => setNewOpponent(e.target.value)} placeholder="Team name"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createGame} style={{ ...btnBase, flex: 1, padding: "8px 0", borderRadius: 6, fontWeight: 700, background: "var(--accent)", color: "#fff" }}>Start Game</button>
              <button onClick={() => setShowNewGame(false)} style={{ ...btnBase, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", fontWeight: 600, background: "transparent", color: "var(--text-dim)" }}>Cancel</button>
            </div>
          </div>
        )}
        {games.length === 0 && !showNewGame && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{"\u26be"}</div>
            <div style={{ fontSize: 14 }}>No games yet. Tap + New Game to start.</div>
          </div>
        )}
        {[...games].reverse().map(g => (
          <div key={g.id} onClick={() => setActiveGameId(g.id)}
            style={{ padding: 12, background: "var(--card)", borderRadius: 10, marginBottom: 8, cursor: "pointer",
              border: g.status === "active" ? "2px solid var(--accent)" : "2px solid transparent" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>vs {g.opponent}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{g.date} {g.ourScore || g.theirScore ? `\u00b7 ${g.ourScore}-${g.theirScore}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                  background: g.status === "active" ? "var(--hit-bg)" : "var(--tag-bg)", color: g.status === "active" ? "var(--hit-text)" : "var(--text-dim)" }}>
                  {g.status === "active" ? "LIVE" : "FINAL"}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteGame(g.id); }}
                  style={{ ...btnBase, fontSize: 10, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text-dim)" }}>{"\ud83d\uddd1"}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const SUB_TABS = [
    { id: "lineup", label: "Lineup" }, { id: "batting", label: "Batting" },
    { id: "fielding", label: "Fielding" }, { id: "notes", label: "Notes" }, { id: "summary", label: "Summary" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <button onClick={() => setActiveGameId(null)} style={{ ...btnBase, fontSize: 11, padding: "3px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text-dim)", marginBottom: 4 }}>{"\u2190"} Back</button>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", fontFamily: "'Archivo Black', sans-serif" }}>vs {activeGame.opponent}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{activeGame.date}</div>
        </div>
        {activeGame.status === "active" && (
          <button onClick={endGame} style={{ ...btnBase, fontSize: 11, padding: "6px 12px", borderRadius: 6, fontWeight: 700, background: "var(--out-bg)", color: "var(--out-text)" }}>End Game</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 3, marginBottom: 14, overflowX: "auto" }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ ...btnBase, flex: "0 0 auto", padding: "8px 12px", borderRadius: 6, fontWeight: 700, fontSize: 11,
              background: subTab === t.id ? "var(--accent)" : "var(--card)", color: subTab === t.id ? "#fff" : "var(--text-dim)" }}>{t.label}</button>
        ))}
      </div>
      {subTab === "lineup" && <LineupPanel game={activeGame} setGame={updateGame} players={players} />}
      {subTab === "batting" && <BattingPanel game={activeGame} setGame={updateGame} players={players} />}
      {subTab === "fielding" && <FieldingPanel game={activeGame} setGame={updateGame} players={players} />}
      {subTab === "notes" && <GameNotesPanel game={activeGame} setGame={updateGame} />}
      {subTab === "summary" && <SummaryPanel game={activeGame} allGames={games} players={players} />}
    </div>
  );
}

// ─── Season Tab ───
function SeasonTab({ games, players }) {
  const [view, setView] = useState("batting");
  const battingStats = players.map(p => {
    const abs = games.flatMap(g => (g.batting || []).filter(b => b.playerId === p.id));
    const hits = abs.filter(b => ["1B","2B","3B","HR"].includes(b.result));
    const rbis = abs.reduce((s, b) => s + (b.rbis || 0), 0);
    const avg = abs.length > 0 ? (hits.length / abs.length).toFixed(3) : ".000";
    return { ...p, abs: abs.length, hits: hits.length, singles: abs.filter(b => b.result === "1B").length,
      doubles: abs.filter(b => b.result === "2B").length, triples: abs.filter(b => b.result === "3B").length,
      hrs: abs.filter(b => b.result === "HR").length, ks: abs.filter(b => b.result === "K").length, rbis, avg };
  });
  const fieldingStats = players.map(p => {
    const entries = [];
    games.forEach(g => { Object.entries(g.fielding || {}).forEach(([key, val]) => {
      if (key.startsWith(p.id + "-") && val.position && val.position !== "SIT") entries.push(val);
    }); });
    const posMap = {}; entries.forEach(e => { posMap[e.position] = (posMap[e.position] || 0) + 1; });
    return { ...p, innings: entries.length, great: entries.filter(e => e.grade === "\u2605").length,
      routine: entries.filter(e => e.grade === "\u2713").length, errs: entries.filter(e => e.grade === "X").length,
      lapses: entries.filter(e => e.grade === "?").length,
      topPos: Object.entries(posMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p) };
  });

  return (
    <div>
      <h2 style={{ ...headingStyle, fontSize: 20, color: "var(--text)", marginBottom: 4 }}>SEASON STATS</h2>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 14 }}>{games.filter(g => g.status === "final").length} games</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {["batting", "fielding"].map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ ...btnBase, flex: 1, padding: "8px 0", borderRadius: 6, fontWeight: 700, fontSize: 13,
              background: view === v ? "var(--accent)" : "var(--card)", color: view === v ? "#fff" : "var(--text-dim)", textTransform: "capitalize" }}>{v}</button>
        ))}
      </div>
      {view === "batting" && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 400 }}>
            <div style={{ display: "flex", gap: 4, padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)" }}>
              <span style={{ width: 65 }}>Player</span><span style={{ width: 28, textAlign: "center" }}>AB</span>
              <span style={{ width: 28, textAlign: "center" }}>H</span><span style={{ width: 38, textAlign: "center" }}>AVG</span>
              <span style={{ width: 24, textAlign: "center" }}>1B</span><span style={{ width: 24, textAlign: "center" }}>2B</span>
              <span style={{ width: 24, textAlign: "center" }}>3B</span><span style={{ width: 24, textAlign: "center" }}>HR</span>
              <span style={{ width: 24, textAlign: "center" }}>K</span><span style={{ width: 28, textAlign: "center" }}>RBI</span>
            </div>
            {[...battingStats].sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg)).map(p => (
              <div key={p.id} style={{ display: "flex", gap: 4, padding: "6px 8px", background: "var(--card)", borderRadius: 6, fontSize: 12 }}>
                <span style={{ width: 65, fontWeight: 700, color: "var(--text)" }}>{p.name}</span>
                <span style={{ width: 28, textAlign: "center", color: "var(--text-dim)" }}>{p.abs}</span>
                <span style={{ width: 28, textAlign: "center", color: "var(--text)" }}>{p.hits}</span>
                <span style={{ width: 38, textAlign: "center", fontWeight: 700, color: "var(--accent)" }}>{p.avg}</span>
                <span style={{ width: 24, textAlign: "center", color: "var(--text-dim)" }}>{p.singles}</span>
                <span style={{ width: 24, textAlign: "center", color: "var(--text-dim)" }}>{p.doubles}</span>
                <span style={{ width: 24, textAlign: "center", color: "var(--text-dim)" }}>{p.triples}</span>
                <span style={{ width: 24, textAlign: "center", color: "var(--text-dim)" }}>{p.hrs}</span>
                <span style={{ width: 24, textAlign: "center", color: "var(--text-dim)" }}>{p.ks}</span>
                <span style={{ width: 28, textAlign: "center", fontWeight: 600, color: "var(--text)" }}>{p.rbis}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {view === "fielding" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 4, padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)" }}>
            <span style={{ width: 65 }}>Player</span><span style={{ width: 28, textAlign: "center" }}>Inn</span>
            <span style={{ width: 24, textAlign: "center" }}>{"\u2605"}</span><span style={{ width: 24, textAlign: "center" }}>{"\u2713"}</span>
            <span style={{ width: 24, textAlign: "center" }}>X</span><span style={{ width: 24, textAlign: "center" }}>?</span>
            <span style={{ flex: 1 }}>Positions</span>
          </div>
          {[...fieldingStats].sort((a, b) => b.great - a.great || a.errs - b.errs).map(p => (
            <div key={p.id} style={{ display: "flex", gap: 4, padding: "6px 8px", background: "var(--card)", borderRadius: 6, fontSize: 12, alignItems: "center" }}>
              <span style={{ width: 65, fontWeight: 700, color: "var(--text)" }}>{p.name}</span>
              <span style={{ width: 28, textAlign: "center", color: "var(--text-dim)" }}>{p.innings}</span>
              <span style={{ width: 24, textAlign: "center", color: "var(--accent)" }}>{p.great}</span>
              <span style={{ width: 24, textAlign: "center", color: "var(--text)" }}>{p.routine}</span>
              <span style={{ width: 24, textAlign: "center", color: "#e74c3c" }}>{p.errs}</span>
              <span style={{ width: 24, textAlign: "center", color: "#e67e22" }}>{p.lapses}</span>
              <span style={{ flex: 1, fontSize: 11, color: "var(--text-dim)" }}>{p.topPos.join(", ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Roster Tab ───
function RosterTab({ players }) {
  return (
    <div>
      <h2 style={{ ...headingStyle, fontSize: 20, color: "var(--text)", marginBottom: 14 }}>ROSTER</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {players.map(p => (
          <div key={p.id} style={{ padding: 12, background: "var(--card)", borderRadius: 10,
            borderLeft: p.bats === "L" ? "4px solid var(--accent)" : "4px solid transparent" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{p.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                background: p.bats === "L" ? "var(--accent-dim)" : "var(--tag-bg)",
                color: p.bats === "L" ? "var(--accent)" : "var(--text-dim)" }}>Bats {p.bats}</span>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
              <span style={{ color: "var(--text-dim)" }}>Pwr: <strong style={{ color: "var(--text)" }}>{p.power}</strong></span>
              <span style={{ color: "var(--text-dim)" }}>Con: <strong style={{ color: "var(--text)" }}>{p.consistency}</strong></span>
              <span style={{ color: "var(--text-dim)" }}>Spd: <strong style={{ color: "var(--text)" }}>{p.speed}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rotation Tab ───
function RotationTab({ players }) {
  const [rotation, setRotation] = useState({});
  const [selectedCell, setSelectedCell] = useState(null);
  const getPlayer = (pos, inning) => rotation[`${pos}-${inning}`] || "";
  const setPlayer = (pos, inning, pid) => { setRotation({ ...rotation, [`${pos}-${inning}`]: pid }); setSelectedCell(null); };
  const usedInInning = (inning) => { const u = []; POSITIONS.forEach(pos => { const p = getPlayer(pos, inning); if (p) u.push(p); }); return u; };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ ...headingStyle, fontSize: 20, color: "var(--text)" }}>ROTATION</h2>
        <button onClick={() => { setRotation({}); setSelectedCell(null); }}
          style={{ ...btnBase, fontSize: 11, padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--text-dim)" }}>Clear</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
          <thead><tr>
            <th style={{ padding: "6px 4px", textAlign: "left", color: "var(--text-dim)", fontWeight: 700, borderBottom: "2px solid var(--border)" }}>Pos</th>
            {[1,2,3,4,5].map(i => <th key={i} style={{ padding: "6px 4px", textAlign: "center", color: "var(--text-dim)", fontWeight: 700, borderBottom: "2px solid var(--border)" }}>I{i}</th>)}
          </tr></thead>
          <tbody>
            {POSITIONS.map(pos => (
              <tr key={pos}>
                <td style={{ padding: "6px 4px", fontWeight: 700, color: "var(--text)", borderBottom: "1px solid var(--border)",
                  background: pos === "SIT" ? "var(--out-bg)" : "transparent" }}>{pos}</td>
                {[1,2,3,4,5].map(inning => {
                  const pid = getPlayer(pos, inning);
                  const player = players.find(p => p.id === pid);
                  const isSel = selectedCell?.pos === pos && selectedCell?.inning === inning;
                  return (
                    <td key={inning} onClick={() => setSelectedCell(isSel ? null : { pos, inning })}
                      style={{ padding: "4px 2px", textAlign: "center", borderBottom: "1px solid var(--border)", cursor: "pointer",
                        background: isSel ? "var(--accent-dim)" : pos === "SIT" ? "var(--out-bg)" : "var(--card)" }}>
                      <span style={{ fontSize: 11, fontWeight: player ? 700 : 400,
                        color: player ? (player.bats === "L" ? "var(--accent)" : "var(--text)") : "var(--text-dim)" }}>
                        {player ? player.name : "\u00b7"}</span>
                    </td>);
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedCell && (
        <div style={{ marginTop: 10, padding: 10, background: "var(--card)", borderRadius: 8, border: "2px solid var(--accent)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>{selectedCell.pos} \u2014 Inning {selectedCell.inning}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {players.filter(p => !usedInInning(selectedCell.inning).includes(p.id) || getPlayer(selectedCell.pos, selectedCell.inning) === p.id).map(p => (
              <button key={p.id} onClick={() => setPlayer(selectedCell.pos, selectedCell.inning, p.id)}
                style={{ ...btnBase, padding: "6px 10px", borderRadius: 5, fontWeight: 700, fontSize: 12,
                  background: getPlayer(selectedCell.pos, selectedCell.inning) === p.id ? "var(--accent)" : "var(--tag-bg)",
                  color: getPlayer(selectedCell.pos, selectedCell.inning) === p.id ? "#fff" : (p.bats === "L" ? "var(--accent)" : "var(--text)") }}>{p.name}</button>
            ))}
            <button onClick={() => setPlayer(selectedCell.pos, selectedCell.inning, "")}
              style={{ ...btnBase, padding: "6px 10px", borderRadius: 5, border: "1px solid var(--border)", fontWeight: 600, fontSize: 12, background: "transparent", color: "var(--text-dim)" }}>Clear</button>
          </div>
        </div>
      )}
      {[1,2,3,4,5].map(inning => {
        const unassigned = players.filter(p => !usedInInning(inning).includes(p.id));
        if (unassigned.length === 0) return null;
        return <div key={inning} style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)" }}>I{inning} unassigned: {unassigned.map(p => p.name).join(", ")}</div>;
      })}
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [tab, setTab] = useState("gameday");
  const [players, setPlayers] = useState(PLAYERS_INIT);
  const [games, setGames] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef(null);

  // Load once on mount
  useEffect(() => {
    const data = loadAllData();
    if (data) {
      setGames(data.games || []);
      setPlayers(data.players || PLAYERS_INIT);
    }
    setLoaded(true);
  }, []);

  // Save on every change, debounced, only after initial load
  useEffect(() => {
    if (!loaded) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveAllData({ games, players });
    }, 300);
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [games, players, loaded]);

  if (!loaded) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg)", color: "var(--text)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>{"\u26be"}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        :root { --bg:#0f1117;--card:#1a1d27;--border:#2a2d3a;--text:#e8e9ed;--text-dim:#7a7d8a;--accent:#e87a2e;
          --accent-dim:rgba(232,122,46,0.15);--tag-bg:#252836;--hit-bg:#1a3a2a;--hit-text:#4ade80;
          --out-bg:#3a1a1a;--out-text:#f87171;--reach-bg:#1a2a3a;--reach-text:#60a5fa; }
        *{box-sizing:border-box}
        body{margin:0;font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text)}
        input,textarea,select,button{font-family:'DM Sans',sans-serif}
        input:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:-1px}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
      `}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 18, letterSpacing: 1 }}>{"\u26be"} DUGOUT TRACKER</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Coach Pitch Stats & Rotations</div>
        </div>
        <div style={{ padding: 16 }}>
          {tab === "gameday" && <GameDayTab games={games} setGames={setGames} players={players} />}
          {tab === "season" && <SeasonTab games={games} players={players} />}
          {tab === "roster" && <RosterTab players={players} />}
          {tab === "rotation" && <RotationTab players={players} />}
        </div>
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--card)", borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "center", zIndex: 100 }}>
          <div style={{ display: "flex", maxWidth: 480, width: "100%", justifyContent: "space-around" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ ...btnBase, flex: 1, padding: "10px 0 12px", background: "transparent",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  color: tab === t.id ? "var(--accent)" : "var(--text-dim)", transition: "color 0.15s" }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
