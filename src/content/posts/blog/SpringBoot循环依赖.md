---
title: SpringBoot循环依赖
pubDate: 2025-11-10 15:15:54
description: ''
updated: ''
tags:
  - Debug
draft: true
pin: 0
toc: true
lang: ''
abbrlink: spring-boot-circle-dependency
---

现有的项目，使用@Autowired注入依赖，可以避免循环依赖问题。
- Spring不推荐使用@Autowired，为什么？
- 我使用构造方法注入，将要注入的bean设置为final类型，就会暴露出已有的循环依赖问题。即使使用了@Lazy也没用。
- 
