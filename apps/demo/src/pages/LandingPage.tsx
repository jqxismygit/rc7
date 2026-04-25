import { Link } from 'react-router-dom'
import './demoPages.css'

export function LandingPage() {
  return (
    <div className="demo-page">
      <h1 className="demo-title">Demo 入口</h1>
      <p className="demo-desc">选择要体验的演示能力</p>
      <div className="demo-actions">
        <Link className="demo-link-btn" to="/personal">
          个人信息获取
        </Link>
        <Link className="demo-link-btn secondary" to="/payment">
          支付
        </Link>
      </div>
    </div>
  )
}
