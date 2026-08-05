/**
 * tool_calls调用工具函数
 */

/** 工具调用对象 */
export type ToolCallAcc = {
  id?: string; // 工具调用ID
  name?: string; // 工具名称
  arguments?: string; // 工具参数
};

/** 最终的工具调用 */
export type FinalToolCall = ToolCallAcc;

/**
 * 合并工具调用Delta
 * @param map 工具调用Map，key为工具调用索引，value为工具调用对象
 * @param deltas 工具调用Delta数组
 */
export function mergeToolCallDeltas(
  map: Map<number, ToolCallAcc>,
  deltas: Array<{
    id?: string; // 工具调用ID
    index?: number; // 工具调用索引
    function?: {
      name?: string; // 工具名称
      arguments?: string; // 工具参数
    };
  }>,
) {
  for (const d of deltas) {
    const index = d.index ?? 0;
    const cur = map.get(index) ?? { arguments: '' };
    if (d.id) cur.id = d.id;
    if (d.function?.name) cur.name = d.function.name;
    if (d.function?.arguments) cur.arguments += d.function.arguments;
    map.set(index, cur);
  }
}

/**
 * 最终化工具调用
 * @param map 工具调用Map，key为工具调用索引，value为工具调用对象
 * @returns 最终的工具调用数组
 */
export function finalizeToolCalls(map: Map<number, ToolCallAcc>): FinalToolCall[] {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([_, v]) => v)
    .filter((t): t is ToolCallAcc & { id: string; name: string } => !!t.id && !!t.name)
    .map((t) => ({
      id: t.id,
      name: t.name,
      arguments: t.arguments || '{}',
    }));
}
