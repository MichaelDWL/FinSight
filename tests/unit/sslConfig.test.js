import { describe, expect, it, vi } from "vitest";
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  normalizePem,
  loadCaPem,
  buildSslConfig,
  describeSslMode,
  resolveCaFilePath,
  BUNDLED_SUPABASE_CA,
} = require("../../backend/src/database/sslConfig");

const SAMPLE_PEM = `-----BEGIN CERTIFICATE-----
MIIDummyForUnitTestOnlyNotARealCertificateABCDEFGHIJKLMNOPQRSTUV
-----END CERTIFICATE-----`;

describe("FASE 5 — sslConfig (Etapa 1 TLS Vercel)", () => {
  it("normalizePem aceita \\n literais de painel de env", () => {
    const oneline = SAMPLE_PEM.replace(/\n/g, "\\n");
    const normalized = normalizePem(oneline);
    expect(normalized).toContain("BEGIN CERTIFICATE");
    expect(normalized).toContain("\n");
    expect(normalized).not.toContain("\\n");
  });

  it("normalizePem rejeita valor sem PEM", () => {
    expect(() => normalizePem("not-a-cert")).toThrow(/BEGIN CERTIFICATE/);
  });

  it("loadCaPem prioriza DATABASE_SSL_CA_FILE", () => {
    const readFileSync = vi.fn(() => SAMPLE_PEM);
    const { pem, source } = loadCaPem(
      { databaseSslCa: null, databaseSslCaFile: "/tmp/ca.pem" },
      { readFileSync, existsSync: () => true },
    );
    expect(readFileSync).toHaveBeenCalled();
    expect(pem).toContain("BEGIN CERTIFICATE");
    expect(source).toBe("file");
  });

  it("loadCaPem usa CA empacotada quando env nao informa CA", () => {
    expect(fs.existsSync(BUNDLED_SUPABASE_CA)).toBe(true);
    const { pem, source } = loadCaPem({
      databaseSslCa: null,
      databaseSslCaFile: null,
    });
    expect(source).toBe("bundled");
    expect(pem).toContain("BEGIN CERTIFICATE");
  });

  it("resolveCaFilePath encontra backend/certs a partir de cwd raiz", () => {
    const resolved = resolveCaFilePath("backend/certs/supabase-root-2021-ca.crt");
    expect(resolved).toBeTruthy();
    expect(fs.existsSync(resolved)).toBe(true);
  });

  it("buildSslConfig desliga SSL quando DATABASE_SSL=false", () => {
    const warn = vi.fn();
    const ssl = buildSslConfig(
      { databaseSsl: false, isProduction: false },
      { warn },
    );
    expect(ssl).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("buildSslConfig avisa em producao sem SSL", () => {
    const warn = vi.fn();
    buildSslConfig({ databaseSsl: false, isProduction: true }, { warn });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("buildSslConfig insecure desabilita rejectUnauthorized", () => {
    const warn = vi.fn();
    const ssl = buildSslConfig(
      {
        databaseSsl: true,
        databaseSslInsecure: true,
        isProduction: true,
      },
      { warn },
    );
    expect(ssl.rejectUnauthorized).toBe(false);
    expect(ssl.ca).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("buildSslConfig seguro valida certificado e usa CA", () => {
    const ssl = buildSslConfig({
      databaseSsl: true,
      databaseSslInsecure: false,
      databaseSslCa: SAMPLE_PEM.replace(/\n/g, "\\n"),
      isProduction: true,
    });
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.ca).toContain("BEGIN CERTIFICATE");
    expect(describeSslMode(ssl).caSource).toBe("env");
  });

  it("buildSslConfig seguro sem env CA usa bundled Supabase Root", () => {
    const ssl = buildSslConfig({
      databaseSsl: true,
      databaseSslInsecure: false,
      databaseSslCa: null,
      databaseSslCaFile: null,
      isProduction: true,
    });
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.ca).toContain("BEGIN CERTIFICATE");
    expect(describeSslMode(ssl)).toMatchObject({
      enabled: true,
      rejectUnauthorized: true,
      caProvided: true,
      caSource: "bundled",
    });
  });

  it("describeSslMode nao vaza PEM", () => {
    expect(describeSslMode(false)).toEqual({
      enabled: false,
      rejectUnauthorized: null,
      caProvided: false,
      caSource: null,
    });
    const described = describeSslMode({
      rejectUnauthorized: true,
      ca: SAMPLE_PEM,
      __caSource: "env",
    });
    expect(described.caProvided).toBe(true);
    expect(JSON.stringify(described)).not.toContain("BEGIN CERTIFICATE");
  });

  it("CA empacotada nao esta sob pasta gitignored /certs", () => {
    expect(BUNDLED_SUPABASE_CA.replace(/\\/g, "/")).toMatch(/backend\/certs\//);
    expect(path.basename(BUNDLED_SUPABASE_CA)).toBe("supabase-root-2021-ca.crt");
  });
});
