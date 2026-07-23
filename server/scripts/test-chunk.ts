import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { chunkText } from '../src/services/chunk.ts';

// import.meta.dirname：当前脚本所在目录  path.join / path.resolve拼路径（Windows/Mac 都安全）
const docsDir = path.resolve(import.meta.dirname, '../data/docs');

// 列出目录下文件名;
const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const fullPath = path.resolve(docsDir, file);
  // 读文件成字符串
  const content = fs.readFileSync(fullPath, 'utf-8');
  const chunks = chunkText(file, content);

  console.log(`\n=== ${file} → ${chunks.length} 段 ===`);
  chunks.forEach(c => {
    console.log(`[${c.id}] 长度=${c.text.length}`);
    console.log(c.text.slice(0, 80).replace(/\n/g, ' ') + '...');
  });
}
