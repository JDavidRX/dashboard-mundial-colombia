# Claude vs el Corazón — Dashboard del Mundial 2026

Dashboard que trackea apuestas de $50.000 COP por partido de Colombia (apostando a lo que predice Claude) y calcula el profit/loss solo, con tabla de posiciones y resultados que se actualizan por API.

La mecánica: **vos apostás manual en WPlay** (no hay API para apostar por código en ninguna casa regulada), copiás la cuota al archivo de datos, y el dashboard hace el resto solo.

---

## Qué se actualiza solo y qué no

| Dato | ¿Automático? | Cómo |
|---|---|---|
| Resultados de Colombia | Sí | API-Football, cuando el partido termina |
| Tabla del Grupo K | Sí | API-Football |
| Últimos 5 partidos (forma) | Sí | API-Football |
| Profit / pérdida / ROI | Sí | lo calcula el dashboard con los resultados |
| Predicción de Claude | Semi | la generás antes del partido (función `predict`) |
| La cuota a la que apostaste | Manual | la copiás de WPlay al array `FIXTURES` en `index.html` |

> No existe forma legal/técnica de leer cuotas o apostar en WPlay por API. La cuota la pegás a mano una vez por partido. Es 1 número.

---

## Despliegue en Netlify (10 minutos)

### 1. Subí el repo a GitHub
Estos 4 archivos:
```
index.html
netlify.toml
netlify/functions/scores.js     ← trae resultados/tabla (esconde tu API key)
netlify/functions/predict.js    ← genera la predicción de Claude
```

### 2. Conectá el repo a Netlify
- netlify.com → Add new site → Import from GitHub → elegí el repo.
- No necesita build command. Publish directory: `.`

### 3. Conseguí las 2 API keys
- **API-Football** (datos del Mundial): creá cuenta gratis en dashboard.api-football.com. Plan free = 100 requests/día, suficiente. Copiá tu key.
- **Anthropic** (predicciones de Claude): console.anthropic.com → API keys.

### 4. Meté las keys en Netlify (NUNCA en el código)
Site settings → Environment variables → agregá:
```
APIFOOTBALL_KEY   = tu_key_de_api_football
ANTHROPIC_API_KEY = tu_key_de_anthropic
```

### 5. Verificá el id de Colombia
Una sola vez, abrí en el navegador (con tu key):
`https://v3.football.api-sports.io/teams?search=colombia`
Si el id no es 1846, cambialo en `scores.js` (constante `COLOMBIA_ID`).

### 6. Listo — no hay que editar código
El `index.html` ya viene cableado a las funciones (`/.netlify/functions/scores` y `/predict`). Apenas subís el sitio con las keys puestas:
- Los resultados y la tabla se actualizan solos.
- El botón "Pedir predicción a Claude" funciona.

Cada vez que alguien abre la página trae datos frescos, y el cron de `netlify.toml` lo refresca a diario.

### Cómo usar el dashboard (ya en línea)
- **Meter apuestas:** en la sección "Mis apuestas", elegí el mercado, escribí la cuota de WPlay y el monto, y dale "Guardar apuestas". Queda guardado en tu navegador.
- **Predicción de Claude:** clic en "🔮 Pedir predicción a Claude" (o "Claude predice" en cada fila). Trae el marcador y a quién apostar, y lo precarga en los campos.
- **Profit/pérdida:** se calcula solo cuando el partido termina y llega el resultado por API.

---

## Flujo antes de cada partido (tu rutina de 2 minutos)

1. Pedís la predicción: abrí `tudominio.netlify.app/.netlify/functions/predict?opp=Portugal`
   (o lo grabás en el Reel pidiéndosela a Claude en vivo, más honesto para tu audiencia).
2. Vas a WPlay, apostás $50.000 al mercado que dijo Claude, copiás la cuota.
3. En `index.html`, en el objeto de ese partido dentro de `FIXTURES`, actualizás `odds` con la cuota real.
4. Commit → Netlify redeploya solo.
5. Cuando el partido termina, el dashboard marca GANADA/PERDIDA y suma el profit solo.

---

## Editar las apuestas

Todo vive en el array `FIXTURES` arriba del `<script>` en `index.html`:
```js
{ id:'por', date:'27 JUN', oppName:'Portugal', ...,
  market:'DRAW',        // a qué le apostaste: COL | DRAW | OPP
  marketLabel:'Empate',
  odds:3.40,            // la cuota real de WPlay
  colScore:null, oppScore:null, finished:false }  // esto lo llena la API
```

`STAKE` (arriba del array) controla el monto por apuesta. Está en 50000.

---

Serie de RX Labs · @juandavid.ai
