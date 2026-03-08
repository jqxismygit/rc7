/**
 * 将 custom-tab-bar（微信原生四件套）复制到 mp-weixin 编译输出目录。
 * uni-app 不会自动拷贝该目录，编译后需执行此脚本，否则微信开发者工具会报 ENOENT。
 *
 * 使用：在 apps/mini 目录下执行
 *   node scripts/copy-custom-tab-bar.js
 *
 * 或在 HBuilderX 中：菜单 运行 -> 运行到小程序模拟器 -> 微信开发者工具，编译完成后手动执行上述命令。
 */
const path = require('path')
const fs = require('fs')

const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'custom-tab-bar')
const outDir = path.join(root, 'unpackage', 'dist', 'dev', 'mp-weixin', 'custom-tab-bar')

const files = ['index.js', 'index.json', 'index.wxml', 'index.wxss']

if (!fs.existsSync(srcDir)) {
  console.warn('[copy-custom-tab-bar] 源目录不存在:', srcDir)
  process.exit(0)
}

fs.mkdirSync(outDir, { recursive: true })
for (const name of files) {
  const src = path.join(srcDir, name)
  const dest = path.join(outDir, name)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log('[copy-custom-tab-bar] 已复制:', name)
  }
}
console.log('[copy-custom-tab-bar] 完成 ->', outDir)
