---
name: fix-drag-week-switch-stuck
overview: 修复课程拖拽跨周后"不跟手"和反复触发翻页的 bug，核心问题是 ghost 的 pointer-events:none 导致触摸事件丢失，以及跨周逻辑缺乏防重复触发保护。
todos:
  - id: add-capture-overlay
    content: 在模板中新增全屏透明触摸捕获遮罩 course-drag-capture，并移除 ghost 上无效的事件监听
    status: completed
  - id: add-capture-css
    content: 新增 .course-drag-capture 样式（fixed 全屏、透明背景、z-index 999）
    status: completed
    dependencies:
      - add-capture-overlay
  - id: add-justswitched-flag
    content: 在 data 注释、drag 初始对象中补充 edgeJustSwitched 字段
    status: completed
  - id: fix-repeat-switch
    content: 修改 maybeSwitchWeekDuringCourseDrag：翻页后标记 edgeJustSwitched=true，同方向在边缘时阻止再次翻页，离开边缘时重置标记
    status: completed
    dependencies:
      - add-justswitched-flag
  - id: verify-no-lint
    content: 检查 schedule.vue 无新增 lint 诊断问题
    status: completed
    dependencies:
      - add-capture-overlay
      - add-capture-css
      - fix-repeat-switch
---

## 问题描述

课表课程长按拖拽跨周时存在两个严重 bug：

1. **跨周后不跟手**：把课拖到右边缘翻到下一周后，课程被固定在屏幕最右边，完全无法继续拖动
2. **反复触发翻页**：手指停在边缘，每 2 秒自动翻一页，直到翻到最后一周期

## 根因分析

1. **触摸事件丢失**：`.course-drag-ghost` 有 `pointer-events: none`（第 2792 行），之前添加的 `@touchmove/@touchend` 完全无效。跨周后原课程块 DOM 被 Vue 重渲染销毁，唯一的事件来源断开。
2. **无限翻页循环**：`maybeSwitchWeekDuringCourseDrag`（第 977-1014 行）翻页后将 `edgeSwitchingAt` 重置为 `now`，若手指一直停在边缘，每 2 秒再次触发翻页。
3. **缺少退出边缘保护**：翻页后没有要求手指必须先离开边缘区域才能再次翻页。

## 修复目标

- 保证拖拽过程中触摸事件始终可靠触达，不因 DOM 变化而丢失
- 翻页后阻止同一方向重复触发，必须手指离开边缘区域才能再次翻页
- 保持 ghost 视觉效果不变（`pointer-events: none` 继续有效）

## 技术方案

### 核心策略

在拖拽激活时，ghost 上方插入一个**全屏透明视图**来接管 `touchmove/touchend/touchcancel` 事件。这个视图不会受底层 DOM 重渲染影响，始终能接收到触摸事件，从而保证跟手性。ghost 保持纯视觉展示（`pointer-events: none`）。

### 修改详情

#### 1. 模板层：新增全屏触摸捕获遮罩（替代无效的 ghost 事件监听）

在 `course-drag-ghost` 之后、`course-mask` 之前，插入一个条件渲染的全屏透明 `view`：

```html
<view
    v-if="courseDrag && courseDrag.active"
    class="course-drag-capture"
    @touchmove="onCourseTouchMove"
    @touchend="onCourseTouchEnd"
    @touchcancel="onCourseTouchEnd"
></view>
```

同时**移除 ghost 上已有的三个事件监听**（`@touchmove/@touchend/@touchcancel`），因为它们因 `pointer-events: none` 从不生效，保留只会造成代码误解。

#### 2. CSS：新增遮罩样式

```css
.course-drag-capture {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999;
    background: transparent;
}
```

要点：

- `z-index: 999` 在 ghost（1000）下方，确保视觉上 ghost 在上层
- 全透明，用户不可见
- 不阻止触摸事件穿透到下方 UI 是安全的，因为拖拽期间其它交互本不应触发

#### 3. 数据层：drag 初始状态增加 `edgeJustSwitched` 标记

- 在 `courseDrag` 注释（第 519 行）中补充字段：`edgeJustSwitched`
- 在 `onCourseTouchStart` 构建 drag 对象时（第 1219-1238 行），添加 `edgeJustSwitched: false`
- 这个标记用于翻页后阻止同方向再次翻页，直到手指离开边缘区域

#### 4. 逻辑层：`maybeSwitchWeekDuringCourseDrag` 增加防重复切换保护

当前逻辑问题：翻页后设 `edgeSwitchingAt = now`，手指未动的情况下 2 秒后又翻页。

修复方案：在翻页动作执行后（第 1007-1012 行），将 `edgeJustSwitched` 设为 `true`。同时在 `edgeJustSwitched === true` 且方向未变、手指仍在边缘时，直接 return 跳过翻页逻辑。当后续 `touchmove` 检测到手指离开边缘区域（`!direction`），立即将 `edgeJustSwitched` 重置为 `false`，允许下次进入边缘时重新开始计时。

修改 `maybeSwitchWeekDuringCourseDrag` 的关键逻辑：

- 翻页后设置 `edgeJustSwitched: true`
- 函数开头增加判断：若 `drag.edgeJustSwitched && direction === drag.edgeSwitchDirection`，直接 return
- 在 `!direction` 分支中重置 `edgeJustSwitched: false`