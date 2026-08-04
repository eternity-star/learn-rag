/**
 * 对话持久化（本地 JSON）
 * 后续可替换为 Postgres，尽量保持本模块对外方法稳定。
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHttpError } from '../utils/errors.js';
import type { ChatRole } from '../types/chat.js';
import type { RetrieveHit } from '../types/chunk.js';
import type {
  Conversation,
  ConversationMessage,
  ConversationSummary,
} from '../types/conversation.js';

const dataFile = path.resolve(import.meta.dirname, '../../data/conversations.json');

const DEFAULT_TITLE = '新的对话';
const TITLE_MAX = 40;

/**
 * 确保数据文件存在
 */
function ensureFile() {
  const dir = path.dirname(dataFile);
  // 递归创建目录
  fs.mkdirSync(dir, { recursive: true });
  // 如果文件不存在，则创建文件
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf-8');
}

/**
 * 读取所有对话
 * @returns 所有对话
 */
function readAll(): Conversation[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(dataFile, 'utf-8');
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data as Conversation[];
  } catch {
    return [];
  }
}

/**
 * 写入所有对话
 * @param list 所有对话
 */
function writeAll(list: Conversation[]) {
  ensureFile();
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf-8');
}

/**
 * 获取当前时间
 * @returns 当前时间
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * 清理消息中的临时字段
 * @param messages 消息
 * @returns 去掉临时字段后的消息
 */
const CHAT_ROLES = new Set<ChatRole>(['system', 'user', 'assistant']);

export function sanitizeMessages(messages: unknown): ConversationMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .filter(
      (m) =>
        typeof m.role === 'string' &&
        CHAT_ROLES.has(m.role as ChatRole) &&
        typeof m.content === 'string',
    );
}

function titleFromMessages(messages: ConversationMessage[], fallback = DEFAULT_TITLE) {
  const firstUser = messages.find((m) => m.role === 'user' && m.content.trim());
  if (!firstUser) return fallback;
  const t = firstUser.content.trim().replace(/\s+/g, ' ');
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX)}…` : t;
}

function toSummary(c: Conversation): ConversationSummary {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** 列表：按更新时间倒序 */
export function listConversations(): ConversationSummary[] {
  return readAll()
    .map(toSummary)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getConversation(id: string): Conversation {
  const found = readAll().find((c) => c.id === id);
  if (!found) throw createHttpError('对话不存在', 404);
  return found;
}

/**
 * 创建对话
 * @param title 标题
 * @returns 创建的对话
 */
export function createConversation(title?: string): Conversation {
  const list = readAll();
  // 获取当前时间
  const ts = nowIso();
  // 创建对话
  const item: Conversation = {
    id: randomUUID(),
    title: (title?.trim() || DEFAULT_TITLE).slice(0, TITLE_MAX),
    createdAt: ts,
    updatedAt: ts,
    messages: [],
  };
  list.unshift(item);
  writeAll(list);
  return item;
}

/**
 * 更新对话
 * @param id 对话ID
 * @param patch 更新内容
 * @returns 更新后的对话
 */
export function updateConversation(
  id: string,
  patch: { title?: string; messages?: unknown },
): Conversation {
  const list = readAll();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) throw createHttpError('对话不存在', 404);

  const current = list[idx]!;
  if (typeof patch.title === 'string' && patch.title.trim()) {
    current.title = patch.title.trim().slice(0, TITLE_MAX);
  }
  if (patch.messages !== undefined) {
    current.messages = sanitizeMessages(patch.messages);
    // 仍是默认标题时，用首条用户消息生成
    if (!current.title || current.title === DEFAULT_TITLE) {
      current.title = titleFromMessages(current.messages);
    }
  }
  current.updatedAt = nowIso();
  list[idx] = current;
  writeAll(list);
  return current;
}

/**
 * 删除对话
 * @param id 对话ID
 * @returns 删除的对话ID
 */
export function deleteConversation(id: string): { id: string } {
  const list = readAll();
  // 过滤掉要删除的对话
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) throw createHttpError('对话不存在', 404);
  writeAll(next);
  return { id };
}
