const env = require("../../config/env");
const logger = require("../../utils/logger");

const TEMPLATES = {
  welcome: ({ name }) => ({
    subject: "Bem-vindo ao FinSight",
    text: `Ola ${name},\n\nSua conta no FinSight foi criada com sucesso.\n\nEquipe FinSight`,
    html: `<p>Ola <strong>${escapeHtml(name)}</strong>,</p><p>Sua conta no FinSight foi criada com sucesso.</p><p>Equipe FinSight</p>`,
  }),
  passwordReset: ({ name, resetUrl }) => ({
    subject: "Recuperacao de senha — FinSight",
    text: `Ola ${name},\n\nUse o link abaixo para redefinir sua senha (valido por tempo limitado):\n${resetUrl}\n\nSe voce nao solicitou, ignore este email.`,
    html: `<p>Ola <strong>${escapeHtml(name)}</strong>,</p><p>Use o link abaixo para redefinir sua senha:</p><p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p><p>Se voce nao solicitou, ignore este email.</p>`,
  }),
  emailVerification: ({ name, verifyUrl }) => ({
    subject: "Confirme seu email — FinSight",
    text: `Ola ${name},\n\nConfirme seu email acessando:\n${verifyUrl}`,
    html: `<p>Ola <strong>${escapeHtml(name)}</strong>,</p><p><a href="${escapeHtml(verifyUrl)}">Confirmar email</a></p>`,
  }),
  accountSuspended: ({ name }) => ({
    subject: "Conta suspensa — FinSight",
    text: `Ola ${name},\n\nSua conta encontra-se temporariamente suspensa. Entre em contato com o suporte.`,
    html: `<p>Ola <strong>${escapeHtml(name)}</strong>,</p><p>Sua conta encontra-se temporariamente suspensa. Entre em contato com o suporte.</p>`,
  }),
  accountReactivated: ({ name }) => ({
    subject: "Conta reativada — FinSight",
    text: `Ola ${name},\n\nSua conta foi reativada. Voce ja pode acessar o FinSight novamente.`,
    html: `<p>Ola <strong>${escapeHtml(name)}</strong>,</p><p>Sua conta foi reativada. Voce ja pode acessar o FinSight novamente.</p>`,
  }),
  passwordChanged: ({ name }) => ({
    subject: "Senha alterada — FinSight",
    text: `Ola ${name},\n\nSua senha foi alterada com sucesso. Se nao foi voce, redefina imediatamente e contate o suporte.`,
    html: `<p>Ola <strong>${escapeHtml(name)}</strong>,</p><p>Sua senha foi alterada com sucesso. Se nao foi voce, redefina imediatamente e contate o suporte.</p>`,
  }),
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendWithConsole({ to, subject, text }) {
  logger.info("Email (console provider)", { to, subject, text });
  return { id: `console-${Date.now()}`, provider: "console" };
}

async function sendWithResend({ to, subject, text, html }) {
  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY nao configurada.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha Resend: ${response.status} ${body}`);
  }

  return response.json();
}

async function sendWithNodemailer({ to, subject, text, html }) {
  // Carregamento lazy — nodemailer e opcional ate instalar o pacote.
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch {
    throw new Error("Pacote nodemailer nao instalado. Use EMAIL_PROVIDER=console|resend.");
  }

  if (!env.smtpHost) {
    throw new Error("SMTP_HOST nao configurado.");
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });

  const info = await transporter.sendMail({
    from: env.emailFrom,
    to,
    subject,
    text,
    html,
  });

  return { id: info.messageId, provider: "nodemailer" };
}

async function sendEmail({ to, template, vars = {} }) {
  const builder = TEMPLATES[template];
  if (!builder) {
    throw new Error(`Template de email desconhecido: ${template}`);
  }

  const content = builder(vars);
  const payload = { to, ...content };

  try {
    if (env.emailProvider === "resend") return await sendWithResend(payload);
    if (env.emailProvider === "nodemailer") return await sendWithNodemailer(payload);
    return await sendWithConsole(payload);
  } catch (error) {
    logger.error("Falha ao enviar email", { to, template, error: error.message });
    // Nao propaga para nao vazar enumeracao / falhar fluxos criticos em prod soft-fail
    return null;
  }
}

module.exports = { sendEmail, TEMPLATES };
