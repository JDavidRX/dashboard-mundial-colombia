// netlify/functions/scores.js
// Proxy a football-data.org (su plan GRATIS sí cubre el Mundial, a diferencia de
// API-Football). Esconde tu API key (queda en variables de entorno de Netlify,
// NUNCA en el frontend). El dashboard llama a /.netlify/functions/scores
//
// Variable de entorno a configurar en Netlify (Site settings > Environment variables):
//   FOOTBALL_DATA_KEY = tu_token_de_football-data.org
//
// Cómo conseguir el token (gratis, 2 minutos):
//   1. Entrá a https://www.football-data.org/client/register
//   2. Creá cuenta gratis, te llega el token por correo (o lo ves en tu cuenta).
//   3. Plan gratis: 10 llamadas/minuto, incluye el Mundial (código de competición "WC").
//
// No usamos IDs de equipo a ciegas: filtramos todos los partidos del Mundial
// y buscamos por nombre, así evitamos el problema que tuvimos con API-Football.

const API = 'https://api.football-data.org/v4';
const HEADERS = { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY };

const GROUP = ['Colombia', 'Portugal', 'DR Congo', 'Uzbekistan'];
// nombres alternativos que football-data.org podría usar para cada equipo
const ALIASES = {
  'Colombia': ['colombia'],
  'Portugal': ['portugal'],
  'DR Congo': ['dr congo', 'congo dr', 'congo democratic republic', 'democratic republic of the congo', 'congo'],
  'Uzbekistan': ['uzbekistan', 'uzbekistán'],
};
function matchTeam(name, canonical) {
  const n = (name || '').toLowerCase();
  return ALIASES[canonical].some(a => n.includes(a));
}
function canonicalOf(name) {
  return GROUP.find(c => matchTeam(name, c)) || null;
}

export async function handler() {
  try {
    if (!process.env.FOOTBALL_DATA_KEY) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Falta la variable de entorno FOOTBALL_DATA_KEY en Netlify.' }) };
    }

    // 1) Todos los partidos del Mundial (con esto sacamos fixtures de Colombia Y la forma de los 4 equipos)
    const mRes = await fetch(`${API}/competitions/WC/matches`, { headers: HEADERS });
    const mJson = await mRes.json();

    if (mRes.status !== 200) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `football-data.org (${mRes.status}): ${mJson?.message || JSON.stringify(mJson)}` }) };
    }

    const matches = mJson.matches || [];

    // Partidos de Colombia (para el panel de apuestas)
    const fixtures = matches
      .filter(m => matchTeam(m.homeTeam?.name, 'Colombia') || matchTeam(m.awayTeam?.name, 'Colombia'))
      .map(m => {
        const colIsHome = matchTeam(m.homeTeam?.name, 'Colombia');
        const finished = m.status === 'FINISHED';
        return {
          opp: colIsHome ? m.awayTeam?.name : m.homeTeam?.name,
          finished,
          colScore: finished ? (colIsHome ? m.score?.fullTime?.home : m.score?.fullTime?.away) : null,
          oppScore: finished ? (colIsHome ? m.score?.fullTime?.away : m.score?.fullTime?.home) : null,
        };
      });

    // 2) Tabla del Grupo K
    let groupK = [];
    try {
      const sRes = await fetch(`${API}/competitions/WC/standings`, { headers: HEADERS });
      const sJson = await sRes.json();
      const allGroups = sJson.standings || [];
      const myGroup = allGroups.find(g =>
        (g.table || []).some(t => matchTeam(t.team?.name, 'Colombia'))
      );
      if (myGroup) {
        groupK = myGroup.table.map(t => ({
          team: t.team.name, pj: t.playedGames, g: t.won, e: t.draw, p: t.lost,
          gf: t.goalsFor, gc: t.goalsAgainst, pts: t.points, col: matchTeam(t.team.name, 'Colombia'),
        }));
      }
    } catch (e) { /* si standings falla, seguimos igual con fixtures */ }

    // 3) Forma del Mundial para los 4 equipos del Grupo K (más reciente primero)
    const worldcupForm = {}; GROUP.forEach(t => worldcupForm[t] = []);
    const finishedAll = matches
      .filter(m => m.status === 'FINISHED')
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    finishedAll.forEach(m => {
      const hName = m.homeTeam?.name, aName = m.awayTeam?.name;
      const hCanon = canonicalOf(hName), aCanon = canonicalOf(aName);
      [hCanon, aCanon].forEach(canon => {
        if (!canon) return;
        const isHome = canon === hCanon;
        const gf = isHome ? m.score?.fullTime?.home : m.score?.fullTime?.away;
        const ga = isHome ? m.score?.fullTime?.away : m.score?.fullTime?.home;
        if (gf == null || ga == null) return;
        const r = gf > ga ? 'W' : (gf < ga ? 'L' : 'D');
        const opp = isHome ? aName : hName;
        worldcupForm[canon].unshift({ r, t: `${gf}-${ga} vs ${opp}` });
      });
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ fixtures, standings: groupK, worldcupForm, updated: Date.now() }),
    };
  } catch (e) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String(e) }) };
  }
}
