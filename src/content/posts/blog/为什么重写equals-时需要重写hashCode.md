---
title: 为什么重写equals()时需要重写hashCode()?
pubDate: 2024-04-18 23:50:18
tags: [Java]
---

equals()的API Note写道：

> 通常有必要在重写equals()时重写hashCode，以维护hashCode的Contract

### hashCode()的Contract

- 当equals用的信息没有被修改的情况下,一个进程中，多次调用hashCode返回同一个值
- 如果根据equals判定两个对象相等，那么这两个对象的hashCode返回值相等
- 当两个对象不是 equals 的，它们的hashCode**不是一定要不相等**。但是，如果对于not equals 的对象，hashCode不相等**或许**能够提升hash table 的性能。

重写equals必须重写hashCode是**为了维护hashCode的第二条Contract**：

如果根据equals判定两个对象相等，那么这两个对象的hashCode返回值相等。

*假如不重写hashCode*

*如果原本not equal 的obj 经过重写queals 变成了 queal的*

*在重写queals之前它们的hashCode不相等。*

*那么此时，equals判定这两个对象相等，但是它们的hashCode不相等*

*因此有必要重写hashCode*
