# Contexto do Projeto — Controle de Laudos

## O que é
Web app de controle de produção para um patologista que lauda casos histológicos.
Single-page app em HTML/CSS/JS puro (sem frameworks, sem build tools).

## O usuário
Patologista que:
- Lauda casos próprios e casos de segunda assinatura (terceiros)
- Quer rastrear tempo por caso e por lâmina
- Usa desktop e celular (precisa de sincronização)

---

## Onde está hospedado
- **GitHub:** https://github.com/guimota111/Assistente-trabalho
- **App ao vivo (GitHub Pages):** https://guimota111.github.io/Assistente-trabalho/
- **Branch de desenvolvimento e produção:** `master` (deploy direto na master)

### Fluxo de deploy
- Desenvolver e commitar direto na `master` → GitHub Pages atualiza automaticamente em ~2 min

---

## Stack
- **Frontend:** HTML + CSS + JS vanilla (separados em 3 arquivos)
- **Banco de dados:** Firebase Firestore (projeto: `laudos-a7009`)
- **Autenticação:** Firebase Auth com Google Sign-In
- **Hospedagem:** GitHub Pages
- **PWA:** `manifest.json` + `sw.js` (instalável no celular)

### Firebase config (em app.js)
```js
{
  apiKey: "AIzaSyBWsWY3OJOZvy-2YVSWqDK_38dRi7eXAqA",
  authDomain: "laudos-a7009.firebaseapp.com",
  projectId: "laudos-a7009",
  storageBucket: "laudos-a7009.firebasestorage.app",
  messagingSenderId: "225605061167",
  appId: "1:225605061167:web:f25c92f63b2617392114da"
}
```

### Executar o gh CLI (não está no PATH do bash — usar caminho completo)
```powershell
& "C:\Program Files\GitHub CLI\gh.exe" <comando>
```

---

## Estrutura de arquivos
```
index.html      → estrutura HTML (22 linhas — só links para style.css e app.js)
style.css       → todo o CSS / dark theme (~310 linhas)
app.js          → toda a lógica JS / render (~580 linhas)
manifest.json   → configuração PWA
sw.js           → service worker (cache offline)
icon.svg        → ícone do app
CONTEXTO.md     → este arquivo
```

---

## Funcionalidades implementadas

### Página inicial — Sessão de Hoje
- **Iniciar Trabalho** → começa a contar o tempo
- **Registrar Caso** → input de lâminas + botão (ou Enter); registra duração exata do caso descontando pausas
- **+ Terceiro** → botão ao lado de "Registrar Caso"; registra caso de segunda assinatura com flag `thirdParty: true`
- **Pausar / Retomar** → pausa o timer, conta tempo de pausa separado
- **Encerrar Sessão** → salva no Firestore (histórico do dia)
- **Iniciar Nova Sessão** → reseta para nova sessão no mesmo dia (acumula no histórico)
- Estatísticas em tempo real: tempo trabalhado, em pausa, casos, lâminas, média/caso, média/lâmina
- Lista de casos da sessão (ordem reversa) com botão de apagar; casos de terceiro exibem badge `3°` laranja

### Menu lateral (sidebar)
- Botão hamburguer (☰) no canto superior esquerdo
- Fecha ao clicar no overlay
- Navegação: **Hoje** / **Histórico** / **Records** / **Estatísticas**
- Botão Sair (Google Sign-Out)

### Histórico
- Totais gerais (dias trabalhados, casos, lâminas, média geral/caso)
- Hierarquia colapsável em 4 níveis:
  - **Ano** → total de dias, casos, lâminas
  - **Mês** → dias, casos, lâminas, média/caso
  - **Dia** → casos, lâminas, tempo, número de sessões
  - **Sessão** → horário início–fim, casos da sessão com badge `3°` nos de terceiro
- Botão apagar em cada nível: dia inteiro, sessão individual, caso individual

### Records (página nova)
- Cards de records separados por período: **Dia**, **Semana** e **Mês**
- Records exibidos: mais casos, mais lâminas, melhor média/caso, total de dias
- Cards de destaque com borda dourada

### Estatísticas (página nova)
- Abas de período: Esta Semana / Este Mês / Este Ano / Geral
- Chips de segmento para filtrar: **Todos os casos** / **Meus casos** / **Terceiros**
- Grid de resumo: casos, lâminas, dias, média/caso, média/lâmina, tempo total
- Gráfico de barras (CSS div): barras empilhadas azul (meus) + dourado (terceiros) no modo "Todos"

### Múltiplas sessões por dia
- O mesmo dia pode ter várias sessões (ex.: manhã e tarde)
- Cada sessão armazenada em `sessions[]`
- Stats do dia somam todas as sessões
- Histórico legado (sem `sessions[]`) é migrado automaticamente

### Persistência e sync
- Dados salvos no Firestore em tempo real
- Offline persistence habilitada (Firestore IndexedDB cache)
- Ao abrir num novo dia: dados do dia anterior são auto-salvos no histórico

### Visual
- **Dark theme** completo (bg `#0f172a`, cards `#1e293b`, texto `#f1f5f9`)

---

## Estrutura do Firestore
```
users/
  {uid}/
    data/
      current  →  estado atual da sessão em andamento
    history/
      {YYYY-MM-DD}  →  { date, sessions: [{ workStartTime, dayEndTime, cases[], pauses[] }] }
```

### Formato do histórico
- Formato novo: `{ date, sessions: [...] }`
- Formato antigo (legado): `{ date, workStartTime, dayEndTime, cases[], pauses[] }`
- `calcDayStats()` e `renderHistoryDay()` suportam ambos via fallback

---

## Estrutura do dado atual (objeto `data` — sessão em curso)
```js
{
  state: 'idle' | 'working' | 'paused' | 'ended',
  date: 'YYYY-MM-DD',
  workStartTime: ISO string | null,
  currentCaseStart: ISO string | null,
  cases: [{ id, startTime, endTime, slides, duration, thirdParty? }],
  pauses: [{ start, end }],
  currentPauseStart: ISO string | null,
  dayEndTime: ISO string | null,
}
```

---

## Variáveis globais JS relevantes (app.js)
```js
let data             // sessão em curso
let currentUser      // usuário Firebase Auth
let authReady        // bool — auth inicializado
let timerInterval    // setInterval do timer
let currentView      // 'today' | 'history' | 'records' | 'stats'
let menuOpen         // bool — sidebar aberta
let statsView        // 'week' | 'month' | 'year' | 'all'
let statsSegment     // 'all' | 'own' | 'third'
let expandedYears    // Set de anos abertos no histórico
let expandedMonths   // Set de "YYYY-MM" abertos
let expandedDays     // Set de "YYYY-MM-DD" abertos
let expandedSessions // Set de "YYYY-MM-DD-N" abertos
let historyCache     // objeto { [date]: dayDoc } ou null
```

---

## Cálculo de tempo trabalhado
- `workMs` = soma das `duration` de todos os casos da sessão/dia
- Apagar um caso subtrai seu tempo das estatísticas automaticamente
- `duration` de cada caso = tempo entre fim do caso anterior e fim deste caso, descontando pausas sobrepostas

---

## Observações importantes
- App pessoal (único usuário: guimota111)
- Regras do Firestore configuradas para só o dono acessar os próprios dados
- `guimota111.github.io` nos domínios autorizados do Firebase Auth
- gh CLI em `C:\Program Files\GitHub CLI\gh.exe`, fora do PATH do bash
- Live Server do VS Code funciona para testes locais; service worker não carrega localmente (path `/Assistente-trabalho/sw.js` não existe no servidor local — inofensivo)
