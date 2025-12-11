---
title: 你需要读VibeCoding的代码
pubDate: 2025-10-05 15:30:37
description: ''
updated: ''
tags:
  - Transfer
draft: false
pin: 0
toc: true
lang: ''
abbrlink: transfer-rtfc
---

> 原文链接：[Read That F*cking Code! ](https://etsd.tech/posts/rtfc)

#### VideCoding会带来三个问题
1. **架构层面**，VibeCoding给出的实现并不一定符合现有架构的模式，这可能会导致代码风格、架构设计不一致，为后续维护埋下隐患。
2. **领域知识层面**，如果一直VibeCoding，而不思考业务逻辑的合理性、数据上下游关系、项目的抽象概念以及这些抽象之间的关系，那就无法指挥AI来提高生产力，只能看AI够不够聪明，在你不明确说明的情况下，猜出你想要的实现。
3. **安全层面**，生产级项目，需要严肃对待可能的安全漏洞，VibeCoding可能会引入安全漏洞造成巨大损失，因此人工审查VibeCoding的代码是必要的。

#### 正确的VibeCoding方式
1. 对于快速原型设计、探索新框架或者库、修改边缘工具或功能，可以自动接受AI给出的实现。
2. 对于核心业务逻辑，关键的新功能，每一次VibeCoding都需要人工审查。

#### VibeCoding清单

- [ ] 架构检查
- [ ] 安全检查
- [ ] 测试
- [ ] 文档
- [ ] 边缘情况的错误处理
- [ ] 性能优化
- [ ] **最重要的一点，了解最新代码**
