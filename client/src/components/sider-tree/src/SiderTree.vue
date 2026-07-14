<template>
  <div
    class="silder-document"
    :style="{
      '--component-height': height,
      '--min-left-width': minLeftWidth + 'px',
      '--max-left-width': maxLeftWidth + 'px',
    }"
  >
    <div class="template-left">
      <div class="resize-bar"></div>
      <div class="resize-line"></div>
      <div class="resize-content">
        <slot name="left-content"></slot>
      </div>
    </div>
    <div class="template-right">
      <slot name="right-content"></slot>
    </div>
  </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue';

const props = withDefaults(
  defineProps<{
    height?: string;
    minLeftWidth?: number;
    maxLeftWidth?: number;
  }>(),
  {
    height: '100vh',
    minLeftWidth: 315,
    maxLeftWidth: 600,
  },
);

const { height, minLeftWidth, maxLeftWidth } = toRefs(props);
</script>
<style lang="less" scoped>
.silder-document {
  padding: 10px;
  height: var(--component-height);
  .template-left {
    float: left;
    height: calc(var(--component-height) - 20px);
    overflow-y: auto;
    position: relative;
  }
  .template-right {
    // width: 70%;
    min-width: calc(100% - var(--max-left-width));
    max-width: calc(100% - var(--min-left-width));
    height: calc(var(--component-height) - 20px);
    overflow-y: auto;
    padding: 10px;
    .template-header {
      margin-bottom: 10px;
    }
    .template-body {
      width: 100%;
      height: 100%;
    }
  }
}
.resize-content {
  position: absolute;
  top: 0;
  right: 5px;
  bottom: 0;
  left: 0;
  padding: 10px;
  padding-left: 0px;
  overflow-x: hidden;
}

.resize-bar {
  max-width: var(--max-left-width);
  height: inherit;
  resize: horizontal;
  cursor: ew-resize;
  cursor: col-resize;
  opacity: 0;
  overflow: scroll;
}

/* 拖拽线 */
.resize-line {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  // border-right: 1px solid #e9eff8;
  border-left: 1px solid #e9eff8;
  pointer-events: none;
}

.resize-bar::-webkit-scrollbar {
  width: var(--min-left-width);
  height: inherit;
  cursor: ew-resize;
  cursor: col-resize;
}

/* Firefox只有下面一小块区域可以拉伸 */
@supports (-moz-user-select: none) {
  .resize-bar:hover ~ .resize-line,
  .resize-bar:active ~ .resize-line {
    border-left: 1px solid #e9eff8;
  }

  .resize-bar:hover ~ .resize-line::after,
  .resize-bar:active ~ .resize-line::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    bottom: 0;
    right: -8px;
    background-size: 100% 100%;
  }
}
</style>
