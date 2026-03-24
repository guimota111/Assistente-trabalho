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
- **Branch atual de desenvolvimento:** `proximas-funcoes`
- **Branch estável:** `master`

### Fluxo de deploy
1. Desenvolver na branch `proximas-funcoes`
2. Quando pronto: merge para `master` → GitHub Pages atualiza automaticamente em ~2 min

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

### Aba "Hoje"
- **Iniciar Trabalho** → começa a contar o tempo
- **Registrar Caso** → input de lâminas + botão (ou Enter); registra duração exata do caso descontando pausas
- **Pausar / Retomar** → pausa o timer, conta tempo de pausa separado
- **Encerrar Dia** → salva resumo no Firestore e na coleção de histórico
- Estatísticas em tempo real: tempo trabalhado, em pausa, casos, lâminas, média/caso, média/lâmina
- Lista de casos do dia (ordem reversa)

### Aba "Histórico"
- Totais gerais (dias trabalhados, casos, lâminas, média geral/caso)
- Lista de todos os dias, mais recente primeiro
- Cada dia é expansível → mostra estatísticas detalhadas + lista de casos

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
      current  →  estado atual do dia (state, cases[], pauses[], timers...)
    history/
      {YYYY-MM-DD}  →  dados finalizados de cada dia
```

## Estrutura de arquivos
```
index.html      → app completo (HTML + CSS + JS)
manifest.json   → configuração PWA
sw.js           → service worker (cache offline)
icon.svg        → ícone do app
CONTEXTO.md     → este arquivo
```

---

## Estado do dado (data object)
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

## O que ainda pode ser feito (ideias do usuário)
- O usuário mencionou querer "novas funções" mas não especificou quais ainda
- Perguntar ao usuário o que quer adicionar na próxima sessão

## Observações importantes
- O app é pessoal (um único usuário: guimota111)
- Regras do Firestore já configuradas para só o dono acessar os próprios dados
- `guimota111.github.io` já está nos domínios autorizados do Firebase Auth
- O gh CLI está instalado em `C:\Program Files\GitHub CLI\gh.exe` mas não está no PATH do bash — chamar via `powershell.exe -Command` ou adicionar ao PATH manualmente
