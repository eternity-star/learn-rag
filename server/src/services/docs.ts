/**
 * 文档服务
 * 提供文档的增删改查操作
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHttpError } from '../utils/errors';

const docsDir = path.resolve(import.meta.dirname, '../../data/docs');

/**
 * 安全地提取文档名
 * @param name 文档路径
 * @returns 安全文档名
 */
function safeDocName(name: string) {
  // 取纯文件名（去掉目录路径，防路径穿越）并去掉首尾空白
  const base = path.basename(name).trim();
  // 含义：拒绝空文件名；并校验「去路径后的名字」与「手动取最后一段」一致。
  // 不一致通常表示原 name 含首尾空白，或在部分平台上含异常路径分隔符，视为非法输入。
  if (!base || base !== name.replace(/\\/g, '/').split('/').pop()) {
    throw createHttpError('文档名无效', 400);
  }
  if (!/\.(md|txt)$/i.test(base)) {
    throw createHttpError('仅支持 .md / .txt', 400);
  }
  return base;
}

/**
 * 列出所有文档
 * @returns 文档列表
 */
export function listDocs() {
  if (!fs.existsSync(docsDir)) return [];
  return fs
    .readdirSync(docsDir)
    .filter((f) => /\.(md|txt)$/i.test(f))
    .map((name) => {
      const stat = fs.statSync(path.join(docsDir, name));
      return {
        name,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      };
    });
}

/**
 * 读取文档内容
 * @param name 文档名
 * @returns 文档名与正文
 */
export function readDoc(name: string) {
  const safeName = safeDocName(name);
  const full = path.join(docsDir, safeName);
  if (!fs.existsSync(full)) throw createHttpError('文件不存在', 404);
  return {
    name: safeName,
    content: fs.readFileSync(full, 'utf-8'),
  };
}

/**
 * 保存文档
 * @param name 文档名
 * @param content 文档内容
 * @returns 保存后的文档名
 */
export function saveDoc(name: string, content: string) {
  const safeName = safeDocName(name);
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, safeName), content, 'utf-8');
  return safeName;
}

/**
 * 删除文档
 * @param name 文档名
 * @returns 删除后的文档名
 */
export function deleteDoc(name: string) {
  const safeName = safeDocName(name);
  const full = path.join(docsDir, safeName);
  if (!fs.existsSync(full)) throw createHttpError('文件不存在', 404);
  fs.unlinkSync(full);
  return safeName;
}

/**
 * 获取文档目录
 * @returns 文档目录
 */
export function getDocsDir() {
  return docsDir;
}
