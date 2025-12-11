---
title: Required request part ‘file‘ is not present
pubDate: 2025-09-07 16:36:42
tags:
  - Debug
---

### 问题

SpringBoot Controller (@RequestParam("file") MultipartFile file)，报错：Required request part ‘file‘ is not present

### 定位

1. 前端使用了Swagger接口文档和curl分别尝试，同样的报错，那么就是后端问题了。
2. F12再次检查 Request的 Content-Type 是否为multipart/form-data 类型，请求类型确实没错。
3. 在Controller参数中加上HttpServletRequest requet，通过request.getInputStream()能拿到数据。
4. 开始Google，看了众多文章，最有用的一篇是这个：https://segmentfault.com/a/1190000022635405 。通过它说的解决办法，确实可以解决我当下的问题。
5. spring.mvc.hiddenmethod.filter.enabled=true配置后，问题解决。

### 在此基础上 AI Check

ChatGPT告诉我，很可能是因为安全Filter或缓存Wrapper提前读了一次Stream，后续MultipartResolver解析数据时，就读不到了。

确实，我的项目中自定义了

```java
public class RepeatableRequestWrapper extends HttpServletRequestWrapper {

    private final byte[] body;

    public RepeatableRequestWrapper(HttpServletRequest request) throws IOException {
        super(request);
        this.body = getRequestBodyBytes(request);
    }

    private byte[] getRequestBodyBytes(HttpServletRequest request) throws IOException {
        try (InputStream inputStream = request.getInputStream();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[1024];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
            }
            return outputStream.toByteArray();
        }
    }
}
```


> spring.mvc.hiddenmethod.filter.enabled=true
> 启用该配置会注册 OrderedHiddenHttpMethodFilter，它的默认顺序很靠前（在 Spring Security 之前）。这会改变过滤器链的时序；某些组合下，它会间接改变谁先触碰请求体（例如先尝试参数解析/方法覆盖判断，或让你的分支逻辑提前短路），从而 **恰好避开了你在自定义过滤器里读取body的路径**，造成“看起来修好了”的错觉。官方文档也特别提醒该过滤器与 multipart 的顺序关系（应当在 multipart 处理之后），如果顺序不当，反而会带来更多意外。因此，依赖它来规避问题并不可靠。

> 小结：真正的根因仍是你在自定义过滤器中读取了请求体而未做缓存/复用处理；HiddenMethod 的开启只是“时序变化”带来的旁路效应。

关于这个配置，我还是一知半解。

---

**修改后的RepeatableRequestWrapper**
```java
public class RepeatableRequestWrapper extends HttpServletRequestWrapper {

    private final byte[] body;
    private final boolean isMultipart;

    public RepeatableRequestWrapper(HttpServletRequest request) throws IOException {
        super(request);
        String contentType = request.getContentType();
        this.isMultipart = contentType != null && contentType.toLowerCase().startsWith("multipart/");
        if (isMultipart) {
            // multipart请求不缓存 body，防止StandardMultipartHttpServletRequest request.getParts时，拿不到请求体
            this.body = null;
        } else {
            this.body = getRequestBodyBytes(request);
        }
    }

    ...
}
```

这样改了之后，MultipartFile就能正常接收到了。

**但是**

为什么只有multipart请求，按照老的RequestWrapper不能拿到请求体，其他请求都可以拿到呢？

---


### 打断点看源码
1. 根据 [refer1] 中提到的 `StandardMultipartHttpServletRequest#parseRequest()方法中的request.getParts()`为空

2. FilterChain在doDispatch之前

3. 我在filter中，读了request的InputStream，存到了body中。我自定义的Wrapper没有实现getParts()

4. ![alt text](https://raw.githubusercontent.com/roc80/DrawingBoard/main/image/image.png)

5. ![alt text](https://raw.githubusercontent.com/roc80/DrawingBoard/main/image/image-1.png) 到这里的时候，parts里面已经有数据了。parts中的数据什么时候set进来的？

6. `getParameter()`解析Request参数的时候，就解析了parts
![alt text](https://raw.githubusercontent.com/roc80/DrawingBoard/main/image/image-2.png)

7. 到这里先偷懒，放弃继续挖下去。

### 总结
我自定义的RepeatableRequestWrapper没有实现getParts()方法。

![alt text](https://raw.githubusercontent.com/roc80/DrawingBoard/main/image/image-3.png) 这里getMatchingRequest() 从自定义的RepeatableRequestWrapper 一直找到了Request才找到match的。

于是，getParameter()就到了Request，Request就解析了parts并存储。

后面到了DispatcherServlet的逻辑，解析Multipart，回到了一开始的`StandardMultipartHttpServletRequest#parseRequest()方法中的request.getParts()` 

![alt text](https://raw.githubusercontent.com/roc80/DrawingBoard/main/image/image-4.png) 这里先调用RepeatableRequestWrapper的 getParts,由于没有实现，层层向上，最终到了Request的getParts()

**最终的解决方案：
RepeatableRequestWrapper内，对于mutipart类型的请求，不要去读Stream，不做缓存。**


--- 完 ---

### 参考文章
[refer1] https://segmentfault.com/a/1190000022635405
