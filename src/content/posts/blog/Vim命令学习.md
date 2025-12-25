---
title: Vim命令学习
pubDate: 2025-12-25 16:35:41
description: ''
updated: ''
tags:
  - Vim
  - Linux
draft: true
pin: 0
toc: true
lang: ''
abbrlink: 'learning-vim'
---
### Vim命令

#### 批量操作

```text
v 进入visual模式
v0 选中当前字符到行首字符
v$ 选中当前字符到行尾字符
V 选中该当前行所有字符
选中后可执行d 进行删除
dd 删除当前行

c change命令
c0 清空行首字符到当前字符 [,) 后进入插入模式
c$ 清空当前字符到行尾字符 [,) 后进入插入模式
cc删除当前行后进入插入模式

y 复制命令 yank(拔出)
yy 复制当前行
y0
y$
yw

p 粘贴命令 put
p 粘贴于光标之后
P 张贴于光标之前

d 剪切命令 delete
dd 剪切当前行
d0
d$
dw

u undo操作
Ctrl r redo操作

```

