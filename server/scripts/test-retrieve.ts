import 'dotenv/config';
import { retrieve } from '../src/services/indexer';
import { chatCompletion } from '../src/services/deepseek.js';

console.time('计算embedded时间');
const hits = await retrieve('pacs系统有哪些业务模块', 3);
hits.forEach((hit) => {
  console.log('[ hit ] >', hit.score, hit.source, hit.text?.slice(0, 30));
});
console.timeEnd('计算embedded时间');

const messages = [
  {
    role: 'system',
    content: `你是知识库助手。只根据「参考资料」回答；资料不足就说不知道，不要编造。
参考资料：
${hits.map((h, i) => `[${i + 1}] (${h.source}) ${h.text}`).join('\n\n')}`,
  },
  {
    role: 'user',
    content: 'pacs系统有哪些业务模块',
  },
];
const response = await chatCompletion(messages);
console.log('[ response ] >', response);
