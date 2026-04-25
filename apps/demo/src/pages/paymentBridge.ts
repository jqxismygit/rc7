export const PAYMENT_MESSAGE_TYPE = "CR7_MINIAPP_PAYMENT_REQUEST";
export const PENDING_PAYMENT_STORAGE_KEY = "cr7-demo-pending-payment";

export type PaymentRequestPayload = {
  type: typeof PAYMENT_MESSAGE_TYPE;
  requestId: string;
  orderId: string;
  amount: string;
  subject: string;
  redirectUrl: string;
  createdAt: string;
};

declare global {
  interface Window {
    wx?: {
      miniProgram?: {
        postMessage?: (options: { data: unknown }) => void;
        navigateTo?: (options: { url: string }) => void;
      };
    };
  }
}

function buildRedirectUrl(amount: string) {
  const url = new URL(window.location.href);
  url.pathname = "/payment";
  url.search = "";
  url.hash = "";
  url.searchParams.set("amount", amount);
  return url.toString();
}

export function createPaymentRequestPayload(
  amount: string,
): PaymentRequestPayload {
  const safeAmount = amount.trim() || "0.01";
  return {
    type: PAYMENT_MESSAGE_TYPE,
    requestId: `payreq_${Date.now().toString(36)}`,
    // orderId: `demo_${Date.now().toString(36)}`,
    orderId: "e3fad6a6-5a6d-4224-92a3-acf9d8e0e448",
    amount: safeAmount,
    subject: "CR7 Demo 支付",
    redirectUrl: buildRedirectUrl(safeAmount),
    createdAt: new Date().toISOString(),
  };
}

export function persistPendingPayment(payload: PaymentRequestPayload) {
  window.sessionStorage.setItem(
    PENDING_PAYMENT_STORAGE_KEY,
    JSON.stringify(payload),
  );
}

export function readPendingPayment() {
  const raw = window.sessionStorage.getItem(PENDING_PAYMENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaymentRequestPayload;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
}

export function postMiniProgramPaymentMessage(payload: PaymentRequestPayload) {
  const message = {
    type: PAYMENT_MESSAGE_TYPE,
    payload,
  };
  if (window.wx?.miniProgram?.postMessage) {
    window.wx.miniProgram.postMessage({ data: message });
    return true;
  }

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, "*");
    return true;
  }

  return false;
}

function enc(key: string, value: string) {
  return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function buildMiniProgramPaymentBridgeUrl(
  payload: PaymentRequestPayload,
) {
  const query = [
    enc("requestId", payload.requestId),
    enc("orderId", payload.orderId),
    enc("amount", payload.amount),
    enc("subject", payload.subject),
    enc("redirectUrl", payload.redirectUrl),
  ].join("&");
  return `/pages/game/payment-bridge?${query}`;
}

export function navigateToMiniProgramPaymentBridge(
  payload: PaymentRequestPayload,
) {
  const url = buildMiniProgramPaymentBridgeUrl(payload);
  console.log("url====================>>>", url);
  if (!window.wx?.miniProgram?.navigateTo) return false;
  window.wx.miniProgram.navigateTo({ url });
  return true;
}
