<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-modal-provider>
          <n-notification-provider>
            <router-view />
          </n-notification-provider>
        </n-modal-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NNotificationProvider,
} from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';
import type { HeightStyle } from '@/types/system';
import { createHoverColor, createPressedColor } from '@/utils/color';
import { changeColor } from 'seemly';

const primaryColor = ref('#2563F4');
const heightStyle = ref<HeightStyle>('table-simple');
const isCompact = computed(() => heightStyle.value === 'table-classics');
const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: primaryColor.value,
    primaryColorHover: createHoverColor(primaryColor.value),
    primaryColorPressed: createPressedColor(primaryColor.value),
    primaryColorActive: changeColor(primaryColor.value, { alpha: 0.2 }),
    successColor: '#5dc055',
    errorColor: '#FF1818',
    heightMedium: '32px',
  },
  Flex: { gapMedium: '8px' },
  Message: {
    fontSize: '16px',
    iconSize: '30px',
  },
  Button: {
    paddingMedium: '0 8px',
  },
  Card: {
    paddingSmall: '8px 12px',
  },
  Drawer: {
    headerPadding: '16px',
    bodyPadding: '8px 16px',
    footerPadding: '9.5px 16px',
  },
  LoadingBar: {
    colorLoading: primaryColor.value,
  },
  Dialog: {
    peers: {
      Button: {
        heightSmall: '32px',
      },
    },
  },
  Tree: {
    nodeHeight: isCompact.value ? '30px' : '36px',
    nodeWrapperPadding: '2px 0',
  },
  Tabs: {
    // tabFontWeightActive: '700',
    // tabFontWeight: '700',
    tabGapLargeCard: '8px 40px',
    tabPaddingMediumCard: '8px 40px',
    panePaddingMedium: '8px 0',
    colorSegment: '#f2f2f2',
    tabColorSegment: primaryColor.value,
    tabTextColorHoverSegment: primaryColor.value,
    tabTextColorActiveSegment: '#fff',
  },
  Radio: {
    buttonBorderColor: '#f2f2f2',
    buttonColorActive: primaryColor.value,
    buttonTextColorActive: '#fff',
  },
  Select: {
    peers: {
      InternalSelection: {
        paddingSingle: '0 30px 0 8px',
        paddingMultiple: '2px 24px 0 8px',
      },
    },
  },
  Space: {
    gapMedium: '8px',
  },
  Scrollbar: {
    railInsetVertical: '2px 0 2px auto',
  },
  Dropdown: {
    prefixColor: primaryColor.value,
    optionTextColorHover: primaryColor.value,
    prefixColorInverted: primaryColor.value,
  },
}));
</script>
<style scoped></style>
