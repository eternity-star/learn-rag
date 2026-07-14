<template>
  <div class="ai-agent-self">
    <!-- 新增消息展示区域 -->
    <div class="message-list" ref="messageContainer">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        class="message-bubble"
        :class="{
          'user-message': msg.isUser,
          'return-message': !msg.isUser,
        }"
      >
        <div v-if="msg.isUser" class="message-content">
          <div style="display: flex; justify-content: space-between">
            <div v-html="msg.content"></div>
            <div class="author-photo ml5">
              <img
                v-if="userInfoMap && userInfoMap.headUrl"
                :src="userInfoMap.headUrl"
                alt=""
              />
              <n-avatar v-else size="large" icon="user" />
            </div>
          </div>
          <div class="message-time">{{ msg.time }}</div>
        </div>
        <div v-else style="display: flex">
          <div class="author-photo">
            <img v-if="aiLogo" :src="aiLogo" alt="" />
            <n-avatar v-else size="large" icon="user" />
          </div>
          <div
            v-if="msg.isMsgLoading"
            class="ml10"
            style="display: flex; line-height: 43px"
          >
            <span class="mr5">回答中</span>
            <div class="loading-dots">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
          <div v-else class="ml10 mt10" style="flex: 1">
            <div
              v-if="msg.isStream == 1 && parseFormat == 'html'"
              v-html="formatLinks(msg.content)"
              v-viewer
              class="message-content return-content"
            ></div>
            <div
              v-else-if="msg.isStream == 1 && parseFormat == 'markdown'"
              class="message-content return-content"
            >
              <mavon-editor
                v-model="msg.content"
                :subfield="false"
                :defaultOpen="'preview'"
                :toolbarsFlag="false"
                v-viewer
              />
            </div>
            <div
              v-else-if="msg.isStream == 0"
              class="message-content return-content"
            >
              {{ msg.content }}
            </div>
            <div class="message-time">{{ msg.time }}</div>
          </div>
        </div>
      </div>
    </div>
    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-box">
        <!-- 新增提示词展示 -->
        <n-input
          v-model="newMessage"
          type="textarea"
          :disabled="!isAllowInput"
          :auto-size="{ minRows: 3, maxRows: 9 }"
          :placeholder="
            selectedBusiness || isOnlyPage
              ? '请向我提问或输入/查看提示词'
              : '请先选择下方的业务对象'
          "
          style="width: 100%"
          @blur="handleInputBlur"
          @focus="handleInputFocus"
          @input="handlePromptInput"
          @keydown.enter.exact.prevent="sendMessage"
        ></n-input>
        <!-- 添加提示词下拉列表 -->
        <div
          v-if="showPrompts"
          class="prompt-list"
          @mousedown="e => e.preventDefault()"
        >
          <div
            v-for="(prompt, index) in filteredPrompts"
            :key="index"
            class="prompt-item"
            @click="selectPrompt(prompt)"
          >
            {{ prompt.label }}
          </div>
          <n-empty
            v-if="!filteredPrompts.length"
            style="margin: 10px 0"
          ></n-empty>
        </div>
        <div
          @click.stop="toggleRecording"
          class="mic-button"
          :class="{ recording: isRecording, 'disabled-send': !isAllowSend }"
        >
          <n-icon
            type="audio"
            :theme="isRecording ? 'twoTone' : 'outlined'"
            style="font-size: 18px"
          />
        </div>
        <div
          @click.stop="sendMessage"
          :class="['send-class', !isAllowSend ? 'disabled-send' : '']"
        >
          <img
            src="@/assets/image/ai/icon_send.svg"
            alt="发送"
            width="18px"
            height="18px"
          />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useRoute } from 'vue-router';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { isJSON } from '@/utils/obj';

const route = useRoute();
const message = useMessage();
const props = withDefaults(
  defineProps<{
    selectedBusiness?: any;
    isPage?: boolean;
  }>(),
  {
    selectedBusiness: null,
    isPage: false,
  },
);

const { selectedBusiness, isPage } = toRefs(props);

const parseFormat = ref(route.query.parseFormat || 'html'); // 解析格式 html markdown
const keyField = ref(route.query.keyField || 'id'); // 获取外面列表哪个字段
const paramField = ref(route.query.paramField || ''); // 接口传参哪个字段
const isSendType = ref(route.query.isSendType || ''); // 发送方式 1-进页面后直接发送消息
const isStream = ref(route.query.isStream || '1'); // 1非json 0json
const aiType = ref(route.query.aiType || ''); // AI模型类型 1-cnhis 2-deepseek
const type = ref(route.query.type || ''); // 类型
const isFirstSend = ref(true); // 是否第一次发送消息
const selectedRows = ref([]); // 外面列表 选中的行数据
// const aiLogo = ref(require('../../../assets/image/ai/logo.png'));
const aiLogo = ref('');
const messages = ref([]); // 消息列表
const newMessage = ref(''); // 输入框内容
const isSending = ref(false); // 发送状态
const userInfoMap = ref({}); // 用户数据
const isRecording = ref(false); //是否在语音识别文字中
const oldMessage = ref(''); // 旧消息
const transcript = ref(''); //语音识别后的文本
const socket = ref(null); // WebSocket连接
const recorder = ref(null); // 语音识别对象
const audioContext = ref(null);
const status = ref(''); //语音状态
const chatId = ref('');

const errorMsg = ref(null); // 错误信息
const errorCount = ref(0); // 错误计数
const maxErrorCount = ref(5); // 最大错误计数
const controller = ref(null); // 用于中止请求

const showPrompts = ref(false);
const filteredPrompts = ref([]);
const promptList = ref([]);
const selectedPrompt = ref(null);

const messageContainer = ref<typeof HTMLElement>();

// 1-作为独立页面使用
const isOnlyPage = computed(() => {
  return route.query.isOnlyPage == '1' || isPage.value;
});
// 是否允许输入
const isAllowInput = computed(() => {
  return (selectedBusiness.value || isOnlyPage.value) && !isSending.value;
});
// 是否允许发送
const isAllowSend = computed(() => {
  return (
    isAllowInput.value &&
    (!!newMessage.value?.trim?.() || (isOnlyPage.value && isFirstSend.value))
  );
});
// 是否返回文本类的消息
const isTextMsg = computed(() => {
  return selectedBusiness.value?.isStream == 1 || isStream.value == '1';
});

// 处理消息参数
function handlerMessageParams() {
  const params = {};
  if (isOnlyPage.value) {
    Object.assign(params, {
      type: type.value,
      aiType: aiType.value,
      question: newMessage.value,
      chatId: chatId.value,
      isStream: isStream.value,
      isAppendJson: isStream.value == '1' ? '0' : '1', //是否默认拼接json返回格式 1是 默认是
      params: {
        ...route.query,
        [paramField.value || keyField.value]:
          selectedRows.value?.map(it => it?.[keyField.value])?.join(',') || '',
      },
    });
  } else {
    Object.assign(params, {
      type: selectedBusiness.value?.instructType,
      question: newMessage.value,
      chatId: chatId.value,
    });
  }
  return params;
}
async function sendMessage() {
  if (!isAllowSend.value) return;

  if (isOnlyPage.value && isFirstSend.value) {
    isFirstSend.value = false;
  } else {
    // 添加用户消息
    messages.value.push({
      content: newMessage.value,
      isUser: true,
      time: new Date().toLocaleTimeString(),
    });
  }

  // isStream 1非json 0json
  const params = handlerMessageParams();
  if (!params) return;
  // 创建AbortController以支持中止请求
  controller.value = new AbortController();

  let aiReturnMsg = {
    content: '',
    isStream: isOnlyPage.value
      ? isStream.value || 1
      : (selectedBusiness.value?.isStream ?? 1),
    isUser: false,
    time: '',
    isMsgLoading: false, // 消息是否显示加载中 当是流式返回json时需要等待全部数据返回后在停止渲染；当流式返回文本时不需要等待全部数据返回后在停止渲染
  };
  // 非json则正常返回渲染
  if (isTextMsg.value) {
    messages.value.push(aiReturnMsg);
  }
  let url = isOnlyPage.value
    ? '/process/ai/autoQuestionAiChat'
    : '/process/ai/chatAi';
  isSending.value = true;
  aiReturnMsg.isMsgLoading = true;
  // 发送消息
  fetchEventSource(url, {
    signal: controller.value.signal,
    method: 'post',
    responseType: 'stream',
    openWhenHidden: true, //切换到后台时，也会保持请求的打开状态。
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
    }),
    // 接收流式数据
    onmessage(res) {
      if (isTextMsg.value) {
        aiReturnMsg.isMsgLoading = false;
      }
      let value = res?.data || '';
      try {
        let str = value?.replace('data:', '') || '';
        let obj = JSON.parse(str);
        if (obj) {
          obj = isJSON(obj) ? JSON.parse(obj) : obj;
          // 默认赋值
          if (obj?.chat_id && (selectedBusiness.value || isOnlyPage.value)) {
            chatId.value = obj?.chat_id;
          }
          let stri = obj?.content;
          aiReturnMsg.content += stri;
        }
      } catch (err) {
        console.log('[ err ] >', err);
        message.error('解析错误');
      }
    },
    // 链接关闭
    onclose() {
      console.log('连接已关闭');
      aiReturnMsg.time = new Date().toLocaleTimeString();

      // json则全部返回后处理渲染
      if (selectedBusiness.value?.isStream == 0) {
        handlerJsonObj(aiReturnMsg);
      }
      isSending.value = false;
      aiReturnMsg.isMsgLoading = false;
      newMessage.value = '';
      abortFetch?.();
    },
    // 处理报错信息
    onerror(err) {
      console.log('错误', err);
      isSending.value = false;
      aiReturnMsg.content =
        '抱歉，没有查找到相关内容，请重新描述您的问题或提供更多信息。';
      aiReturnMsg.isMsgLoading = false;
      if (err.name === 'AbortError') {
        console.log('请求被中止');
        errorMsg.value = '服务器繁忙，请稍后再试';
      } else {
        errorMsg.value = err.message; // 显示错误信息
      }
      abortFetch?.();
      throw err;
    },
  });
}
//中断请求
function abortFetch() {
  console.log('[ "中断请求" ] >', '中断请求');
  controller.value?.abort?.(); //中断请求
}
// 点击录音按钮
async function toggleRecording() {
  if (!isAllowInput.value) return;
  if (isRecording.value) {
    await stopRecording();
  } else {
    await startRecording();
  }
}
function initWebSocket() {
  socket.value = new WebSocket('wss://emr-tl.cnhis.com/audio/socket');
  socket.value.onopen = () => {
    console.log('[ "连接成功，点击开始说话" ] >', '连接成功，点击开始说话');
  };
  socket.value.onmessage = event => {
    const response = JSON.parse(event.data);
    if (response.code === 0) {
      transcript.value = response.data.text;
      newMessage.value = oldMessage.value + transcript.value;
    }
  };
  socket.value.onerror = error => {
    console.error('WebSocket error:', '连接异常，请刷新重试', error);
  };
  socket.value.onclose = error => {
    console.error('WebSocket error:', '连接关闭', error);
  };
}
// 开始录音
async function startRecording() {
  try {
    // 新增权限状态检查
    const permission = await navigator.permissions.query({
      name: 'microphone',
    });
    if (permission.state === 'denied') {
      status.value = '麦克风权限被拒绝，请前往浏览器设置开启';
      message.error(status.value);
      return;
    }

    oldMessage.value = newMessage.value;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    if (!socket.value) initWebSocket();
    audioContext.value = new (
      window.AudioContext || window.webkitAudioContext
    )();
    recorder.value = new Recorder(audioContext.value, {
      sampleRate: 16000,
      bitRate: 16,
      numChannels: 1,
    });
    recorder.value.init(stream);
    recorder.value.start();
    const audioRecorder = recorder.value.audioRecorder;
    const _this = this;
    // 每500ms发送一次音频数据
    interval.value = setInterval(() => {
      if (audioRecorder) {
        audioRecorder.getBuffer(buffer => {
          audioRecorder.exportWAV(blob => {
            socket.value.send(blob);
          });
        });
      }
    }, 500);
    isRecording.value = true;
    status.value = '识别中...';
  } catch (err) {
    handleError(err);
  }
}
// 结束录音
async function stopRecording() {
  clearInterval(interval.value);
  recorder.value?.stop();
  isRecording.value = false;
  status.value = '点击开始说话';
}
function handleError(err) {
  console.error('录音错误:', err);
  status.value =
    err.name === 'NotAllowedError' ? '请允许麦克风权限' : '设备不支持录音';
  message.error(status.value);
  isRecording.value = false;
}
// 滚动到最底部
function scrollToBottom() {
  nextTick(() => {
    const container = messageContainer.value;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
}
function handleInputBlur(e) {
  // 判断焦点是否转移到提示词列表
  if (!e.relatedTarget || !e.relatedTarget.closest('.prompt-list')) {
    showPrompts.value = false;
  }
  showPrompts.value = false;
}
function handleInputFocus() {
  if (newMessage.value?.[0] == '/') {
    showPrompts.value = true;
    filteredPrompts.value = filterPrompts();
  }
}
function handlePromptInput(e) {
  const value = e.target.value;
  if (value.includes('/')) {
    showPrompts.value = true;
    filteredPrompts.value = filterPrompts(value.split('/')[1]);
  } else {
    showPrompts.value = false;
  }
}
function filterPrompts(keyword) {
  return keyword?.trim?.()
    ? promptList.value.filter(p =>
        p.label.toLowerCase().includes(keyword.toLowerCase()),
      )
    : promptList.value;
}
function selectPrompt(prompt) {
  selectedPrompt.value = prompt;
  newMessage.value = prompt.value;
  showPrompts.value = false;
}
/**
 * 链接解析方法
 * 正则匹配到[]()后 将其解析为a标签返回 ()里的是超链链接 []内的是链接名称 例子：[CRM-回访模板设置](https://teamwork.cnhis.cc/teamwork/share/konwledge/kw.html?id=140429-134151659142166911)
 * 如果[]内没有字符，则解析为img标签展示图片 图片链接是()里的是链接，如果链接没有http或者https开头的 则默认拼接上https://emr-tl.cnhis.com/
 * ![](/api/image/90e27150-c1a4-11ef-9a76-0242bfa90002)
 */
function formatLinks(content) {
  // const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  // return content.replace(
  //   linkRegex,
  //   '<a href="$2" target="_blank" style="color: #1890ff;">$1</a>'
  // );
  const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
  return content.replace(linkRegex, (match, text, url) => {
    // 图片处理逻辑
    if (match.startsWith('!')) {
      // 处理图片路径
      const imgUrl = url.startsWith('http')
        ? url
        : `https://emr-tl.cnhis.com${url}`;
      return `<img src="${imgUrl}" style="max-width: 100%; margin: 5px 0; border-radius: 4px;" alt="图片"/>`;
    }
    // 链接处理逻辑
    if (text) {
      return `<a href="${url}" target="_blank" style="color: #1890ff;">${text}</a>`;
    }
    // 无文本的链接情况（根据需求处理）
    return match;
  });
}
watch(
  messages,
  () => {
    scrollToBottom();
  },
  { immediate: true, deep: true },
);

watch(
  selectedBusiness,
  () => {
    chatId.value = '';
  },
  { immediate: true, deep: true },
);

onMounted(() => {
  if (isSendType.value == '1') sendMessage();
});

onUnmounted(() => {
  // 组件销毁前中止请求
  if (controller.value) {
    controller.value.abort();
  }
  socket.value?.close();
  recorder.value?.stop();
});
</script>
<style lang="less" scoped>
.ai-agent-self {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #cadbfa 0%, #e5ecfc 50%, #ebe1fe 100%);
}
.message-list {
  flex: 1; // 占据剩余空间
  overflow-y: auto;
  padding: 20px;
  .return-message {
    max-width: 85% !important;
  }
  .message-bubble {
    max-width: 70%;
    margin-bottom: 15px;
    padding: 12px 16px;
    border-radius: 12px;
    &.user-message {
      background: #f6f6f6;
      margin-left: auto;
    }
    .message-content {
      color: black;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-line; // 保留换行符
    }
    :deep(.return-content) {
      // max-width: 100%;
      max-width: 75vw;
      white-space: pre-line; // 保留换行符
      word-wrap: break-word;
      img {
        max-width: 100% !important;
      }
    }
    .message-time {
      font-size: 12px;
      color: #999;
      margin-top: 5px;
    }
    :deep(.v-note-wrapper) {
      z-index: 10;
    }
    .a4-pattern {
      :deep(.edui-editor-iframeholder) {
        width: 800px !important;
        margin: 0 auto;
        border-left: 1px solid #eee;
        border-right: 1px solid #eee;
        // box-shadow: 0px 0px 10px #eadddd;
      }
    }
    .full-screen {
      :deep(.edui-editor-iframeholder) {
        width: 100% !important;
      }
    }
  }
}
.input-area {
  min-height: 100px; // 最小高度
  max-height: 300px; // 最大高度限制
  padding: 20px;
  border-top: 1px solid #eee;
  .input-box {
    display: flex;
    position: relative;
    background-color: #ffffff;
    border: 1px solid #ddd;
    border-radius: 8px;
    &:focus {
      box-shadow: 0 0 0 2px rgba(85, 133, 245, 0.2);
    }
    &:hover {
      box-shadow: 0 0 0 2px rgba(85, 133, 245, 0.2);
    }

    // 语音按钮
    .mic-button {
      padding: 13px 0 0 21px;
      width: 41px;
      height: 41px;
      cursor: pointer;
      transition: all 0.3s;
      &.recording {
        animation: pulse 1.5s infinite;
      }
    }
    @keyframes pulse {
      0% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
      100% {
        opacity: 1;
      }
    }
    // 发送按钮
    .send-class {
      padding: 10px;
      width: 41px;
      height: 41px;
      cursor: pointer;
      &:hover {
        background-color: #f5f5f5;
      }
    }
    .disabled-send {
      cursor: not-allowed;
      &:hover {
        background-color: #ffffff;
      }
    }
    :deep(.n-input:hover) {
      border-radius: 8px;
      border: none;
    }
    :deep(.n-input:focus) {
      border-radius: 8px;
      border: none;
    }
    :deep(.n-input[disabled]) {
      background-color: #ffffff;
      cursor: not-allowed;
    }
    :deep(.n-input) {
      &::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE 10+ */
    }
    textarea {
      width: 100%;
      flex: 1;
      height: 80px;
      padding: 10px;
      border-radius: 8px;
      border: none;
      resize: none;
      box-shadow: none;
      &:focus {
        border-radius: 8px;
        border: none;
      }
    }
  }
  .business-box {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
    .business-tag {
      padding: 4px 12px;
      background: #f5f5f5;
      border-radius: 14px;
      font-size: 12px;
      color: #666;
      cursor: pointer;
      transition: all 0.2s;
      &:hover {
        background: #e1e1e1;
      }
      &.selected {
        background: #ecf5ff;
        color: #3c74f9;
        border: 1px solid #3c74f9;
      }
    }
  }
}
.prompt-tag {
  border-radius: 5px;
  padding: 10px 0 0 10px;
}
.prompt-list {
  width: 100%;
  position: absolute;
  bottom: 100%;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 11;
  max-height: 200px;
  overflow-y: auto;

  .prompt-item {
    padding: 8px 16px;
    cursor: pointer;
    &:hover {
      background: #f5f5f5;
    }
  }
}
.author-photo {
  img {
    width: 43px;
    height: 43px;
    border-radius: 50%;
  }
}
// 加载动画
.loading-dots {
  display: inline-block;
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 3px;
    background: #666;
    border-radius: 50%;
    opacity: 0;
    animation: dot-visibility 1.2s infinite linear;

    &:nth-child(1) {
      animation-delay: 0s;
    }
    &:nth-child(2) {
      animation-delay: 0.1s;
    }
    &:nth-child(3) {
      animation-delay: 0.2s;
    }
  }
}
@keyframes dot-visibility {
  0%,
  100% {
    opacity: 0;
  }
  16.6%,
  33.3% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
