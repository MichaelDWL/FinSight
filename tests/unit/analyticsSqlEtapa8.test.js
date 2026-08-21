import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

describe("FASE 2B — Analytics SQL Etapa 8", () => {
  it("buildGeneralQuery empurra filtro temporal e remove date_trunc na coluna mensal", () => {
    const { buildGeneralQuery } = require("../../backend/src/modules/analytics/queries/shared.cte");
    const sql = buildGeneralQuery();

    expect(sql).toMatch(/summaries AS \(/);
    expect(sql).toMatch(/period_summary AS \(/);
    expect(sql).toMatch(/previous_summary AS \(/);
    expect(sql).toMatch(/v\.data_transacao BETWEEN b\.prev_start AND b\.end_date/);
    expect(sql).toMatch(/v\.data_transacao >= m\.month_start/);
    expect(sql).toMatch(/v\.data_transacao < \(m\.month_start \+ interval '1 month'\)::date/);
    expect(sql).not.toMatch(/date_trunc\s*\(\s*'month'\s*,\s*v\.data_transacao/);
    expect(sql).toMatch(/'periodSummary'/);
    expect(sql).toMatch(/'previousSummary'/);
    expect(sql).toMatch(/'monthlyFlow'/);
  });

  it("buildExpensesQuery filtra period_totals por intervalo e by_month sem date_trunc na coluna", () => {
    const { buildExpensesQuery } = require("../../backend/src/modules/analytics/queries/expenses.query");
    const sql = buildExpensesQuery();

    expect(sql).toMatch(/period_totals AS \(/);
    expect(sql).toMatch(/v\.data_transacao BETWEEN b\.prev_start AND b\.end_date/);
    expect(sql).toMatch(/v\.data_transacao >= m\.month_start/);
    expect(sql).toMatch(/v\.data_transacao < \(m\.month_start \+ interval '1 month'\)::date/);
    expect(sql).not.toMatch(/date_trunc\s*\(\s*'month'\s*,\s*v\.data_transacao/);
    expect(sql).toMatch(/'byMonth'/);
    expect(sql).toMatch(/'periodTotals'/);
  });

  it("buildCashflowQuery filtra period_totals e monthly_flow por intervalo", () => {
    const { buildCashflowQuery } = require("../../backend/src/modules/analytics/queries/cashflow.query");
    const sql = buildCashflowQuery();

    expect(sql).toMatch(/period_totals AS \(/);
    expect(sql).toMatch(/v\.data_transacao BETWEEN b\.start_date AND b\.end_date/);
    expect(sql).toMatch(/v\.data_transacao >= m\.month_start/);
    expect(sql).toMatch(/v\.data_transacao < \(m\.month_start \+ interval '1 month'\)::date/);
    expect(sql).not.toMatch(/date_trunc\s*\(\s*'month'\s*,\s*v\.data_transacao/);
    // date_trunc em week permanece (agrupamento semanal necessario)
    expect(sql).toMatch(/date_trunc\s*\(\s*'week'\s*,\s*v\.data_transacao/);
    expect(sql).toMatch(/'monthlyFlow'/);
  });

  it("queries mantem isolamento por usuario_id = $1", () => {
    const { buildGeneralQuery } = require("../../backend/src/modules/analytics/queries/shared.cte");
    const { buildExpensesQuery } = require("../../backend/src/modules/analytics/queries/expenses.query");
    const { buildCashflowQuery } = require("../../backend/src/modules/analytics/queries/cashflow.query");

    for (const sql of [buildGeneralQuery(), buildExpensesQuery(), buildCashflowQuery()]) {
      expect(sql).toMatch(/usuario_id = \$1/);
    }
  });
});
