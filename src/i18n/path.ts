import { base } from '@/config'

/**
 * Get path to a specific tag page
 *
 * @param tagName Tag name
 * @returns Path to tag page
 */
export function getTagPath(tagName: string): string {
  const tagPath = `/tags/${tagName}/`
  return base ? `${base}${tagPath}` : tagPath
}

/**
 * Get path to a specific post page
 *
 * @param slug Post slug
 * @returns Path to post page
 */
export function getPostPath(slug: string): string {
  const postPath = `/posts/${slug}/`
  return base ? `${base}${postPath}` : postPath
}

/**
 * Get path to a specific week page
 *
 * @param slug Week slug
 * @returns Path to week page
 */
export function getWeekPath(slug: string): string {
  const weekPath = `/weeks/${slug}/`
  return base ? `${base}${weekPath}` : weekPath
}

/**
 * Generate localized path
 *
 * @param path Path to localize
 * @returns Localized path
 */
export function getLocalizedPath(path: string): string {
  const normalizedPath = path.replace(/^\/|\/$/g, '')
  const localizedPath = normalizedPath === ''
    ? `/`
    : `/${normalizedPath}/`

  return base ? `${base}${localizedPath}` : localizedPath
}
