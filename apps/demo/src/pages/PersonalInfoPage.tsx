import { Link, useSearchParams } from 'react-router-dom'
import './demoPages.css'

/** 对 query 做 URI 解码；若已是原文或含非法转义则原样返回，避免抛错 */
function safeDecodeParam(raw: string | null): string {
  if (raw == null || raw === '') return ''
  const s = raw.trim()
  if (!s) return ''
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * 与小程序 game-detail 约定：H5 地址上携带 query
 *   ?id=用户ID&avatar=头像URL&nickname=昵称
 * 由小程序在打开 web-view 时自动拼接
 */
export function PersonalInfoPage() {
  const [searchParams] = useSearchParams()
  const id = safeDecodeParam(searchParams.get('id'))
  const avatar = safeDecodeParam(searchParams.get('avatar'))
  const nickname = safeDecodeParam(searchParams.get('nickname'))
  const hasAny = Boolean(id || avatar || nickname)

  return (
    <div className="demo-page">
      <Link className="demo-back" to="/">
        ← 返回
      </Link>
      <h1 className="demo-title">个人信息</h1>
      <p className="demo-desc">
        以下数据来自地址栏（小程序内嵌 H5 时由端上拼接
        <code> id / avatar / nickname </code>）
      </p>

      {hasAny ? (
        <div className="demo-user-card">
          <div className="demo-user-avatar-wrap">
            {avatar ? (
              <img
                className="demo-user-avatar"
                src={avatar}
                alt=""
                width={96}
                height={96}
              />
            ) : (
              <div className="demo-user-avatar demo-user-avatar--placeholder" />
            )}
          </div>
          <div className="demo-user-meta">
            <p className="demo-user-row">
              <span className="demo-user-label">昵称</span>
              <span className="demo-user-value">
                {nickname || '（未传 nickname）'}
              </span>
            </p>
            <p className="demo-user-row">
              <span className="demo-user-label">用户 ID</span>
              <span className="demo-user-value demo-user-mono">
                {id || '（未传 id）'}
              </span>
            </p>
            <p className="demo-user-row">
              <span className="demo-user-label">头像</span>
              <span className="demo-user-value demo-user-mono demo-user-break">
                {avatar || '（未传 avatar）'}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <p className="demo-desc demo-desc--hint">
          未检测到 URL 参数。请在微信开发者工具中从「互动」进入 web-view，或访问：
          <br />
          <code>
            /personal?id=xxx&avatar=xxx&nickname=xxx
          </code>
        </p>
      )}
    </div>
  )
}
