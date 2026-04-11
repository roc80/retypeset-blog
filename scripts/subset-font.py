#!/usr/bin/env python3
"""
字体子集化脚本 - Font Subset Generator

用途:
  将完整的 TTF 字体文件转换为精简的 WOFF2 格式，只保留常用字符，
  大幅减小文件体积，提升网页加载速度。

字符集来源:
  public/fonts/Font Subset List/
    - CJK Common Characters.txt (简体/繁体/日文/韩文常用字)
    - Latin + Cyrillic + Greek + Arabic Glyphs.txt (拉丁/西里尔/希腊/阿拉伯字母)

使用方法:
  1. 安装依赖: pip install fonttools brotli
  2. 将源字体放到 public/fonts/LXGWWenKai-Regular.ttf
  3. 运行: python scripts/subset-font.py
  4. 生成: public/fonts/LXGWWenKai-Regular.woff2

效果:
  LXGWWenKai-Regular.ttf  (23.6 MB) → LXGWWenKai-Regular.woff2 (1.1 MB)
  压缩率约 95%，保留 5237 个常用字符
"""

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
FONTS_DIR = PROJECT_ROOT / "public" / "fonts"

SOURCE_FONT = FONTS_DIR / "LXGWWenKai-Regular.ttf"
OUTPUT_FILE = FONTS_DIR / "LXGWWenKai-Regular.woff2"

def read_all_cjk_chars():
    """读取所有CJK字符（简体常用+次常用+繁体）"""
    charset_dir = FONTS_DIR / "Font Subset List"
    cjk_file = charset_dir / "CJK Common Characters.txt"
    all_chars = []

    with open(cjk_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 按部分分割
    sections = content.split('###')

    for section in sections:
        lines = section.split('\n')
        for line in lines:
            char = line.strip()
            # 单个汉字
            if char and len(char) == 1 and '\u4e00' <= char <= '\u9fff':
                all_chars.append(char)

    # 去重
    return ''.join(sorted(set(all_chars), key=all_chars.index))

def read_latin_chars():
    """读取 Latin + 其他字母字符集"""
    charset_dir = FONTS_DIR / "Font Subset List"
    latin_file = charset_dir / "Latin + Cyrillic + Greek + Arabic Glyphs.txt"

    chars = []
    with open(latin_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 提取所有非空字符
    for line in content.split('\n'):
        line = line.strip()
        if line and not line.startswith('<!--') and not line.startswith('###'):
            # 移除标记
            line = line.replace('-->', '').replace('`', '')
            chars.extend(list(line))

    # 去重
    return ''.join(sorted(set(chars), key=chars.index))

def subset_font(source_path, chars, output_path):
    """使用 fontTools 进行子集化"""
    from fontTools.ttLib import TTFont
    from fontTools.subset import Subsetter

    print(f"  加载字体...")
    font = TTFont(str(source_path))

    print(f"  创建子集 (共 {len(chars)} 个字符)...")
    subsetter = Subsetter()
    subsetter.populate(text=chars)

    print(f"  执行子集化...")
    subsetter.subset(font)

    print(f"  保存为 WOFF2...")
    font.flavor = "woff2"
    font.save(str(output_path))

    return output_path.stat().st_size

def format_size(size_bytes):
    for unit in ['B', 'KB', 'MB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} GB"

def main():
    print("=" * 50)
    print("字体子集化脚本 - 完整版")
    print("=" * 50)
    print()

    if not SOURCE_FONT.exists():
        print(f"错误: 找不到源字体 {SOURCE_FONT}")
        return 1

    print(f"源字体: {SOURCE_FONT.name}")
    print(f"原始大小: {format_size(SOURCE_FONT.stat().st_size)}")
    print()

    # 读取字符集
    print("读取字符集...")
    latin_chars = read_latin_chars()
    print(f"  Latin等: {len(latin_chars)} 字符")

    cjk_chars = read_all_cjk_chars()
    print(f"  CJK全部: {len(cjk_chars)} 字符")

    # 合并
    all_chars = latin_chars + cjk_chars
    print(f"  合并总计: {len(all_chars)} 字符")
    print()

    # 执行子集化
    print("生成子集字体...")
    print("(这可能需要几分钟，请耐心等待...)")
    print()

    size = subset_font(SOURCE_FONT, all_chars, OUTPUT_FILE)

    print()
    print("=" * 50)
    print("完成!")
    print("=" * 50)
    print()
    print("文件大小对比:")
    print(f"  原始 TTF: {format_size(SOURCE_FONT.stat().st_size):>12}")
    print(f"  子集 WOFF2: {format_size(size):>12}")
    print(f"  压缩率: {(1-size/SOURCE_FONT.stat().st_size)*100:.1f}%")
    print()

    # 验证几个关键字符
    print("验证关键字符:")
    from fontTools.ttLib import TTFont
    font = TTFont(str(OUTPUT_FILE))
    cmap = font.getBestCmap()

    test_chars = ['象', '记', '最', '后', '杭', '州', '周', '记']
    for char in test_chars:
        code = ord(char)
        status = "[OK]" if code in cmap else "[X]"
        print(f"  {status} {char}")

    return 0

if __name__ == "__main__":
    sys.exit(main())
