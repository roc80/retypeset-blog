import type { CollectionEntry } from 'astro:content'
import MarkdownIt from 'markdown-it'
import { defaultLocale } from '@/config'

type ExcerptScene = 'list' | 'meta' | 'og' | 'feed'

const markdownParser = new MarkdownIt()
const excerptLengths: Record<ExcerptScene, { cjk: number, other: number }> = {
  list: {
    cjk: 120,
    other: 240,
  },
  meta: {
    cjk: 120,
    other: 240,
  },
  og: {
    cjk: 70,
    other: 140,
  },
  feed: {
    cjk: 70,
    other: 140,
  },
}
const htmlEntityMap: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': '\'',
  '&nbsp;': ' ',
}

// Creates a clean text excerpt with length limits by language and scene
function getExcerpt(text: string, lang: string, scene: ExcerptScene): string {
  const isCJK = (lang: string) => ['zh', 'zh-tw', 'ja', 'ko'].includes(lang)
  const length = isCJK(lang)
    ? excerptLengths[scene].cjk
    : excerptLengths[scene].other

  // Remove HTML tags
  let cleanText = text.replace(/<[^>]*>/g, '')

  // Decode HTML entities
  Object.entries(htmlEntityMap).forEach(([entity, char]) => {
    cleanText = cleanText.replace(new RegExp(entity, 'g'), char)
  })

  // Normalize whitespace
  cleanText = cleanText.replace(/\s+/g, ' ')

  // Normalize CJK punctuation spacing
  cleanText = cleanText.replace(/([。？！："」』])\s+/g, '$1')

  const excerpt = cleanText.slice(0, length).trim()

  // Remove trailing punctuation and add ellipsis
  if (cleanText.length > length) {
    return `${excerpt.replace(/\p{P}+$/u, '')}...`
  }

  return excerpt
}

// Generates content description from existing description or content (works with both posts and weeks)
export function getContentDescription(
  content: CollectionEntry<'posts'> | CollectionEntry<'weeks'>,
  scene: ExcerptScene,
): string {
  const lang = content.data.lang || defaultLocale

  if (content.data.description) {
    // Only truncate for og scene, return full description for other scenes
    return scene === 'og'
      ? getExcerpt(content.data.description, lang, scene)
      : content.data.description
  }

  const body = content.body || ''

  // Remove HTML comments and Markdown headings
  const cleanedContent = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#{1,6}\s+\S.*$/gm, '')
    .replace(/\n{2,}/g, '\n\n')

  const htmlContent = markdownParser.render(cleanedContent)

  return getExcerpt(htmlContent, lang, scene)
}

// Generates post description from existing description or content
export function getPostDescription(
  post: CollectionEntry<'posts'>,
  scene: ExcerptScene,
): string {
  return getContentDescription(post, scene)
}

// Generates week description from existing description or content
export function getWeekDescription(
  week: CollectionEntry<'weeks'>,
  scene: ExcerptScene,
): string {
  return getContentDescription(week, scene)
}
