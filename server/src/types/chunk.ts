/** 文本片段（切分 / 检索 / 引用的公共字段） */
export type Chunk = {
  id: string;
  source: string; // 文件名，如 "rag简介.md"
  text: string;
};

/** 入库后的 chunk（带向量） */
export type IndexedChunk = Chunk & {
  embedding: number[];
};

/**
 * 检索命中 / 前端 citations 同一形状。
 * SSE、对话持久化都复用此类型，避免再定义 Citation 副本。
 */
export type RetrieveHit = Chunk & {
  score: number;
};

/** 语义别名：对外展示「引用」时可用 */
export type Citation = RetrieveHit;
