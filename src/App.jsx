import { useState, useEffect, useRef } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const RESULTS = {
  H:  { label: "H",  color: "var(--hit-text)", bg: "var(--hit-bg)", wide: false },
  GO: { label: "GO", color: "var(--out-text)", bg: "var(--out-bg)", wide: true  },
  FO: { label: "FO", color: "var(--out-text)", bg: "var(--out-bg)", wide: true  },
  K:  { label: "K",  color: "#ff6b35",         bg: "#3a1500",       wide: false },
  // legacy — old "O", "E", "W" records still render cleanly
  O:  { label: "O",  color: "var(--out-text)", bg: "var(--out-bg)", wide: false },
  E:  { label: "E",  color: "var(--out-text)", bg: "var(--out-bg)", wide: false },
  W:  { label: "W",  color: "var(--out-text)", bg: "var(--out-bg)", wide: false },
};
const RESULT_KEYS = ["H","GO","FO","K"]; // active recording options

const POSITIONS = ["P","C","1B","2B","3B","SS","LF","LC","CF","RC","RF","Bench"];
const GRADES    = ["✓","★","X","—","?"];
const GRADE_COLORS = { "✓":"#4ade80","★":"#fbbf24","X":"#f87171","—":"#7a7d8a","?":"#f97316" };
const MAX_INNINGS = 6;

const PLAYERS_INIT = [
  { id:"p01", name:"Wilder",   number:"1"  },
  { id:"p02", name:"Thomas",   number:"2"  },
  { id:"p03", name:"Kit",      number:"3"  },
  { id:"p04", name:"James",    number:"4"  },
  { id:"p05", name:"Stewart",  number:"5"  },
  { id:"p06", name:"Crawford", number:"6"  },
  { id:"p07", name:"Haile",    number:"7"  },
  { id:"p08", name:"Billy",    number:"8"  },
  { id:"p09", name:"Davis",    number:"9"  },
  { id:"p10", name:"Trow",     number:"10" },
  { id:"p11", name:"Willie",   number:"18" },
];

const TABS = [
  { id:"gameday",  icon:"⚾", label:"GAME"     },
  { id:"season",   icon:"📊", label:"SEASON"   },
  { id:"roster",   icon:"👥", label:"ROSTER"   },
  { id:"rotation", icon:"🔄", label:"ROTATION" },
];

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadData(key, fallback) {
  try {
    // support old single-key format
    if (key === "cpbt-games") {
      const legacy = localStorage.getItem("cpbt-all-data-v2");
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed.games) return parsed.games;
      }
    }
    if (key === "cpbt-players-v2") {
      const legacy = localStorage.getItem("cpbt-all-data-v2");
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed.players) return parsed.players;
      }
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveData(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error("Save failed:", e); }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/** Collect all at-bats for a player across all innings in a game */
function getPlayerABs(playerId, game) {
  const out = [];
  (game.innings || []).forEach(inn => {
    (inn.atBats || []).filter(ab => ab.playerId === playerId).forEach(ab => out.push(ab));
  });
  return out;
}

/** Compute H, AB, AVG, K, K% from an at-bat array */
function statsFromABs(abs) {
  const validAB = abs.filter(ab => ab.result !== "W");
  const hits    = abs.filter(ab => ab.result === "H");
  const ks      = abs.filter(ab => ab.result === "K");
  return {
    ab:   validAB.length,
    h:    hits.length,
    k:    ks.length,
    avg:  validAB.length > 0 ? hits.length / validAB.length : null,
    kPct: validAB.length > 0 ? ks.length   / validAB.length : null,
    rbi:  abs.reduce((s, ab) => s + (ab.rbi || 0), 0),
  };
}

function fmtAvg(avg) {
  if (avg === null) return "—";
  return avg.toFixed(3).replace("0.", ".");
}

function fmtPct(val) {
  if (val === null) return "—";
  return Math.round(val * 100) + "%";
}

/** Color for K% — green low, amber mid, alarm-orange high */
function kPctColor(kPct) {
  if (kPct === null) return "var(--text-dim)";
  if (kPct >= 0.5)   return "#ff6b35";
  if (kPct >= 0.25)  return "#fbbf24";
  return "#4ade80";
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────

const card    = { background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:12, marginBottom:8 };
const btnBase = { border:"none", cursor:"pointer", borderRadius:6, fontFamily:"inherit" };
const pill    = { ...btnBase, padding:"4px 10px", fontSize:12, fontWeight:700 };

function ResultBadge({ result }) {
  const r = RESULTS[result] || RESULTS.O;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
      minWidth:22, width: r.wide ? 28 : 22, height:22, borderRadius:4,
      background:r.bg, color:r.color,
      fontSize:11, fontWeight:700, fontFamily:"monospace", flexShrink:0,
      padding: r.wide ? "0 3px" : 0 }}>
      {r.label}
    </span>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ fontSize:11, color:"var(--text-dim)", fontWeight:700, letterSpacing:1,
    marginBottom:8, marginTop:4, ...style }}>{children}</div>;
}

// ─── InningPicker ────────────────────────────────────────────────────────────

function InningPicker({ value, onChange }) {
  return (
    <div style={{ display:"flex", gap:4, marginBottom:12 }}>
      {Array.from({ length: MAX_INNINGS }, (_, i) => (
        <button key={i} onClick={() => onChange(i)}
          style={{ ...pill, flex:1,
            background: i === value ? "var(--accent-dim)" : "var(--tag-bg)",
            color:      i === value ? "var(--accent)"     : "var(--text-dim)",
            border: i === value ? "1px solid var(--accent)" : "1px solid transparent" }}>
          {i + 1}
        </button>
      ))}
    </div>
  );
}

// ─── BattingSubTab ───────────────────────────────────────────────────────────

function BattingSubTab({ game, updateGame, players, inning }) {
  const [selected, setSelected] = useState(null);

  const inn = game.innings[inning] || { atBats: [] };

  function addAB(playerId, result) {
    updateGame(g => {
      const innings = g.innings.map((inn, idx) => idx !== inning ? inn : {
        ...inn, atBats: [...(inn.atBats || []), { playerId, result, rbi: 0 }]
      });
      return { ...g, innings };
    });
    setSelected(null);
  }

  function undoLast() {
    updateGame(g => {
      const innings = g.innings.map((inn, idx) => idx !== inning ? inn : {
        ...inn, atBats: (inn.atBats || []).slice(0, -1)
      });
      return { ...g, innings };
    });
  }

  return (
    <div>
      {players.map((p, i) => {
        const innABs  = (inn.atBats || []).filter(ab => ab.playerId === p.id);
        const gameABs = getPlayerABs(p.id, game);
        const gs      = statsFromABs(gameABs);
        const open    = selected === p.id;
        return (
          <div key={p.id}
            style={{ ...card, cursor:"pointer",
              border: open ? "1px solid var(--accent)" : "1px solid var(--border)" }}
            onClick={() => setSelected(open ? null : p.id)}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"var(--text-dim)", fontSize:12, width:18, textAlign:"right" }}>{i+1}</span>
              <span style={{ fontSize:13, fontWeight:600, flex:1 }}>#{p.number} {p.name}</span>
              <div style={{ display:"flex", gap:3 }}>
                {innABs.map((ab, j) => <ResultBadge key={j} result={ab.result} />)}
              </div>
              {gameABs.length > 0 && (
                <span style={{ fontSize:11, color:"var(--text-dim)", minWidth:32, textAlign:"right" }}>
                  {gs.h}-{gs.ab}
                </span>
              )}
            </div>
            {open && (
              <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                {RESULT_KEYS.map(r => {
                  const cfg = RESULTS[r];
                  return (
                    <button key={r} onClick={e => { e.stopPropagation(); addAB(p.id, r); }}
                      style={{ ...pill, background:cfg.bg, color:cfg.color,
                        border:`1px solid ${cfg.color}`, padding:"8px 16px", fontSize:13 }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={undoLast}
        style={{ ...btnBase, background:"var(--tag-bg)", color:"var(--text-dim)",
          padding:"8px 16px", fontSize:12, width:"100%", marginTop:4 }}>
        ↩ Undo Last AB
      </button>
    </div>
  );
}

// ─── FieldingSubTab ──────────────────────────────────────────────────────────

function FieldingSubTab({ game, updateGame, players, inning }) {
  const inn = game.innings[inning] || {};

  function setField(playerId, key, val) {
    updateGame(g => {
      const innings = g.innings.map((inn, idx) => {
        if (idx !== inning) return inn;
        const f = { ...(inn.fielding || {}) };
        f[playerId] = { ...(f[playerId] || {}), [key]: val };
        return { ...inn, fielding: f };
      });
      return { ...g, innings };
    });
  }

  return (
    <div>
      {players.map((p, i) => {
        const f = ((inn.fielding || {})[p.id]) || {};
        return (
          <div key={p.id} style={card}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span style={{ color:"var(--text-dim)", fontSize:12, width:18, textAlign:"right" }}>{i+1}</span>
              <span style={{ fontSize:13, fontWeight:600, flex:1 }}>#{p.number} {p.name}</span>
              <span style={{ fontSize:13, color:"var(--accent)", fontWeight:700, minWidth:30 }}>{f.position || "—"}</span>
              {f.grade && <span style={{ fontSize:15, color: GRADE_COLORS[f.grade] }}>{f.grade}</span>}
            </div>
            <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginBottom:6 }}>
              {POSITIONS.map(pos => (
                <button key={pos} onClick={() => setField(p.id, "position", pos)}
                  style={{ ...pill, background: f.position === pos ? "var(--accent)" : "var(--tag-bg)",
                    color: f.position === pos ? "#fff" : "var(--text-dim)" }}>
                  {pos}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {GRADES.map(g => (
                <button key={g} onClick={() => setField(p.id, "grade", g)}
                  style={{ ...pill, background: f.grade === g ? "rgba(255,255,255,0.08)" : "transparent",
                    color: GRADE_COLORS[g],
                    border: `1px solid ${f.grade === g ? GRADE_COLORS[g] : "var(--border)"}` }}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ScoreSubTab ─────────────────────────────────────────────────────────────

function ScoreSubTab({ game, updateGame }) {
  function setRuns(inning, team, val) {
    updateGame(g => {
      const innings = g.innings.map((inn, idx) => idx !== inning ? inn : {
        ...inn, [`runs${team}`]: Math.max(0, parseInt(val) || 0)
      });
      return { ...g, innings };
    });
  }

  const totalUs   = (game.innings || []).reduce((s, i) => s + (i.runsUs   || 0), 0);
  const totalThem = (game.innings || []).reduce((s, i) => s + (i.runsThem || 0), 0);

  const colW = `repeat(${MAX_INNINGS}, 1fr)`;

  return (
    <div style={card}>
      <div style={{ display:"grid", gridTemplateColumns:`90px ${colW} 44px`, gap:4, alignItems:"center", textAlign:"center" }}>
        <div style={{ fontSize:11, color:"var(--text-dim)", textAlign:"left" }}>INN</div>
        {Array.from({ length: MAX_INNINGS }, (_, i) => (
          <div key={i} style={{ fontSize:11, color:"var(--text-dim)" }}>{i+1}</div>
        ))}
        <div style={{ fontSize:11, color:"var(--text-dim)" }}>R</div>

        {[["Us", "var(--hit-text)"], ["Them", "var(--out-text)"]].map(([team, clr]) => [
          <div key={`lbl-${team}`} style={{ fontWeight:700, fontSize:13, textAlign:"left" }}>{team}</div>,
          ...Array.from({ length: MAX_INNINGS }, (_, i) => (
            <input key={`${team}-${i}`} type="number" min="0" max="20"
              value={game.innings[i]?.[`runs${team}`] || ""}
              onChange={e => setRuns(i, team, e.target.value)}
              style={{ background:"var(--tag-bg)", border:"1px solid var(--border)", borderRadius:4,
                color:"var(--text)", textAlign:"center", width:"100%", padding:"5px 0", fontSize:13 }} />
          )),
          <div key={`tot-${team}`} style={{ fontSize:16, fontWeight:800, color:clr }}>
            {team === "Us" ? totalUs : totalThem}
          </div>
        ])}
      </div>
    </div>
  );
}

// ─── LineupSubTab ─────────────────────────────────────────────────────────────

function LineupSubTab({ game, updateGame, players }) {
  const order = game.battingOrder || players.map(p => p.id);

  function move(idx, dir) {
    const newOrder = [...order];
    const swap = idx + dir;
    if (swap < 0 || swap >= newOrder.length) return;
    [newOrder[idx], newOrder[swap]] = [newOrder[swap], newOrder[idx]];
    updateGame(g => ({ ...g, battingOrder: newOrder }));
  }

  function toggleAbsent(pid) {
    const absent = game.absentPlayers || [];
    const next = absent.includes(pid) ? absent.filter(x => x !== pid) : [...absent, pid];
    updateGame(g => ({ ...g, absentPlayers: next }));
  }

  const absentIds = game.absentPlayers || [];

  return (
    <div>
      <div style={{ fontSize:12, color:"var(--text-dim)", marginBottom:12 }}>
        Tap arrows to reorder · tap name to mark absent
      </div>
      {order.map((pid, i) => {
        const p = players.find(pl => pl.id === pid);
        if (!p) return null;
        const absent = absentIds.includes(pid);
        return (
          <div key={pid} style={{ ...card, opacity: absent ? 0.45 : 1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"var(--accent)", fontWeight:800, fontSize:14, minWidth:20 }}>{i+1}</span>
              <span onClick={() => toggleAbsent(pid)}
                style={{ fontSize:13, fontWeight:600, flex:1, cursor:"pointer",
                  textDecoration: absent ? "line-through" : "none" }}>
                #{p.number} {p.name} {absent && <span style={{ fontSize:11, color:"var(--out-text)" }}>absent</span>}
              </span>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  style={{ ...btnBase, background:"var(--tag-bg)", color:"var(--text-dim)",
                    padding:"4px 8px", opacity: i === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => move(i, 1)} disabled={i === order.length - 1}
                  style={{ ...btnBase, background:"var(--tag-bg)", color:"var(--text-dim)",
                    padding:"4px 8px", opacity: i === order.length - 1 ? 0.3 : 1 }}>▼</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── SummarySubTab ───────────────────────────────────────────────────────────

function SummarySubTab({ game, updateGame, players }) {
  const totalUs   = (game.innings || []).reduce((s, i) => s + (i.runsUs   || 0), 0);
  const totalThem = (game.innings || []).reduce((s, i) => s + (i.runsThem || 0), 0);
  const win       = totalUs > totalThem;

  // Players in this game's batting order, excluding absent
  const absentIds = game.absentPlayers || [];
  const orderedIds = (game.battingOrder || players.map(p => p.id)).filter(id => !absentIds.includes(id));
  const orderedPlayers = orderedIds.map(id => players.find(p => p.id === id)).filter(Boolean);

  function setNote(key, val) {
    updateGame(g => ({ ...g, notes: { ...(g.notes || {}), [key]: val } }));
  }

  return (
    <div>
      {/* Final score */}
      <div style={{ ...card, textAlign:"center" }}>
        <div style={{ fontSize:11, color:"var(--text-dim)", marginBottom:4 }}>FINAL</div>
        <div style={{ fontSize:32, fontWeight:800 }}>
          <span style={{ color: win ? "var(--hit-text)" : "var(--out-text)" }}>{totalUs}</span>
          <span style={{ color:"var(--text-dim)", margin:"0 10px" }}>–</span>
          <span style={{ color: totalThem > totalUs ? "var(--hit-text)" : "var(--out-text)" }}>{totalThem}</span>
        </div>
        <div style={{ fontSize:12, color:"var(--text-dim)", marginTop:4 }}>
          vs {game.opponent || "TBD"} · {game.date}
        </div>
      </div>

      {/* Batting order for this game */}
      <SectionLabel>BATTING ORDER</SectionLabel>
      {orderedPlayers.length === 0 && (
        <div style={{ color:"var(--text-dim)", fontSize:12, marginBottom:12 }}>No at-bats recorded yet.</div>
      )}
      {orderedPlayers.map((p, i) => {
        const abs  = getPlayerABs(p.id, game);
        const stats = statsFromABs(abs);
        return (
          <div key={p.id} style={card}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: abs.length ? 6 : 0 }}>
              <span style={{ color:"var(--accent)", fontSize:14, fontWeight:800, minWidth:20 }}>{i+1}</span>
              <span style={{ fontSize:13, fontWeight:600, flex:1 }}>#{p.number} {p.name}</span>
              <span style={{ fontSize:12, color:"var(--text-dim)" }}>
                {stats.ab > 0 ? `${stats.h}-${stats.ab}` : "—"}
              </span>
            </div>
            {abs.length > 0 && (
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", paddingLeft:28 }}>
                {abs.map((ab, j) => <ResultBadge key={j} result={ab.result} />)}
              </div>
            )}
          </div>
        );
      })}

      {/* Notes */}
      <SectionLabel style={{ marginTop:16 }}>GAME NOTES</SectionLabel>
      {[["surprise","🌟 Surprises"],["concern","⚠️ Concerns"],["change","🔄 Changes for Next Game"]].map(([key, label]) => (
        <div key={key} style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"var(--text-dim)", marginBottom:4 }}>{label}</div>
          <textarea value={game.notes?.[key] || ""} onChange={e => setNote(key, e.target.value)}
            rows={2}
            style={{ width:"100%", background:"var(--tag-bg)", border:"1px solid var(--border)", borderRadius:6,
              color:"var(--text)", padding:"8px 10px", fontSize:12, resize:"vertical", minHeight:44 }} />
        </div>
      ))}
    </div>
  );
}

// ─── GameEditor ──────────────────────────────────────────────────────────────

const GAME_TABS = [
  { id:"lineup",  label:"LINEUP"   },
  { id:"batting", label:"⚾ BAT"   },
  { id:"fielding",label:"🧤 FIELD" },
  { id:"score",   label:"SCORE"    },
  { id:"summary", label:"SUMMARY"  },
];

function GameEditor({ game, updateGame, players, onBack }) {
  const [subTab, setSubTab] = useState("batting");
  const [inning, setInning] = useState(0);

  const absentIds      = game.absentPlayers || [];
  const orderedIds     = game.battingOrder || players.map(p => p.id);
  const activePlayers  = orderedIds
    .filter(id => !absentIds.includes(id))
    .map(id => players.find(p => p.id === id))
    .filter(Boolean);

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <button onClick={onBack}
          style={{ ...btnBase, background:"var(--tag-bg)", padding:"6px 12px", color:"var(--text-dim)", fontSize:13 }}>
          ← Back
        </button>
        <div style={{ flex:1 }}>
          <input value={game.opponent} onChange={e => updateGame(g => ({ ...g, opponent: e.target.value }))}
            placeholder="Opponent..."
            style={{ background:"transparent", border:"none", color:"var(--text)",
              fontSize:16, fontWeight:700, width:"100%" }} />
          <div style={{ fontSize:11, color:"var(--text-dim)" }}>{game.date}</div>
        </div>
      </div>

      {/* Sub-tab strip */}
      <div style={{ display:"flex", gap:3, marginBottom:12, overflowX:"auto", paddingBottom:2 }}>
        {GAME_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ ...pill, whiteSpace:"nowrap", flexShrink:0,
              background: subTab === t.id ? "var(--accent)" : "var(--tag-bg)",
              color:      subTab === t.id ? "#fff"          : "var(--text-dim)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Inning picker for bat/field */}
      {(subTab === "batting" || subTab === "fielding") && (
        <InningPicker value={inning} onChange={setInning} />
      )}

      {subTab === "lineup"   && <LineupSubTab  game={game} updateGame={updateGame} players={players} />}
      {subTab === "batting"  && <BattingSubTab game={game} updateGame={updateGame} players={activePlayers} inning={inning} />}
      {subTab === "fielding" && <FieldingSubTab game={game} updateGame={updateGame} players={activePlayers} inning={inning} />}
      {subTab === "score"    && <ScoreSubTab    game={game} updateGame={updateGame} />}
      {subTab === "summary"  && <SummarySubTab  game={game} updateGame={updateGame} players={players} />}
    </div>
  );
}

// ─── GameDayTab ──────────────────────────────────────────────────────────────

function GameDayTab({ games, setGames, players }) {
  const [activeGameId, setActiveGameId] = useState(null);
  const activeGame = games.find(g => g.id === activeGameId);

  function newGame() {
    const game = {
      id: uid(),
      date: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric" }),
      opponent: "",
      innings: Array.from({ length: MAX_INNINGS }, () => ({ atBats:[], fielding:{}, runsUs:0, runsThem:0 })),
      battingOrder:   players.map(p => p.id),
      absentPlayers:  [],
      notes: { surprise:"", concern:"", change:"" },
    };
    setGames(gs => [game, ...gs]);
    setActiveGameId(game.id);
  }

  function updateGame(id, fn) {
    setGames(gs => gs.map(g => g.id === id ? fn(g) : g));
  }

  function deleteGame(id) {
    if (window.confirm("Delete this game?")) {
      setGames(gs => gs.filter(g => g.id !== id));
      if (activeGameId === id) setActiveGameId(null);
    }
  }

  if (activeGame) {
    return (
      <GameEditor
        game={activeGame}
        updateGame={fn => updateGame(activeGame.id, fn)}
        players={players}
        onBack={() => setActiveGameId(null)}
      />
    );
  }

  return (
    <div>
      <button onClick={newGame}
        style={{ ...btnBase, width:"100%", padding:14, background:"var(--accent)",
          color:"#fff", fontSize:14, fontWeight:700, marginBottom:16 }}>
        + New Game
      </button>
      {games.length === 0 && (
        <div style={{ textAlign:"center", color:"var(--text-dim)", padding:48 }}>No games yet</div>
      )}
      {games.map(g => {
        const totalUs   = (g.innings || []).reduce((s, i) => s + (i.runsUs   || 0), 0);
        const totalThem = (g.innings || []).reduce((s, i) => s + (i.runsThem || 0), 0);
        const win = totalUs > totalThem;
        const allABs = (g.innings || []).flatMap(inn => inn.atBats || []);
        const hits   = allABs.filter(ab => ab.result === "H").length;
        return (
          <div key={g.id} style={{ ...card, cursor:"pointer" }} onClick={() => setActiveGameId(g.id)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>vs {g.opponent || "TBD"}</div>
                <div style={{ fontSize:12, color:"var(--text-dim)", marginTop:2 }}>
                  {g.date} · {allABs.length} AB · {hits} H
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ fontSize:22, fontWeight:800, color: win ? "var(--hit-text)" : totalUs === totalThem ? "var(--text-dim)" : "var(--out-text)" }}>
                  {totalUs}–{totalThem}
                </div>
                <button onClick={e => { e.stopPropagation(); deleteGame(g.id); }}
                  style={{ ...btnBase, background:"transparent", color:"var(--text-dim)", padding:"4px 6px", fontSize:14 }}>
                  🗑
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── SeasonTab ───────────────────────────────────────────────────────────────

function SeasonTab({ games, players }) {
  const [view, setView] = useState("grid");         // "grid" | "player"
  const [focusPlayer, setFocusPlayer] = useState(null);

  const sortedGames = [...games].sort((a, b) => new Date(a.date) - new Date(b.date));

  if (games.length === 0) {
    return (
      <div style={{ textAlign:"center", color:"var(--text-dim)", padding:48 }}>
        No games recorded yet
      </div>
    );
  }

  // ── Season grid ──────────────────────────────────────────────────────────
  function SeasonGrid() {
    return (
      <div>
        {/* Season totals header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700 }}>
            {sortedGames.length} Game{sortedGames.length !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize:12, color:"var(--text-dim)" }}>Tap a player for detail</div>
        </div>

        {/* Scrollable table */}
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ borderCollapse:"collapse", fontSize:12,
            minWidth: Math.max(320, sortedGames.length * 64 + 160) }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, position:"sticky", left:0, background:"var(--bg)", minWidth:130, textAlign:"left" }}>PLAYER</th>
                {sortedGames.map((g, gi) => (
                  <th key={g.id} style={{ ...thStyle, minWidth:58, textAlign:"center" }}>
                    <div>G{gi+1}</div>
                    <div style={{ fontWeight:400, color:"var(--text-dim)" }}>{(g.opponent || "TBD").slice(0,6)}</div>
                  </th>
                ))}
                <th style={{ ...thStyle, minWidth:44, color:"var(--accent)", textAlign:"center" }}>AVG</th>
                <th style={{ ...thStyle, minWidth:32, textAlign:"center" }}>H</th>
                <th style={{ ...thStyle, minWidth:32, textAlign:"center" }}>AB</th>
                <th style={{ ...thStyle, minWidth:40, color:"#ff6b35", textAlign:"center" }}>K%</th>
                <th style={{ ...thStyle, minWidth:28, textAlign:"center" }}>K</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, pi) => {
                const allABs     = sortedGames.flatMap(g => getPlayerABs(p.id, g));
                const seasonStat = statsFromABs(allABs);
                const avg        = seasonStat.avg;
                return (
                  <tr key={p.id} style={{ borderTop:"1px solid var(--border)", cursor:"pointer" }}
                    onClick={() => { setFocusPlayer(p); setView("player"); }}>
                    <td style={{ ...tdStyle, position:"sticky", left:0, background:"var(--bg)", fontWeight:600 }}>
                      <span style={{ color:"var(--text-dim)", marginRight:5 }}>{pi+1}</span>
                      #{p.number} {p.name}
                    </td>
                    {sortedGames.map(g => {
                      const abs = getPlayerABs(p.id, g);
                      const s   = statsFromABs(abs);
                      return (
                        <td key={g.id} style={{ ...tdStyle, textAlign:"center" }}>
                          {abs.length > 0 ? (
                            <div>
                              <div style={{ display:"flex", gap:2, justifyContent:"center", flexWrap:"wrap" }}>
                                {abs.slice(0, 5).map((ab, j) => <ResultBadge key={j} result={ab.result} />)}
                              </div>
                              <div style={{ fontSize:10, color:"var(--text-dim)", marginTop:3 }}>
                                {s.h}-{s.ab}{s.k > 0 ? <span style={{ color:"#ff6b35", marginLeft:3 }}>{s.k}K</span> : null}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color:"var(--border)" }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign:"center", fontWeight:700,
                      color: avg === null ? "var(--text-dim)"
                           : avg >= 0.5  ? "var(--hit-text)"
                           : avg >= 0.3  ? "var(--accent)"
                           :               "var(--text-dim)" }}>
                      {fmtAvg(avg)}
                    </td>
                    <td style={{ ...tdStyle, textAlign:"center", color:"var(--hit-text)" }}>{seasonStat.h}</td>
                    <td style={{ ...tdStyle, textAlign:"center", color:"var(--text-dim)" }}>{seasonStat.ab}</td>
                    <td style={{ ...tdStyle, textAlign:"center", fontWeight:700,
                      color: kPctColor(seasonStat.kPct) }}>
                      {fmtPct(seasonStat.kPct)}
                    </td>
                    <td style={{ ...tdStyle, textAlign:"center", color:"#ff6b35" }}>{seasonStat.k || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Individual player detail ─────────────────────────────────────────────
  function PlayerDetail({ player }) {
    const allABs    = sortedGames.flatMap(g => getPlayerABs(player.id, g));
    const season    = statsFromABs(allABs);

    const resultCounts = [...RESULT_KEYS, "O"].reduce((acc, r) => {
      acc[r] = allABs.filter(ab => ab.result === r).length;
      return acc;
    }, {});

    return (
      <div>
        <button onClick={() => setView("grid")}
          style={{ ...btnBase, background:"var(--tag-bg)", color:"var(--text-dim)",
            padding:"6px 14px", fontSize:12, marginBottom:14 }}>
          ← Season
        </button>

        {/* Season stat card */}
        <div style={{ ...card, marginBottom:14 }}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>#{player.number} {player.name}</div>
          {/* Primary stats */}
          <div style={{ display:"flex", gap:16, marginBottom:14 }}>
            {[["AVG", fmtAvg(season.avg), "var(--accent)"],
              ["H",   season.h,           "var(--hit-text)"],
              ["AB",  season.ab,          "var(--text-dim)"],
              ["RBI", season.rbi,         "var(--text-dim)"]].map(([l, v, clr]) => (
              <div key={l} style={{ textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:clr }}>{v}</div>
                <div style={{ fontSize:10, color:"var(--text-dim)" }}>{l}</div>
              </div>
            ))}
          </div>

          {/* K% highlight — the key metric for lineup decisions */}
          {season.ab > 0 && (
            <div style={{ background:"var(--tag-bg)", borderRadius:8, padding:"10px 12px",
              border: season.kPct >= 0.5 ? "1px solid #ff6b35" : "1px solid var(--border)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:12, fontWeight:700, color:"var(--text-dim)" }}>STRIKEOUT RATE</span>
                <span style={{ fontSize:18, fontWeight:800, color:kPctColor(season.kPct) }}>
                  {fmtPct(season.kPct)}
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ height:8, borderRadius:4, background:"var(--border)", overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:4,
                  width: `${Math.min(100, Math.round((season.kPct || 0) * 100))}%`,
                  background: kPctColor(season.kPct),
                  transition:"width 0.3s" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text-dim)", marginTop:4 }}>
                <span>0%</span>
                <span style={{ color:"#fbbf24" }}>25%</span>
                <span style={{ color:"#ff6b35" }}>50%+</span>
              </div>
              {/* Breakdown: K vs contact outs */}
              <div style={{ display:"flex", gap:12, marginTop:8, fontSize:12 }}>
                <span><span style={{ color:"#ff6b35", fontWeight:700 }}>{season.k}</span> <span style={{ color:"var(--text-dim)" }}>strikeouts</span></span>
                <span><span style={{ color:"var(--out-text)", fontWeight:700 }}>{season.ab - season.h - season.k}</span> <span style={{ color:"var(--text-dim)" }}>contact outs</span></span>
                <span><span style={{ color:"var(--hit-text)", fontWeight:700 }}>{season.h}</span> <span style={{ color:"var(--text-dim)" }}>hits</span></span>
              </div>
            </div>
          )}

          {/* Result breakdown badges */}
          {allABs.length > 0 && (
            <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
              {[...RESULT_KEYS, "O"].filter(r => resultCounts[r] > 0).map(r => (
                <div key={r} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <ResultBadge result={r} />
                  <span style={{ fontSize:12, color:"var(--text-dim)" }}>{resultCounts[r]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per-game breakdown */}
        <SectionLabel>GAME BY GAME</SectionLabel>
        {sortedGames.map((g, gi) => {
          const abs = getPlayerABs(player.id, g);
          if (abs.length === 0) return (
            <div key={g.id} style={{ ...card, opacity:0.4 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, fontWeight:600 }}>G{gi+1} vs {g.opponent || "TBD"}</span>
                <span style={{ fontSize:11, color:"var(--text-dim)" }}>{g.date} · DNP</span>
              </div>
            </div>
          );
          const s = statsFromABs(abs);
          return (
            <div key={g.id} style={card}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:700 }}>G{gi+1} vs {g.opponent || "TBD"}</span>
                <span style={{ fontSize:12, color:"var(--text-dim)" }}>{g.date} · {s.h}-{s.ab}</span>
              </div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {abs.map((ab, j) => <ResultBadge key={j} result={ab.result} />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {view === "grid"   && <SeasonGrid />}
      {view === "player" && focusPlayer && <PlayerDetail player={focusPlayer} />}
    </div>
  );
}

const thStyle = { padding:"5px 6px", fontSize:11, color:"var(--text-dim)", fontWeight:700, letterSpacing:0.5 };
const tdStyle = { padding:"6px 6px" };

// ─── RosterTab ───────────────────────────────────────────────────────────────

function RosterTab({ players, setPlayers }) {
  const [editing, setEditing] = useState(null); // playerId

  function update(id, key, val) {
    setPlayers(ps => ps.map(p => p.id === id ? { ...p, [key]: val } : p));
  }

  return (
    <div>
      <div style={{ fontSize:12, color:"var(--text-dim)", marginBottom:12 }}>
        {players.length} players · tap to edit name or number
      </div>
      {players.map((p, i) => (
        <div key={p.id} style={card}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color:"var(--accent)", fontWeight:800, fontSize:14, minWidth:20 }}>{i+1}</span>
            {editing === p.id ? (
              <>
                <input value={p.number} onChange={e => update(p.id, "number", e.target.value)}
                  style={{ background:"var(--tag-bg)", border:"1px solid var(--border)", borderRadius:4,
                    color:"var(--text)", padding:"4px 6px", fontSize:12, width:42 }} />
                <input value={p.name} onChange={e => update(p.id, "name", e.target.value)}
                  style={{ background:"var(--tag-bg)", border:"1px solid var(--border)", borderRadius:4,
                    color:"var(--text)", padding:"4px 6px", fontSize:12, flex:1 }} />
                <button onClick={() => setEditing(null)}
                  style={{ ...btnBase, background:"var(--accent)", color:"#fff", padding:"4px 10px", fontSize:12 }}>
                  Done
                </button>
              </>
            ) : (
              <span onClick={() => setEditing(p.id)}
                style={{ fontSize:13, fontWeight:600, flex:1, cursor:"pointer" }}>
                #{p.number} {p.name}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── RotationTab ─────────────────────────────────────────────────────────────

function RotationTab({ players, rotation, setRotation }) {
  const [selectedCell, setSelectedCell] = useState(null);

  function setPosition(inning, playerId, pos) {
    setRotation(r => ({ ...r, [`${inning}-${playerId}`]: pos }));
    setSelectedCell(null);
  }

  function clearPosition(inning, playerId) {
    setRotation(r => { const n = { ...r }; delete n[`${inning}-${playerId}`]; return n; });
    setSelectedCell(null);
  }

  return (
    <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
      <table style={{ borderCollapse:"collapse", minWidth: MAX_INNINGS * 56 + 110 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, minWidth:110, textAlign:"left", position:"sticky", left:0, background:"var(--bg)" }}>PLAYER</th>
            {Array.from({ length: MAX_INNINGS }, (_, i) => (
              <th key={i} style={{ ...thStyle, minWidth:52, textAlign:"center" }}>INN {i+1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id} style={{ borderTop:"1px solid var(--border)" }}>
              <td style={{ ...tdStyle, fontSize:12, fontWeight:600, position:"sticky", left:0, background:"var(--bg)" }}>
                #{p.number} {p.name}
              </td>
              {Array.from({ length: MAX_INNINGS }, (_, i) => {
                const key = `${i}-${p.id}`;
                const pos = rotation[key] || "";
                const open = selectedCell === key;
                return (
                  <td key={i} style={{ ...tdStyle, textAlign:"center", position:"relative" }}>
                    <button onClick={() => setSelectedCell(open ? null : key)}
                      style={{ ...btnBase, background: pos ? "var(--accent-dim)" : "var(--tag-bg)",
                        color: pos ? "var(--accent)" : "var(--text-dim)", padding:"4px 6px",
                        fontSize:12, fontWeight:700, minWidth:38,
                        border: open ? "1px solid var(--accent)" : "1px solid transparent" }}>
                      {pos || "—"}
                    </button>
                    {open && (
                      <div style={{ position:"fixed", zIndex:200, background:"var(--card)",
                        border:"1px solid var(--border)", borderRadius:8, padding:8,
                        display:"flex", flexWrap:"wrap", gap:4, maxWidth:180,
                        boxShadow:"0 4px 20px rgba(0,0,0,0.5)" }}>
                        {POSITIONS.map(pos => (
                          <button key={pos} onClick={() => setPosition(i, p.id, pos)}
                            style={{ ...pill, background:"var(--tag-bg)", color:"var(--text)" }}>
                            {pos}
                          </button>
                        ))}
                        {rotation[key] && (
                          <button onClick={() => clearPosition(i, p.id)}
                            style={{ ...pill, background:"var(--out-bg)", color:"var(--out-text)" }}>
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]           = useState("gameday");
  const [players, setPlayers]   = useState(() => loadData("cpbt-players-v2", PLAYERS_INIT));
  const [games, setGames]       = useState(() => loadData("cpbt-games",   []));
  const [rotation, setRotation] = useState(() => loadData("cpbt-rotation", {}));

  useEffect(() => { saveData("cpbt-games",    games);    }, [games]);
  useEffect(() => { saveData("cpbt-players-v2",  players);  }, [players]);
  useEffect(() => { saveData("cpbt-rotation", rotation); }, [rotation]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=Archivo+Black&display=swap');
        :root {
          --bg:#0f1117; --card:#1a1d27; --border:#2a2d3a; --text:#e8e9ed; --text-dim:#7a7d8a;
          --accent:#e87a2e; --accent-dim:rgba(232,122,46,0.15); --tag-bg:#252836;
          --hit-bg:#1a3a2a; --hit-text:#4ade80; --out-bg:#3a1a1a; --out-text:#f87171;
          --reach-bg:#1a2a3a; --reach-text:#60a5fa;
        }
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin:0; padding:0; font-family:'DM Sans',sans-serif; background:var(--bg);
          color:var(--text); -webkit-font-smoothing:antialiased; overscroll-behavior:none; }
        input, textarea, select, button { font-family:inherit; }
        input:focus, textarea:focus { outline:2px solid var(--accent); outline-offset:-1px; }
        body { padding-top:env(safe-area-inset-top); }
        input[type=number]::-webkit-inner-spin-button { opacity:0.5; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:var(--bg); }
        ::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }
      `}</style>

      <div style={{ maxWidth:480, margin:"0 auto", minHeight:"100vh", background:"var(--bg)", paddingBottom:80 }}>
        {/* Header */}
        <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid var(--border)" }}>
          <div style={{ fontFamily:"'Archivo Black',sans-serif", fontSize:18, letterSpacing:1 }}>
            ⚾ DUGOUT TRACKER
          </div>
          <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:2 }}>Coach Pitch Stats & Rotations</div>
        </div>

        {/* Content */}
        <div style={{ padding:16 }}>
          {tab === "gameday"  && <GameDayTab  games={games} setGames={setGames} players={players} />}
          {tab === "season"   && <SeasonTab   games={games} players={players} />}
          {tab === "roster"   && <RosterTab   players={players} setPlayers={setPlayers} />}
          {tab === "rotation" && <RotationTab players={players} rotation={rotation} setRotation={setRotation} />}
        </div>

        {/* Bottom nav */}
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"var(--card)",
          borderTop:"1px solid var(--border)", display:"flex", justifyContent:"center",
          zIndex:100, paddingBottom:"env(safe-area-inset-bottom)" }}>
          <div style={{ display:"flex", maxWidth:480, width:"100%", justifyContent:"space-around" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ ...btnBase, flex:1, padding:"10px 0 12px", background:"transparent",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                  color: tab === t.id ? "var(--accent)" : "var(--text-dim)", transition:"color 0.15s" }}>
                <span style={{ fontSize:18 }}>{t.icon}</span>
                <span style={{ fontSize:10, fontWeight:700, letterSpacing:0.5 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
