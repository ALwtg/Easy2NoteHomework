---
name: schedule-multi-fixes
overview: 修复课表页 8 项问题：临时存放点图标、背景图不显示、颜色预设+色环、拖出存放框卡在空中、展开态拖入存放框、系统通知设置找不到应用、权限正常按钮文案、学科拖动不跟手。
todos:
  - id: stash-icon-bg-fix
    content: 修复课表页临时存放点图标替换为package.png，并修复背景图被白色层遮挡问题
    status: completed
  - id: stash-drag-fix
    content: 修复临时存放框拖出卡在空中bug，并支持展开态拖入存放框
    status: completed
    dependencies:
      - stash-icon-bg-fix
  - id: color-picker-enhance
    content: 扩展课程颜色预设至25个并增加HSL色环调色功能
    status: completed
  - id: notification-fix
    content: 修复Android通知设置跳转找不到应用，权限正常时按钮显示"权限正常"
    status: completed
  - id: subject-drag-fix
    content: 修复学科列表拖动偏移不跟手问题，用实测坐标计算目标索引
    status: completed
---

## 用户需求

1. **临时存放点图标**：将课表页临时存放点（收起态气泡）的图标从 emoji `📥` 替换为本地图片 `/static/package.png`。

2. **课表背景图不显示**：在外观设置页设置了背景图片后，课表页背景始终为白色，背景图未生效。需修复使背景图能正确透出。

3. **课程颜色设置增强**：颜色选择器需同时支持「预选色」和「色环调色（HSL 滑块）」，以获得更广色域。预选色在当前 20 个基础上再增加 5 个，共 25 个。

4. **从临时存放框拖出卡在空中**：长按临时存放框中的课程芯片拖出时，松手前课程 ghost 卡在空中不动，需要松手后再次长按拖动才能继续。需修复拖动中途卡死的问题。

5. **展开态拖入临时存放框**：临时存放框展开状态下，应支持把课表中的课程直接拖入展开的存放框区域。目前仅收起态的左下角小区域可检测拖入。

6. **系统通知设置"找不到应用"**：点击"去设置"跳转系统通知权限页时提示"在已安装列表中找不到该应用"。需修复 Intent 跳转逻辑。

7. **权限正常按钮文案**：检测到通知权限已开启时，按钮文案改为"权限正常"并禁用点击，而非显示"去设置"。

8. **学科拖动不跟手**：在学科管理页拖动学科排序时，一动就往下偏移一大段距离，之后虽同步移动但始终保持偏移。需修复偏移计算错误。

## 技术栈

- **框架**：uni-app (Vue 2 Options API) + HBuilderX
- **样式**：rpx 响应式单位 + 条件编译 `#ifdef APP-PLUS / MP-WEIXIN`
- **存储**：uni.setStorageSync / uni.getStorageSync
- **原生调用**：Android `plus.android.importClass / invoke` 用于通知权限与系统设置跳转

## 实现方案

### 1. 临时存放点图标替换（schedule.vue）

- 模板 line 266：将 `<text class="temp-stash-icon">📥</text>` 替换为 `<image class="temp-stash-icon" src="/static/package.png" mode="aspectFit"></image>`
- 样式 `.temp-stash-icon`（line 3098）：从 `font-size: 40rpx` 改为 `width: 48rpx; height: 48rpx`

### 2. 课表背景图不显示修复（schedule.vue）

**根因**：`.page-bg`（position: fixed, z-index: 0）作为背景层在最底部，但内容层 `.swipe-viewport`（line 2872）、`.swipe-page`（line 2900）、`.header-row`（line 2906）、`.schedule-scroll`（line 2900）均设了不透明 `background: #ffffff`，按 CSS 绘制顺序（同 z-index 按 DOM 顺序），白色背景绘制在 page-bg 之上，完全遮挡背景图。

**修复**：将上述四层背景从 `#ffffff` 改为 `transparent`，使 fixed 的 page-bg 透过内容层显示。`.page` 自身保留 `background: #f4f7fb` 作为兜底色。

### 3. 课程颜色预设扩展 + 色环调色（schedule.js + appearance.vue）

- **schedule.js**：`COURSE_COLOR_PRESETS`（line 527-532）追加 5 个色值（如 `#be185d`, `#9333ea`, `#0f766e`, `#b45309`, `#475569`），共 25 个。
- **appearance.vue**：在现有预设色块 grid 下方增加 HSL 色环调色区域：
- 新增 data：`pickerHue`（0-360）、`pickerSat`（0-100）、`pickerLight`（0-100）
- `openColorPicker` 时由当前 `pickerColor`(hex) 反算 HSL 初始化三值
- 三个 slider `@change` 时由 HSL → hex 写入 `pickerColor`，预设色块选中态自动同步（已有 `pickerColor === color` 判断）
- hex → HSL 转换使用标准算法（RGB→HSL），HSL→hex 使用 HSL→RGB→hex
- 预设色块点击时也需同步更新 HSL 值

### 4. 从临时存放框拖出卡在空中修复（schedule.vue）

**根因**：`onStashItemTouchStart` 长按回调（line 1633）执行 `this.tempStashExpanded = false`，导致 `v-else` 的 scroll-view 及内部 chip 元素从 DOM 移除。触摸事件的目标元素消失后，后续 touchmove/touchend 不再派发到该元素，ghost 停在最后位置不动。

**修复**：移除长按回调中的 `this.tempStashExpanded = false`。拖动期间保持展开，chip 留在 DOM 继续接收触摸事件。拖动结束逻辑（onCourseTouchEnd 的 fromStash 分支 line 1464、dropCourseToStash line 1550）已有收起操作，无需额外处理。

### 5. 展开态拖入临时存放框（schedule.vue）

**现状**：`isTouchInTempStashZone`（line 1503-1514）仅检测左下角 180rpx×180rpx 区域。展开态下 stash 横跨 `left:24rpx;right:24rpx`（line 3119-3127），高度约 120rpx（padding 16+chip 高+padding 16）。

**修复**：在 `isTouchInTempStashZone` 中判断 `this.tempStashExpanded`：

- 收起态：保持原左下角 180rpx 区域检测
- 展开态：drop 区域改为底部全宽条带，y >= windowHeight - stashBarHeightPx（约 140rpx 转 px），x 在 24rpx 到 (windowWidth - 24rpx) 范围

### 6. 系统通知设置"找不到应用"修复（notification.js）

**根因**：`openSystemNotificationSettings`（line 266-296）中 `Settings.ACTION_APP_NOTIFICATION_SETTINGS` 通过 `importClass` 取静态字段返回的是 Java String 对象，传给 `setAction` 时可能不被正确识别，导致系统打开错误的设置页。

**修复**：

- 使用字符串字面量 `'android.settings.APP_NOTIFICATION_SETTINGS'` 直接传给 `setAction`
- extras key 使用字面量 `'app_package'` 和 `'app_uid'`
- 增加 fallback：若上述 Intent 失败，构造 `ACTION_APPLICATION_DETAILS_SETTINGS` +  `Uri.parse('package:' + packageName)` 跳转应用详情页（用户可手动进入通知设置）

### 7. 权限正常按钮文案（reminder.vue）

- line 31：`{{ noticeEnabled ? '去设置' : '去开启' }}` 改为 `{{ noticeEnabled ? '权限正常' : '去开启' }}`
- 权限正常时添加 `:disabled="noticeEnabled"` 和对应禁用样式

### 8. 学科拖动不跟手修复（subjects.vue）

**根因**：`computeTargetIndex`（line 153-168）使用 `this.__listStartY || 0`，但 `__listStartY` 从未被赋值，恒为 0。`relativeY = clientY - 0 = clientY`（绝对屏幕 Y）。列表实际起始 Y 远大于 0（导航栏 + 卡片头部 + 输入行之后），导致 `floor(clientY / itemHeight)` 算出的索引偏大，课程瞬间跳到很靠下位置并持续保持偏移。`itemHeight` 用估算 116rpx 也不精确。

**修复**：

- `onHandleTouchStart` 中用 `uni.createSelectorQuery().in(this)` 异步查询 `.subject-list` 的 `boundingClientRect.top` 和首个 `.subject-item` 的 rect（用相邻两项 top 差或单项 height 作 itemHeight），缓存到 `this.__listTop` 和 `this.__itemHeight`
- scroll-view 添加 `@scroll` 事件跟踪 `this.__scrollTop`
- `computeTargetIndex` 改为 `relativeY = clientY - this.__listTop + (this.__scrollTop || 0)`，用实测 `__itemHeight` 计算 `floor(relativeY / __itemHeight)`
- 长按 400ms 内查询必定完成，touchmove 时数据就绪

## 实现注意事项

- **性能**：学科拖动查询使用异步 SelectorQuery，仅在 touchStart 时查询一次并缓存，避免每次 touchmove 查询
- **向后兼容**：COLOR_POOL（schedule.js line 34-38）与 COURSE_COLOR_PRESETS 独立，本次仅扩展 PRESETS，不影响已有课程默认色分配
- **条件编译**：通知修复仅影响 `#ifdef APP-PLUS` 的 Android 分支，小程序端不受影响
- **DOM 稳定性**：拖动期间不得移除被触摸元素的 DOM，这是 stash 拖出卡死的根本原因