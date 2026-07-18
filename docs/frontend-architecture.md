# Arquitetura frontend — FinSight

SPA vanilla (ES modules, sem bundler). Entry: `frontend/index.html` → `js/app/bootstrap.js` → Loading → Auth → (Login **ou** App). Nenhuma tela interna é montada antes da autenticação.

## Árvore

```
frontend/
├── index.html              # roots: shell / app / chrome / modals
├── templates/
│   ├── shell/              # header, overlay, sidebar, bottom-nav, fab, toast
│   └── modals/             # movement, investment, card, account, onboarding
├── style/
│   ├── main.css            # entry (@import base → layout → components → pages)
│   ├── style.css           # shim → main.css (compat)
│   ├── base/               # reset, variables, typography, global, utilities, animations
│   ├── layout/             # shell, header, sidebar, fab, mobile
│   ├── components/         # inputs, cards, select, calendar, modal/*
│   └── pages/              # home, accounts, cards, investments, … + _parts/
├── js/
│   ├── app/                # camada de inicialização (bootstrap)
│   │   ├── bootstrap.js    # ÚNICO entry point: Loading → Auth → Login/App
│   │   ├── app.js          # App.start(user): monta layout e inicia core/app
│   │   └── router.js       # guarda de rotas privadas + resolução de auth
│   ├── ui/
│   │   └── loading.js      # tela de loading do boot (show/hide com fade)
│   ├── core/
│   │   ├── auth.js         # autenticação centralizada (initialize/login/logout…)
│   │   ├── session.js      # estado de sessão (isAuthenticated/user)
│   │   ├── app.js          # startApp(user): orquestra rotas/formulários
│   │   ├── store.js        # estado global mutável (store.*)
│   │   ├── events.js       # bindAppEvents (listeners document/window)
│   │   └── router.js       # routeTitles + getRoute
│   ├── components/         # sidebar, select, calendar, modal, charts, metric
│   ├── modules/            # domínio: auth, home, dashboard/*, accounts, cards,
│   │                       # investments, goals, transactions, profile, admin, onboarding
│   ├── services/           # HTTP / BFF (accounts, bills, cards, …)
│   └── utils/              # currency, dates, dom, icons, labels, normalize, payment, template
└── assets/                 # imagens estáticas (se houver)
```

## Convenções

| Arquivo | Responsabilidade |
|---------|------------------|
| `render.js` | HTML / montagem de view |
| `events.js` | listeners de um módulo |
| `form.js` | UI/payload de formulário |
| `helpers.js` / `constants.js` | puros, sem DOM de página |
| `store.js` | estado compartilhado |
| `*.service` em `services/` | API apenas |

## Fluxo de boot

1. `app/bootstrap.js` mostra a tela de loading (`ui/loading.js`) e marca `is-auth-screen`.
2. `core/auth.js` `Auth.initialize()` verifica a sessão (`/auth/me`) e, se preciso, renova o token (`/auth/refresh`).
3. **Sem sessão** → renderiza Login (`modules/auth/authGate.js`); nenhum template de shell é montado.
4. **Com sessão** → `App.start(user)` (`app/app.js`) monta `mountAppTemplates()`, carrega a sidebar e chama `startApp(user)` em `core/app.js` (`bindAppEvents`, `hashchange` → `renderRoute`, onboarding).
5. `#app` é revelado por baixo do overlay e o loading some com fade (sem piscadas).

**Requisito:** servir via HTTP (não `file://`). Em produção, rewrites Vercel devem expor `/js/*`, `/style/*`, `/templates/*`, `/assets/*`.

## Estado

Mutações em `store` (`js/core/store.js`). `app.js` lê/escreve `store.*`. `patchStore(partial)` disponível para updates em lote.

## CSS

Ordem de cascata controlada por `style/main.css`. Páginas grandes usam `pages/shared.css` + `_parts/` (chrome, lists, fields, feedback). Não reordenar imports sem validar visual.

## O que não fazer

- Não reintroduzir monolito `js/app.js` na raiz.
- Não criar pasta `_legacy` para código morto — remover.
- Não alterar seletores/`data-action`/rotas sem necessidade de produto.
