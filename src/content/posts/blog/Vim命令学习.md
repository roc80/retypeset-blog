---
title: 终端操作快捷键
pubDate: 2025-12-25 16:35:41
description: ''
updated: ''
tags:
  - Vim
  - CLI
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

### CLI快捷键

```text
Ctrl h 删除光标左侧一个字符
Ctrl d 删除光标右侧一个字符

Ctrl u 或者 Ctrl w 剪切或删除 光标左侧所有字符
Ctrl k 剪切或删除 光标右侧所有字符
Ctrl y 粘贴剪切板字符

Ctrl m 从光标处换行

Ctrl n 光标下移一行 next line
Ctrl p 光标上移一行 previous line
Ctrl a 光标移动到行首 ahead of line
ctrl e 光标移动到行尾 end of line

Ctrl c 删除全部内容，不存入剪切板 clear

```
