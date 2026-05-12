/**
 * Development build script that skips compression and LQIP
 * Usage: pnpm build:dev
 */

import { execSync } from 'node:child_process'
import process from 'node:process'

async function main() {
  console.log('🚀 Starting development build (without compression and LQIP)...')

  try {
    // Set environment variable
    process.env.SKIP_COMPRESS = 'true'

    // Run astro check
    console.log('📋 Running astro check...')
    execSync('pnpm astro check', {
      stdio: 'inherit',
      env: process.env,
    })

    // Run astro build
    console.log('🏗️  Building site...')
    execSync('pnpm astro build', {
      stdio: 'inherit',
      env: process.env,
    })

    // Skip LQIP
    console.log('⏭️  LQIP processing skipped (dev mode)')

    console.log('✅ Development build complete!')
  }
  catch (error) {
    console.error('❌ Build failed')
    process.exit(1)
  }
}

main()
