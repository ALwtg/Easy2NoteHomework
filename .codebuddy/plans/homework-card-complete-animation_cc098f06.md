---
name: homework-card-complete-animation
overview: 为作业卡片右滑标记完成增加小动画反馈，让完成动作更直观，并保持现有右滑逻辑与数据保存流程。
todos:
  - id: add-completing-state
    content: 在 index.vue 新增 completingId 完成中状态
    status: completed
  - id: update-card-template
    content: 为作业卡片绑定完成动画 class 和提示层
    status: completed
    dependencies:
      - add-completing-state
  - id: adjust-swipe-flow
    content: 调整右滑逻辑为先播放动画再标记完成
    status: completed
    dependencies:
      - add-completing-state
  - id: add-animation-styles
    content: 新增卡片右滑完成动画和绿色提示样式
    status: completed
    dependencies:
      - update-card-template
  - id: verify-index-vue
    content: 检查 index.vue 语法和交互回归
    status: completed
    dependencies:
      - adjust-swipe-flow
      - add-animation-styles
---

## 用户需求

在现有“作业看板”中，用户右滑作业卡片并触发“标记完成”时，需要增加一个小动画反馈，让完成操作更直观、更有仪式感。

## 产品概览

当前首页已有作业卡片列表和右滑标记完成能力。本次只增强右滑完成时的视觉反馈，不改变原有作业排序、保存、完成状态逻辑。

## 核心功能

- 右滑达到完成阈值后，卡片先播放完成动画，再更新为已完成状态。
- 动画效果包含卡片轻微右滑、缩放、绿色完成提示或勾选标识。
- 防止动画播放期间重复触发同一张卡片的完成操作。
- 动画结束后保持原有“已完成”弱化样式，并继续保存到本地存储。

## Tech Stack Selection

- 项目类型：uni-app 移动端应用
- 前端框架：Vue 3 单文件组件
- 样式：当前页面内 scoped-like 普通 CSS 写法，使用 rpx 单位
- 数据持久化：继续复用 `uni.setStorageSync` 和 `uni.getStorageSync`
- 目标文件：`d:/program/Documents/HBuilderProjects/作业助手/pages/index/index.vue`

## Implementation Approach

本次在现有右滑完成链路上增加“完成中”临时状态，例如 `completingId`，当右滑距离超过阈值时先给当前卡片添加动画 class，动画播放结束后再调用现有 `markCompleted` 更新数据。这样可以最大限度复用当前 `onTouchStart`、`onTouchEnd`、`markCompleted` 逻辑，避免重写列表排序和存储流程。

关键技术决策：

- 使用 CSS transition/keyframes 实现动画，避免引入额外依赖。
- 使用临时状态控制单张卡片动画，避免全列表重渲染和误触发。
- 动画结束后再写入完成状态，确保用户能看到动画后卡片再进入已完成弱化样式。
- 保持原有本地存储结构不变，避免影响已有作业数据。

## Implementation Notes

- 在 `data()` 中新增 `completingId`，必要时新增 `completeTimer` 用于清理延迟任务。
- 修改卡片 class 绑定，增加 `item.id === completingId ? 'is-completing' : ''`。
- 在卡片内部增加一个完成提示层，仅当前完成中的卡片显示，例如“已完成”或对勾标识。
- 在 `onTouchEnd` 中判断如果已有 `completingId`，则忽略重复触发。
- 右滑达标后先设置 `completingId`，延迟约 300-450ms 后调用 `markCompleted`，再清空 `completingId`。
- 样式只作用于作业卡片区域，避免影响拍照、手动录入、分享码等已有功能。
- 修改后对 `pages/index/index.vue` 执行 lint 检查，确认没有新增语法错误。

## Architecture Design

当前页面为单文件组件结构，作业列表、交互逻辑和样式都集中在 `pages/index/index.vue`。本次保持该架构不变，只在已有作业卡片交互链路中插入动画状态层。

数据流：

右滑卡片 → 计算滑动距离 → 设置完成中状态 → 播放 CSS 动画 → 调用现有完成逻辑 → 保存本地数据 → 列表刷新并显示已完成样式

## Directory Structure

```text
d:/program/Documents/HBuilderProjects/作业助手/
└── pages/
    └── index/
        └── index.vue  # [MODIFY] 增强作业卡片右滑完成交互。新增完成中状态、动画提示层、卡片完成动画样式，并调整 onTouchEnd 触发顺序，确保动画播放后再标记完成。
```