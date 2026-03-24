# Contexto do Projeto — Controle de Laudos

## O que é
Web app de controle de produção para um patologista que lauda casos histológicos.
Single-page app em HTML/CSS/JS puro (sem frameworks, sem build tools).

## O usuário
Patologista que:
- Lauda casos (analisa lâminas histológicas)
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
- **Frontend:** HTML + CSS + JS vanilla (tudo em `index.html`)
- **Banco de dados:** Firebase Firestore (projeto: `laudos-a7009`)
- **Autenticação:** Firebase Auth com Google Sign-In
- **Hospedagem:** GitHub Pages
- **PWA:** `manifest.json` + `sw.js` (instalável no celular)

### Firebase config (já está no index.html)
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

## Funcionalidades implementadas

### Página inicial — Sessão de Hoje
- **Iniciar Trabalho** → começa a contar o tempo
- **Registrar Caso** → input de lâminas + botão (ou Enter); registra duração exata do caso descontando pausas
- **Pausar / Retomar** → pausa o timer, conta tempo de pausa separado
- **Encerrar Sessão** → salva no Firestore (histórico do dia)
- **Iniciar Nova Sessão** → reseta para nova sessão no mesmo dia (acumula no histórico)
- Estatísticas em tempo real: tempo trabalhado, em pausa, casos, lâminas, média/caso, média/lâmina
- Lista de casos da sessão (ordem reversa) com botão de apagar caso individual

### Menu lateral (sidebar)
- Botão hamburguer (☰) no canto superior esquerdo
- Fecha ao clicar no overlay
- Navegação: Hoje / Histórico
- Botão Sair (Google Sign-Out)

### Histórico (acessado pelo menu lateral)
- Totais gerais (dias trabalhados, casos, lâminas, média geral/caso)
- Hierarquia colapsável em 4 níveis:
  - **Ano** → mostra total de dias, casos, lâminas
  - **Mês** → mostra dias, casos, lâminas, média/caso
  - **Dia** → mostra casos, lâminas, tempo, número de sessões
  - **Sessão** → mostra horário início–fim, casos da sessão
- Botão apagar em cada nível: dia inteiro, sessão individual, caso individual
- Apagar um caso subtrai seu tempo das estatísticas automaticamente

### Múltiplas sessões por dia
- O mesmo dia pode ter várias sessões (ex.: manhã e tarde)
- Cada sessão é armazenada separadamente em `sessions[]`
- As stats do dia somam todas as sessões
- Histórico de dias antigos (formato sem `sessions[]`) é migrado automaticamente

### Persistência e sync
- Dados salvos no Firestore em tempo real
- Offline persistence habilitada (Firestore IndexedDB cache)
- Ao abrir num novo dia: dados do dia anterior são auto-salvos no histórico

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

### Nota sobre formato do histórico
- Formato novo: `{ date, sessions: [...] }`
- Formato antigo (legado): `{ date, workStartTime, dayEndTime, cases[], pauses[] }`
- `calcDayStats()` e `renderHistoryDay()` suportam ambos os formatos via fallback

---

## Estrutura de arquivos
```
index.html      → app completo (HTML + CSS + JS)
manifest.json   → configuração PWA
sw.js           → service worker (cache offline)
icon.svg        → ícone do app
CONTEXTO.md     → este arquivo
```

---

## Estado do dado atual (objeto `data` — sessão em curso)
```js
{
  state: 'idle' | 'working' | 'paused' | 'ended',
  date: 'YYYY-MM-DD',
  workStartTime: ISO string | null,
  currentCaseStart: ISO string | null,
  cases: [{ id, startTime, endTime, slides, duration }],
  pauses: [{ start, end }],
  currentPauseStart: ISO string | null,
  dayEndTime: ISO string | null,
}
```

---

## Estado JS relevante (variáveis globais)
```js
let data             // sessão em curso
let currentUser      // usuário Firebase Auth
let authReady        // bool — auth inicializado
let timerInterval    // setInterval do timer
let currentView      // 'today' | 'history'
let menuOpen         // bool — sidebar aberta
let expandedYears    // Set de anos abertos no histórico
let expandedMonths   // Set de "YYYY-MM" abertos
let expandedDays     // Set de "YYYY-MM-DD" abertos
let expandedSessions // Set de "YYYY-MM-DD-N" abertos
let historyCache     // objeto { [date]: dayDoc } ou null
```

---

## Cálculo de tempo trabalhado no histórico
- `workMs` = soma das `duration` de todos os casos da sessão/dia
- Isso garante que apagar um caso também subtrai seu tempo das estatísticas
- `duration` de cada caso = tempo entre fim do caso anterior e fim deste caso, descontando pausas sobrepostas

---

## Observações importantes
- O app é pessoal (um único usuário: guimota111)
- Regras do Firestore já configuradas para só o dono acessar os próprios dados
- `guimota111.github.io` já está nos domínios autorizados do Firebase Auth
- O gh CLI está instalado em `C:\Program Files\GitHub CLI\gh.exe` mas não está no PATH do bash — chamar via `powershell.exe -Command` ou via caminho completo
- O Live Server do VS Code funciona normalmente para testes locais (Firebase Auth aceita localhost por padrão); apenas o service worker não carrega localmente (path `/Assistente-trabalho/sw.js` não existe no servidor local — inofensivo)
