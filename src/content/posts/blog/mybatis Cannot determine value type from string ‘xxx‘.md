---
title: mybatis Cannot determine value type from string ‘xxx‘
pubDate: 2025-07-02 18:17:02
tags:
  - Debug
abbrlink: mybatis-cannot-determine-value-type-from-string-xxx
---

#### 问题

mybatis Cannot determine value type from string ‘xxx‘



#### 参考

https://blog.csdn.net/kingwinstar/article/details/107106239



#### 收获

1. 不要养成万事靠AI，AI是思路对，但是细节不熟的时候提高效率用的。有时候思路错了不妨静下心来，去搜索前人踩坑精力或者自己动脑thinking。而不是AI一解决不了就破防。
2. 就像参考文章说的，搜前人踩坑贴发现解决不了，不妨试试静下心看日志堆栈，从里面按图索骥，debug源码。从源码找问题一定是最可靠的。

#### 解决

Team 类中的joinType字段的位置和数据库查询 result_set 中的字段 位置对不上，原因是：该字段是后来手动加的，加的时候两边的位置没对应好。
