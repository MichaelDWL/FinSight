# Arquitetura frontend — FinSight

SPA vanilla (ES modules, sem bundler). Entry: `frontend/index.html` → `js/main.js` → templates → sidebar → `core/app.js`.

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
│   ├── main.js             # boot: mountAppTemplates → sidebar → core/app
│   ├── core/
│   │   ├── app.js          # orquestra rotas, formulários, bootstrap
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

1. `main.js` chama `mountAppTemplates()` (`fetch` de `/templates/...`).
2. Carrega `components/sidebar/sidebar.js`.
3. Carrega `core/app.js`: autentica, `bindAppEvents`, `hashchange` → `renderRoute`.

**Requisito:** servir via HTTP (não `file://`). Em produção, rewrites Vercel devem expor `/js/*`, `/style/*`, `/templates/*`, `/assets/*`.

## Estado

Mutações em `store` (`js/core/store.js`). `app.js` lê/escreve `store.*`. `patchStore(partial)` disponível para updates em lote.

## CSS

Ordem de cascata controlada por `style/main.css`. Páginas grandes usam `pages/shared.css` + `_parts/` (chrome, lists, fields, feedback). Não reordenar imports sem validar visual.

## O que não fazer

- Não reintroduzir monolito `js/app.js` na raiz.
- Não criar pasta `_legacy` para código morto — remover.
- Não alterar seletores/`data-action`/rotas sem necessidade de produto.
