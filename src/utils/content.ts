import type { CollectionEntry } from 'astro:content'
import { getCollection, render } from 'astro:content'
import { defaultLocale } from '@/config'
import { memoize } from '@/utils/cache'

export type Post = CollectionEntry<'posts'> & {
  remarkPluginFrontmatter: {
    minutes: number
  }
}

export type Week = CollectionEntry<'weeks'> & {
  remarkPluginFrontmatter: {
    minutes: number
  }
}

const metaCache = new Map<string, { minutes: number }>()

/**
 * Add metadata including reading time to a post
 *
 * @param post The post to enhance with metadata
 * @returns Enhanced post with reading time information
 */
async function addMetaToPost(post: CollectionEntry<'posts'>): Promise<Post> {
  const cacheKey = `${post.id}-${post.data.lang || 'universal'}`

  if (metaCache.has(cacheKey)) {
    return {
      ...post,
      remarkPluginFrontmatter: metaCache.get(cacheKey)!,
    }
  }

  const { remarkPluginFrontmatter } = await render(post)
  metaCache.set(cacheKey, remarkPluginFrontmatter as { minutes: number })

  return {
    ...post,
    remarkPluginFrontmatter: metaCache.get(cacheKey)!,
  }
}

/**
 * Find duplicate post slugs within the same language
 *
 * @param posts Array of blog posts to check
 * @returns Array of descriptive error messages for duplicate slugs
 */
async function _checkPostSlugDuplication(posts: CollectionEntry<'posts'>[]): Promise<string[]> {
  const slugMap = new Map<string, Set<string>>()
  const duplicates: string[] = []

  posts.forEach((post) => {
    const lang = post.data.lang
    const slug = post.data.abbrlink || post.id

    if (!slugMap.has(lang)) {
      slugMap.set(lang, new Set())
    }

    const slugSet = slugMap.get(lang)!
    if (!slugSet.has(slug)) {
      slugSet.add(slug)
      return
    }

    if (!lang) {
      duplicates.push(`Duplicate slug "${slug}" found in universal post (applies to all languages)`)
    }
    else {
      duplicates.push(`Duplicate slug "${slug}" found in "${lang}" language post`)
    }
  })

  return duplicates
}

export const checkPostSlugDuplication = memoize(_checkPostSlugDuplication)

/**
 * Get all posts (including pinned ones, excluding drafts in production)
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Posts filtered by language, enhanced with metadata, sorted by date
 */
async function _getPosts(lang?: string) {
  const currentLang = lang || defaultLocale

  const filteredPosts = await getCollection(
    'posts',
    ({ data }: CollectionEntry<'posts'>) => {
      // Show drafts in dev mode only
      const shouldInclude = import.meta.env.DEV || !data.draft
      return shouldInclude && (data.lang === currentLang || data.lang === '')
    },
  )

  const enhancedPosts = await Promise.all(filteredPosts.map(addMetaToPost))

  return enhancedPosts.sort((a: Post, b: Post) =>
    b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  )
}

export const getPosts = memoize(_getPosts)

/**
 * Get all non-pinned posts
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Regular posts (non-pinned), filtered by language
 */
async function _getRegularPosts(lang?: string) {
  const posts = await getPosts(lang)
  return posts.filter(post => !post.data.pin)
}

export const getRegularPosts = memoize(_getRegularPosts)

/**
 * Get pinned posts sorted by pin priority
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Pinned posts sorted by pin value in descending order
 */
async function _getPinnedPosts(lang?: string) {
  const posts = await getPosts(lang)
  return posts
    .filter(post => post.data.pin && post.data.pin > 0)
    .sort((a, b) => (b.data.pin ?? 0) - (a.data.pin ?? 0))
}

export const getPinnedPosts = memoize(_getPinnedPosts)

/**
 * Group posts by year and sort within each year
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Map of posts grouped by year (descending), sorted by date within each year
 */
async function _getPostsByYear(lang?: string): Promise<Map<number, Post[]>> {
  const posts = await getRegularPosts(lang)
  const yearMap = new Map<number, Post[]>()

  posts.forEach((post: Post) => {
    const year = post.data.pubDate.getFullYear()
    if (!yearMap.has(year)) {
      yearMap.set(year, [])
    }
    yearMap.get(year)!.push(post)
  })

  // Sort posts within each year by date
  yearMap.forEach((yearPosts) => {
    yearPosts.sort((a, b) => {
      const aDate = a.data.pubDate
      const bDate = b.data.pubDate
      return bDate.getMonth() - aDate.getMonth() || bDate.getDate() - aDate.getDate()
    })
  })

  return new Map([...yearMap.entries()].sort((a, b) => b[0] - a[0]))
}

export const getPostsByYear = memoize(_getPostsByYear)

/**
 * Group posts and weeks by their tags
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Map where keys are tag names and values are arrays of content items with that tag
 */
async function _getPostsGroupByTags(lang?: string) {
  const posts = await getPosts(lang)
  const weeks = await getWeeks(lang)
  const tagMap = new Map<string, (Post | Week)[]>()

  // Add blog posts to tag map
  posts.forEach((post: Post) => {
    post.data.tags?.forEach((tag: string) => {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, [])
      }
      tagMap.get(tag)!.push(post)
    })
  })

  // Add weeks to tag map
  weeks.forEach((week: Week) => {
    week.data.tags?.forEach((tag: string) => {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, [])
      }
      tagMap.get(tag)!.push(week)
    })
  })

  return tagMap
}

export const getPostsGroupByTags = memoize(_getPostsGroupByTags)

/**
 * Get all tags sorted by post count
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Array of tags sorted by popularity (most posts first)
 */
async function _getAllTags(lang?: string) {
  const tagMap = await getPostsGroupByTags(lang)
  const tagsWithCount = Array.from(tagMap.entries())

  tagsWithCount.sort((a, b) => b[1].length - a[1].length)
  return tagsWithCount.map(([tag]) => tag)
}

export const getAllTags = memoize(_getAllTags)

/**
 * Get all posts and weeks that contain a specific tag
 *
 * @param tag The tag name to filter content by
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Array of content items (posts and weeks) that contain the specified tag
 */
async function _getPostsByTag(tag: string, lang?: string) {
  const tagMap = await getPostsGroupByTags(lang)
  return tagMap.get(tag) ?? []
}

export const getPostsByTag = memoize(_getPostsByTag)

/**
 * Check which languages support a specific tag (for both posts and weeks)
 *
 * @param tag The tag name to check language support for
 * @returns Array of language codes that support the specified tag
 */
async function _getTagSupportedLangs(tag: string) {
  const posts = await getCollection('posts', ({ data }) => !data.draft)
  const weeks = await getCollection('weeks', ({ data }) => !data.draft)
  const { allLocales } = await import('@/config')

  return allLocales.filter(locale =>
    posts.some(post =>
      post.data.tags?.includes(tag)
      && (post.data.lang === locale || post.data.lang === ''),
    ) || weeks.some(week =>
      week.data.tags?.includes(tag)
      && (week.data.lang === locale || week.data.lang === ''),
    )
  )
}

export const getTagSupportedLangs = memoize(_getTagSupportedLangs)

// Weeks collection helper functions

/**
 * Add metadata including reading time to a week post
 *
 * @param week The week post to enhance with metadata
 * @returns Enhanced week post with reading time information
 */
async function addMetaToWeek(week: CollectionEntry<'weeks'>): Promise<Week> {
  const cacheKey = `week-${week.id}-${week.data.lang || 'universal'}`

  if (metaCache.has(cacheKey)) {
    return {
      ...week,
      remarkPluginFrontmatter: metaCache.get(cacheKey)!,
    }
  }

  const { remarkPluginFrontmatter } = await render(week)
  metaCache.set(cacheKey, remarkPluginFrontmatter as { minutes: number })

  return {
    ...week,
    remarkPluginFrontmatter: metaCache.get(cacheKey)!,
  }
}

/**
 * Get all week posts (including pinned ones, excluding drafts in production)
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Week posts filtered by language, enhanced with metadata, sorted by date
 */
async function _getWeeks(lang?: string) {
  const currentLang = lang || defaultLocale

  const filteredWeeks = await getCollection(
    'weeks',
    ({ data }: CollectionEntry<'weeks'>) => {
      // Show drafts in dev mode only
      const shouldInclude = import.meta.env.DEV || !data.draft
      return shouldInclude && (data.lang === currentLang || data.lang === '')
    },
  )

  const enhancedWeeks = await Promise.all(filteredWeeks.map(addMetaToWeek))

  return enhancedWeeks.sort((a: Week, b: Week) =>
    b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  )
}

export const getWeeks = memoize(_getWeeks)

/**
 * Get all non-pinned week posts
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Regular week posts (non-pinned), filtered by language
 */
async function _getRegularWeeks(lang?: string) {
  const weeks = await getWeeks(lang)
  return weeks.filter(week => !week.data.pin)
}

export const getRegularWeeks = memoize(_getRegularWeeks)

/**
 * Get pinned week posts sorted by pin priority
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Pinned week posts sorted by pin value in descending order
 */
async function _getPinnedWeeks(lang?: string) {
  const weeks = await getWeeks(lang)
  return weeks
    .filter(week => week.data.pin && week.data.pin > 0)
    .sort((a, b) => (b.data.pin ?? 0) - (a.data.pin ?? 0))
}

export const getPinnedWeeks = memoize(_getPinnedWeeks)

/**
 * Group week posts by year and sort within each year
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Map of week posts grouped by year (descending), sorted by date within each year
 */
async function _getWeeksByYear(lang?: string): Promise<Map<number, Week[]>> {
  const weeks = await getRegularWeeks(lang)
  const yearMap = new Map<number, Week[]>()

  weeks.forEach((week: Week) => {
    const year = week.data.pubDate.getFullYear()
    if (!yearMap.has(year)) {
      yearMap.set(year, [])
    }
    yearMap.get(year)!.push(week)
  })

  // Sort weeks within each year by date
  yearMap.forEach((yearWeeks) => {
    yearWeeks.sort((a, b) => {
      const aDate = a.data.pubDate
      const bDate = b.data.pubDate
      return bDate.getMonth() - aDate.getMonth() || bDate.getDate() - aDate.getDate()
    })
  })

  return new Map([...yearMap.entries()].sort((a, b) => b[0] - a[0]))
}

export const getWeeksByYear = memoize(_getWeeksByYear)

// Seasons helper functions based on Chinese 24 Solar Terms

type Season = 'spring' | 'summer' | 'autumn' | 'winter'

interface SeasonInfo {
  name: string
  season: Season
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
}

/**
 * Check if a date falls within a date range
 */
function isDateInRange(date: Date, startMonth: number, startDay: number, endMonth: number, endDay: number): boolean {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()

  if (startMonth === endMonth) {
    return month === startMonth && day >= startDay && day <= endDay
  }

  if (month === startMonth) {
    return day >= startDay
  }

  if (month === endMonth) {
    return day <= endDay
  }

  return month > startMonth && month < endMonth
}

/**
 * Get season information for a given date based on Chinese 24 Solar Terms
 *
 * @param date The date to determine season for
 * @returns Season information
 */
function getSeasonForDate(date: Date): SeasonInfo {
  const year = date.getFullYear()

  // Spring: Lichun (Start of Spring) to Lixia (Start of Summer)
  // Approximately Feb 4 to May 5 (varies by year)
  if (isDateInRange(date, 2, 4, 5, 5)) {
    return {
      name: '春天',
      season: 'spring',
      startMonth: 2,
      startDay: 4,
      endMonth: 5,
      endDay: 5
    }
  }

  // Summer: Lixia (Start of Summer) to Liqiu (Start of Autumn)
  // Approximately May 5 to Aug 7 (varies by year)
  if (isDateInRange(date, 5, 5, 8, 7)) {
    return {
      name: '夏天',
      season: 'summer',
      startMonth: 5,
      startDay: 5,
      endMonth: 8,
      endDay: 7
    }
  }

  // Autumn: Liqiu (Start of Autumn) to Lidong (Start of Winter)
  // Approximately Aug 7 to Nov 7 (varies by year)
  if (isDateInRange(date, 8, 7, 11, 7)) {
    return {
      name: '秋天',
      season: 'autumn',
      startMonth: 8,
      startDay: 7,
      endMonth: 11,
      endDay: 7
    }
  }

  // Winter: Lidong (Start of Winter) to Lichun (Start of Spring)
  // Approximately Nov 7 to Feb 4 of next year (varies by year)
  if (isDateInRange(date, 11, 7, 12, 31) || isDateInRange(date, 1, 1, 2, 4)) {
    return {
      name: '冬天',
      season: 'winter',
      startMonth: 11,
      startDay: 7,
      endMonth: 2,
      endDay: 4
    }
  }

  // Default fallback
  return {
    name: '冬天',
    season: 'winter',
    startMonth: 11,
    startDay: 7,
    endMonth: 2,
    endDay: 4
  }
}


/**
 * Group weeks by year and season
 *
 * @param lang The language code to filter by, defaults to site's default language
 * @returns Map where keys are years and values are Maps of seasons to weeks
 */
async function _getWeeksByYearAndSeason(lang?: string): Promise<Map<number, Map<Season, Week[]>>> {
  const weeks = await getRegularWeeks(lang)
  const yearMap = new Map<number, Map<Season, Week[]>>()

  weeks.forEach((week: Week) => {
    const year = week.data.pubDate.getFullYear()
    const seasonInfo = getSeasonForDate(week.data.pubDate)

    if (!yearMap.has(year)) {
      yearMap.set(year, new Map())
    }

    const seasonMap = yearMap.get(year)!
    if (!seasonMap.has(seasonInfo.season)) {
      seasonMap.set(seasonInfo.season, [])
    }

    seasonMap.get(seasonInfo.season)!.push(week)
  })

  // Sort weeks within each season by date
  yearMap.forEach((seasonMap) => {
    seasonMap.forEach((seasonWeeks) => {
      seasonWeeks.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
    })
  })

  return new Map([...yearMap.entries()].sort((a, b) => b[0] - a[0]))
}

export const getWeeksByYearAndSeason = memoize(_getWeeksByYearAndSeason)
