export type Chunk = {
  id: string;
  source: string; // 文件名，如 "rag简介.md"
  text: string;
};

export type IndexedChunk = Chunk & {
  embedding: number[];
};

export type RetrieveHit = Chunk & {
  score: number;
};
