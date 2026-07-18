/** Mapeamento método de pagamento UI ↔ API. */

export function mapPaymentMethod(payment) {
  const paymentMap = {
    Pix: "pix",
    "Cartão de Débito": "debito",
    "Cartão de Crédito": "cartao_credito",
    Dinheiro: "dinheiro",
    Boleto: "boleto",
  };

  return paymentMap[payment] || "pix";
}

export function mapPaymentLabel(payment) {
  const paymentMap = {
    pix: "Pix",
    debito: "Cartão de Débito",
    credito: "Cartão de Crédito",
    cartao_credito: "Cartão de Crédito",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    transferencia: "Pix",
    outros: "Pix",
  };

  return paymentMap[payment] || payment || "Pix";
}
