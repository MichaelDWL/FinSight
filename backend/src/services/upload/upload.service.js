/**
 * UploadService — nunca persiste arquivo em disco local.
 * Provider atual: stub (MVP). Preparado para Cloudinary (ou S3) via env.
 * Controllers/Services devem chamar apenas este modulo.
 */

const env = require("../../config/env");
const logger = require("../../utils/logger");
const AppError = require("../../utils/AppError");

function getProvider() {
  return env.uploadProvider || "stub";
}

async function uploadWithStub({ buffer, filename, mimeType, folder }) {
  const id = `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  logger.info("UploadService stub (sem persistencia)", {
    id,
    filename,
    mimeType,
    folder,
    bytes: buffer?.length || 0,
  });
  return {
    id,
    provider: "stub",
    url: null,
    publicId: id,
    mimeType: mimeType || null,
    bytes: buffer?.length || 0,
  };
}

async function uploadWithCloudinary({ buffer, filename, mimeType, folder }) {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new AppError("Cloudinary nao configurado (CLOUDINARY_*).", 503);
  }

  // Integracao futura: cloudinary.uploader.upload_stream
  // Mantido como contrato estavel sem dependencia obrigatoria no MVP.
  throw new AppError(
    "Upload Cloudinary ainda nao habilitado neste ambiente. Use UPLOAD_PROVIDER=stub.",
    501
  );
}

/**
 * @param {{ buffer: Buffer, filename?: string, mimeType?: string, folder?: string }} input
 */
async function upload(input) {
  if (!input?.buffer || !Buffer.isBuffer(input.buffer)) {
    throw new AppError("Upload invalido: buffer obrigatorio.", 400);
  }

  const payload = {
    buffer: input.buffer,
    filename: input.filename || "file",
    mimeType: input.mimeType || "application/octet-stream",
    folder: input.folder || "finsight",
  };

  const provider = getProvider();
  if (provider === "cloudinary") {
    return uploadWithCloudinary(payload);
  }
  return uploadWithStub(payload);
}

async function remove(_publicId) {
  const provider = getProvider();
  if (provider === "cloudinary") {
    throw new AppError("Remocao Cloudinary ainda nao habilitada.", 501);
  }
  logger.info("UploadService stub remove (noop)", { publicId: _publicId });
  return { ok: true, provider: "stub" };
}

module.exports = {
  upload,
  remove,
  getProvider,
};
