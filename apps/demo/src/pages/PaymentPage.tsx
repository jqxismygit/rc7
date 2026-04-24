import { useState } from 'react'
import { Link } from 'react-router-dom'
import './demoPages.css'

/**
 * 演示：仅前端流程占位；接入真实微信/支付宝等时在「发起支付」里调起 SDK 或跳收银台
 */
export function PaymentPage() {
  const [amount, setAmount] = useState('0.01')
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState(false)
  const [orderId, setOrderId] = useState('')

  function mockPay() {
    setPaying(true)
    setDone(false)
    setOrderId('')
    // 模拟创建订单 + 调起支付
    window.setTimeout(() => {
      const id = `demo_${Date.now().toString(36)}`
      setOrderId(id)
      setPaying(false)
      setDone(true)
    }, 800)
  }

  return (
    <div className="demo-page">
      <Link className="demo-back" to="/">
        ← 返回
      </Link>
      <h1 className="demo-title">支付</h1>
      <p className="demo-desc">演示金额与模拟支付，接入真实环境请替换为订单接口与支付渠道</p>
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
          onClick={mockPay}
        >
          {paying ? '处理中…' : '模拟支付'}
        </button>
      </div>
      {done && orderId ? (
        <p className="demo-success">
          支付成功（模拟）<br />
          订单号：{orderId}
        </p>
      ) : null}
    </div>
  )
}
