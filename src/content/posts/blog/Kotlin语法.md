---
title: Kotlin语法
pubDate: 2024-04-18 23:52:15
tags: [Kotlin]

---

# Kotlin实用扩展函数

```kotlin
val nullableValue: String? = null
nullableValue.withNotNull { value ->
    // 只有在nullableValue不为空时才会执行此处的代码
}

val flow = flowOf("Hello", "World")
val liveData = flow.toLiveData()

val list: List<Int> = emptyList()
if (list.notEmpty()) {
    // 只有在list不为空时才会执行此处的代码
}

val map = mapOf("key1" to "value1", "key2" to "value2")
val value = map.getOrThrow("key3")

//格式化数字和日期
val number = 1000000
val formattedNumber = number.toFormattedString()

val drawable = ContextCompat.getDrawable(context, R.drawable.my_drawable)
val bitmap = drawable.toBitmap()

val filePath = "/storage/emulated/0/Download/my_file.pdf"
val fileUri = filePath.toUri()

val number = 5
val formattedNumber = number.applyIf(number > 10) {
    toFormattedString()
}
```

```kotlin
fun View.onClick(debounceDuration: Long = 300L, action: (View) -> Unit) {
    setOnClickListener(DebouncedOnClickListener(debounceDuration) {
        action(it)
    })
}

private class DebouncedOnClickListener(
    private val debounceDuration: Long,
    private val clickAction: (View) -> Unit
) : View.OnClickListener {
    private var lastClickTime: Long = 0

    override fun onClick(v: View) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastClickTime >= debounceDuration) {
            lastClickTime = now
            clickAction(v)
        }
    }
}
button.onClick(debounceDuration = 500L) {
    // 只有在距离上次点击已经过去500毫秒后才会执行此处的代码
}
```

