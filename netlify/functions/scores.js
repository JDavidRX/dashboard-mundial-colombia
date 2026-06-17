const API = 'https://v3.football.api-sports.io';
const HEADERS = { 'x-apisports-key': process.env.APIFOOTBALL_KEY };

// id de Colombia en API-Football (verificalo una vez con /teams?search=colombia)
const COLOMBIA_ID = 1846;

export async function handler() {
  try {
    // 1) Partidos de Colombia en el Mundial
    const fxRes = await fetch(`${API}/fixtures?league=1&season=2026&team=${COLOMBIA_ID}`, { headers: HEADERS });
    const fxJson = await fxRes.json();

    const fixtures = (fxJson.response || []).map(x => {
      const home = x.teams.home, away = x.teams.away;
      const colIsHome = home.id === COLOMBIA_ID;
      const finished = x.fixture.status.short === 'FT' || x.fixture.status.short === 'AET' || x.fixture.status.short === 'PEN';
      return {
        opp: colIsHome ? away.name : home.name,
        finished,
        colScore: finished ? (colIsHome ? x.goals.home : x.goals.away) : null,
        oppScore: finished ? (colIsHome ? x.goals.away : x.goals.home) : null,
      };
    });

    // 2) Tabla del Grupo K
    const stRes = await fetch(`${API}/standings?league=1&season=2026`, { headers: HEADERS });
    const stJson = await stRes.json();
    const allGroups = stJson.response?.[0]?.league?.standings || [];
    const groupK = (allGroups.find(g => g.some(t => t.team.id === COLOMBIA_ID)) || []).map(t => ({
      team: t.team.name, pj: t.all.played, g: t.all.win, e: t.all.draw, p: t.all.lose,
      gf: t.all.goals.for, gc: t.all.goals.against, pts: t.points, col: t.team.id === COLOMBIA_ID,
    }));

    // 3) Forma del Mundial para los 4 equipos del Grupo K
    //    (trae todos los fixtures del torneo y arma W/L/D por equipo, más reciente primero)
    const GROUP = ['Colombia', 'Portugal', 'Congo DR', 'Uzbekistan'];
    const worldcupForm = {}; GROUP.forEach(t => worldcupForm[t] = []);
    try {
      const allRes = await fetch(`${API}/fixtures?league=1&season=2026`, { headers: HEADERS });
      const allJson = await allRes.json();
      const finishedAll = (allJson.response || []).filter(x =>
        ['FT', 'AET', 'PEN'].includes(x.fixture.status.short));
      // ordená por fecha ascendente para luego invertir
      finishedAll.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
      finishedAll.forEach(x => {
        const h = x.teams.home.name, a = x.teams.away.name;
        GROUP.forEach(team => {
          if (h !== team && a !== team) return;
          const isHome = h === team;
          const gf = isHome ? x.goals.home : x.goals.away;
          const ga = isHome ? x.goals.away : x.goals.home;
          const r = gf > ga ? 'W' : (gf < ga ? 'L' : 'D');
          const opp = isHome ? a : h;
          worldcupForm[team].unshift({ r, t: `${gf}-${ga} vs ${opp}` }); // unshift = más reciente primero
        });
      });
    } catch (e) { /* si falla, el frontend usa la forma pre-Mundial */ }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ fixtures, standings: groupK, worldcupForm, updated: Date.now() }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e) }) };
  }
}
