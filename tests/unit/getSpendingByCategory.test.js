import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("FASE 2B — getSpendingByCategory filtro temporal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("usa intervalo [month_start, next_month) sem date_trunc na coluna", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({
      rows: [
        { category: "Moradia", total: "1500" },
        { category: "Lazer", total: "200" },
      ],
    });

    const result = await repository.getSpendingByCategory(USER_A, "2026-08-01");

    expect(querySpy).toHaveBeenCalledTimes(1);
    const [sql, params] = querySpy.mock.calls[0];
    expect(params).toEqual([USER_A, "2026-08-01", "2026-09-01"]);
    expect(sql).toMatch(/m\.data_transacao\s*>=\s*\$2::date/i);
    expect(sql).toMatch(/m\.data_transacao\s*<\s*\$3::date/i);
    expect(sql).not.toMatch(/date_trunc\s*\(\s*'month'\s*,\s*m\.data_transacao/i);
    expect(sql).toMatch(/GROUP BY 1/i);
    expect(sql).toMatch(/ORDER BY total DESC/i);
    expect(result).toEqual([
      { category: "Moradia", total: 1500 },
      { category: "Lazer", total: 200 },
    ]);
  });

  it("mes sem movimentacoes retorna array vazio", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    vi.spyOn(pool, "query").mockResolvedValue({ rows: [] });

    const result = await repository.getSpendingByCategory(USER_A, "2026-08-01");
    expect(result).toEqual([]);
  });

  it("inclui limite inferior e exclui mes seguinte nos parametros", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({ rows: [] });

    await repository.getSpendingByCategory(USER_A, "2026-08-15");
    expect(querySpy.mock.calls[0][1]).toEqual([USER_A, "2026-08-01", "2026-09-01"]);

    await repository.getSpendingByCategory(USER_A, "2026-12-31");
    expect(querySpy.mock.calls[1][1]).toEqual([USER_A, "2026-12-01", "2027-01-01"]);
  });

  it("preserva formato de retorno com NULL total como 0", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    vi.spyOn(pool, "query").mockResolvedValue({
      rows: [{ category: "Outros", total: null }],
    });

    const result = await repository.getSpendingByCategory(USER_A, "2026-08-01");
    expect(result).toEqual([{ category: "Outros", total: 0 }]);
  });

  it("isola usuarios via parametro $1", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    const querySpy = vi.spyOn(pool, "query").mockImplementation(async (_sql, params) => ({
      rows:
        params[0] === USER_A
          ? [{ category: "Moradia", total: 100 }]
          : [{ category: "Lazer", total: 999 }],
    }));

    const a = await repository.getSpendingByCategory(USER_A, "2026-08-01");
    const b = await repository.getSpendingByCategory(USER_B, "2026-08-01");

    expect(querySpy.mock.calls[0][1][0]).toBe(USER_A);
    expect(querySpy.mock.calls[1][1][0]).toBe(USER_B);
    expect(a[0].total).toBe(100);
    expect(b[0].total).toBe(999);
  });

  it("mantem tipos de despesa e exclusao de cancelada no SQL", async () => {
    const pool = require("../../backend/src/database/pool");
    const repository = require("../../backend/src/modules/personalization/personalization.repository");

    const querySpy = vi.spyOn(pool, "query").mockResolvedValue({ rows: [] });
    await repository.getSpendingByCategory(USER_A, "2026-08-01");

    const sql = querySpy.mock.calls[0][0];
    expect(sql).toMatch(/despesa/);
    expect(sql).toMatch(/recorrencia/);
    expect(sql).toMatch(/compra_parcelada/);
    expect(sql).toMatch(/pagamento_fatura/);
    expect(sql).toMatch(/status\s*<>\s*'cancelada'/);
    expect(sql).toMatch(/usuario_id\s*=\s*\$1/);
  });
});
