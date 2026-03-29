// Vercel Serverless Function
export default async function handler(req, res) {
  // 动态导入后端服务
  const { default: app } = await import('../backend/src/server.js')
  return app.fetch(req, res)
}
