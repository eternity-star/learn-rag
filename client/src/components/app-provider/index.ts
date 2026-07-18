import {
  useDialog,
  useLoadingBar,
  useMessage,
  useNotification,
} from 'naive-ui';

export const AppProvider = defineComponent({
  name: 'AppProvider',
  setup() {
    window['$message'] = useMessage();
    window['$dialog'] = useDialog();
    window['$loadingBar'] = useLoadingBar();
    window['$notification'] = useNotification();
  },
  render() {
    return null;
  },
});
