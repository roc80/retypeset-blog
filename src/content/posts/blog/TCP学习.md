---
title: TCP学习
pubDate: 2025-11-25 10:18:34
description: ''
updated: ''
tags:
  - CS
draft: true
pin: 0
toc: true
lang: ''
abbrlink: learning-tcp
---
##### ACK的累计确认机制
[参考文章](https://cefboud.com/posts/tcp-deep-dive-internals/)
- A->B sent SYN[0-99]
- B->A sent ACK[100]
- A->B sent SYN[100-199] (丢包)
- B->A sent ACK[100]
- A->B sent SYN[200-299]
- B->A sent ACK[100] (检测到100-199缺失)
- A->B sent SYN[300-399]
- B->A sent ACK[100] (检测到100-199缺失)
- A->B sent SYN[100-199]
- B->A sent ACK[400]
