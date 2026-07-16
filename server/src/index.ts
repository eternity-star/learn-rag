import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3000;

// 允许前端跨域访问（本地 Vite 联调时有用）
app.use(cors());
// 解析 JSON 请求体（后面写 /api/chat 会用到）
app.use(express.json());
// 健康检查：用来确认服务已启动
app.get('/health', (_req, res) => {
  res.send('ok');
});
app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
