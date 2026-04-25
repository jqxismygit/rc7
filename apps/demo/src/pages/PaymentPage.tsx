import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./demoPages.css";
import {
  clearPendingPayment,
  createPaymentRequestPayload,
  navigateToMiniProgramPaymentBridge,
  persistPendingPayment,
  postMiniProgramPaymentMessage,
} from "./paymentBridge";

/**
 * 演示：H5 跳转小程序原生支付页，支付完成后再回跳当前页展示结果
 */
export function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [amount, setAmount] = useState(searchParams.get("amount") || "0.01");
  const [paying, setPaying] = useState(false);
  const paymentResult = useMemo(() => {
    const status = searchParams.get("payStatus");
    if (!status) return null;

    return {
      status,
      orderId: searchParams.get("orderId") || "",
      amount: searchParams.get("amount") || amount,
      message: searchParams.get("payMessage") || "",
      paidAt: searchParams.get("paidAt") || "",
    };
  }, [amount, searchParams]);

  useEffect(() => {
    if (paymentResult) {
      clearPendingPayment();
    }
  }, [paymentResult]);

  function handlePay() {
    setPaying(true);
    const payload = createPaymentRequestPayload(amount);
    persistPendingPayment(payload);
    console.log("payload====================>>>", payload);
    if (navigateToMiniProgramPaymentBridge(payload)) {
      setPaying(false);
      return;
    }
    postMiniProgramPaymentMessage(payload);

    navigate(
      `/payment-loading?requestId=${encodeURIComponent(payload.requestId)}&orderId=${encodeURIComponent(payload.orderId)}&amount=${encodeURIComponent(payload.amount)}`,
    );
  }

  return (
    <div className="demo-page">
      <Link className="demo-back" to="/">
        ← 返回
      </Link>
      <h1 className="demo-title">支付</h1>
      <p className="demo-desc">
        点击按钮后会跳到小程序原生支付页，由小程序拉起支付并在完成后回跳当前页
      </p>
      <div className="demo-form-row">
        <label htmlFor="amount">支付金额（元）</label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="demo-actions">
        <button
          type="button"
          className="demo-link-btn"
          disabled={paying}
          onClick={handlePay}
        >
          {paying ? "跳转中…" : "去小程序支付"}
        </button>
      </div>
      {paymentResult ? (
        <div
          className={
            paymentResult.status === "success"
              ? "demo-result-card is-success"
              : "demo-result-card is-error"
          }
        >
          <p className="demo-result-title">
            {paymentResult.status === "success" ? "支付成功" : "支付未完成"}
          </p>
          <p className="demo-result-text">
            订单号：{paymentResult.orderId || "-"}
          </p>
          <p className="demo-result-text">
            支付金额：{paymentResult.amount} 元
          </p>
          {paymentResult.paidAt ? (
            <p className="demo-result-text">完成时间：{paymentResult.paidAt}</p>
          ) : null}
          {paymentResult.message ? (
            <p className="demo-result-text">{paymentResult.message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
