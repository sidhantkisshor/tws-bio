export interface DeepLinkConfig {
  ios: string | null
  android: string | null
  fallback: string
  platform: string
}

export function detectDeepLinks(url: string): DeepLinkConfig | null {
  try {
    const urlObj = new URL(url)
    
    // YouTube
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      return generateYouTubeDeepLinks(urlObj)
    }
    
    // Instagram
    if (urlObj.hostname.includes('instagram.com')) {
      return generateInstagramDeepLinks(urlObj)
    }
    
    // Twitter/X
    if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
      return generateTwitterDeepLinks(urlObj)
    }
    
    // TikTok
    if (urlObj.hostname.includes('tiktok.com')) {
      return generateTikTokDeepLinks(urlObj)
    }
    
    // Spotify
    if (urlObj.hostname.includes('spotify.com')) {
      return generateSpotifyDeepLinks(urlObj)
    }
    
    // LinkedIn
    if (urlObj.hostname.includes('linkedin.com')) {
      return generateLinkedInDeepLinks(urlObj)
    }
    
    // Facebook
    if (urlObj.hostname.includes('facebook.com') || urlObj.hostname.includes('fb.com')) {
      return generateFacebookDeepLinks(urlObj)
    }
    
    // Reddit
    if (urlObj.hostname.includes('reddit.com')) {
      return generateRedditDeepLinks(urlObj)
    }
    
    // WhatsApp
    if (urlObj.hostname.includes('wa.me') || urlObj.hostname.includes('whatsapp.com')) {
      return generateWhatsAppDeepLinks(urlObj)
    }
    
    // Telegram
    if (urlObj.hostname.includes('t.me') || urlObj.hostname.includes('telegram.me')) {
      return generateTelegramDeepLinks(urlObj)
    }
    
    // Pinterest
    if (urlObj.hostname.includes('pinterest.com') || urlObj.hostname.includes('pin.it')) {
      return generatePinterestDeepLinks(urlObj)
    }
    
    // Snapchat
    if (urlObj.hostname.includes('snapchat.com')) {
      return generateSnapchatDeepLinks(urlObj)
    }
    
    // Twitch
    if (urlObj.hostname.includes('twitch.tv')) {
      return generateTwitchDeepLinks(urlObj)
    }
    
    // Discord
    if (urlObj.hostname.includes('discord.gg') || urlObj.hostname.includes('discord.com')) {
      return generateDiscordDeepLinks(urlObj)
    }
    
    // Zoom
    if (urlObj.hostname.includes('zoom.us')) {
      return generateZoomDeepLinks(urlObj)
    }
    
    // Google Maps
    if (urlObj.hostname.includes('maps.google.com') || urlObj.hostname.includes('goo.gl/maps')) {
      return generateGoogleMapsDeepLinks(urlObj)
    }
    
    // Apple Maps
    if (urlObj.hostname.includes('maps.apple.com')) {
      return generateAppleMapsDeepLinks(urlObj)
    }
    
    // Uber
    if (urlObj.hostname.includes('uber.com')) {
      return generateUberDeepLinks(urlObj)
    }
    
    // Airbnb
    if (urlObj.hostname.includes('airbnb.com')) {
      return generateAirbnbDeepLinks(urlObj)
    }
    
    // Amazon
    if (urlObj.hostname.includes('amazon.com') || urlObj.hostname.includes('amzn.to')) {
      return generateAmazonDeepLinks(urlObj)
    }
    
    // eBay
    if (urlObj.hostname.includes('ebay.com')) {
      return generateEbayDeepLinks(urlObj)
    }
    
    // Netflix
    if (urlObj.hostname.includes('netflix.com')) {
      return generateNetflixDeepLinks(urlObj)
    }
    
    // SoundCloud
    if (urlObj.hostname.includes('soundcloud.com')) {
      return generateSoundCloudDeepLinks(urlObj)
    }
    
    // Medium
    if (urlObj.hostname.includes('medium.com')) {
      return generateMediumDeepLinks(urlObj)
    }
    
    // GitHub
    if (urlObj.hostname.includes('github.com')) {
      return generateGitHubDeepLinks(urlObj)
    }
    
    // Slack
    if (urlObj.hostname.includes('slack.com')) {
      return generateSlackDeepLinks(urlObj)
    }
    
    // Venmo
    if (urlObj.hostname.includes('venmo.com')) {
      return generateVenmoDeepLinks(urlObj)
    }
    
    // Cash App
    if (urlObj.hostname.includes('cash.app')) {
      return generateCashAppDeepLinks(urlObj)
    }
    
    // PayPal
    if (urlObj.hostname.includes('paypal.com') || urlObj.hostname.includes('paypal.me')) {
      return generatePayPalDeepLinks(urlObj)
    }
    
    return null
  } catch {
    return null
  }
}

function generateYouTubeDeepLinks(url: URL): DeepLinkConfig {
  let videoId: string | null = null
  
  // Extract video ID from different YouTube URL formats
  if (url.hostname === 'youtu.be') {
    videoId = url.pathname.substring(1)
  } else if (url.pathname.includes('/watch')) {
    videoId = url.searchParams.get('v')
  } else if (url.pathname.includes('/embed/')) {
    videoId = url.pathname.split('/embed/')[1]
  }
  
  if (videoId) {
    return {
      ios: `youtube://www.youtube.com/watch?v=${videoId}`,
      android: `vnd.youtube:${videoId}`,
      fallback: url.href,
      platform: 'YouTube'
    }
  }
  
  // For channels, playlists, etc.
  return {
    ios: `youtube://${url.pathname}${url.search}`,
    android: `https://www.youtube.com${url.pathname}${url.search}`,
    fallback: url.href,
    platform: 'YouTube'
  }
}

function generateInstagramDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Instagram post
  if (pathParts[0] === 'p' && pathParts[1]) {
    return {
      ios: `instagram://media?id=${pathParts[1]}`,
      android: `instagram://media?id=${pathParts[1]}`,
      fallback: url.href,
      platform: 'Instagram'
    }
  }
  
  // Instagram profile
  if (pathParts.length === 1 && !['explore', 'reels', 'stories'].includes(pathParts[0])) {
    return {
      ios: `instagram://user?username=${pathParts[0]}`,
      android: `instagram://user?username=${pathParts[0]}`,
      fallback: url.href,
      platform: 'Instagram'
    }
  }
  
  // Instagram reel
  if (pathParts[0] === 'reel' && pathParts[1]) {
    return {
      ios: `instagram://reel?id=${pathParts[1]}`,
      android: `instagram://reel?id=${pathParts[1]}`,
      fallback: url.href,
      platform: 'Instagram'
    }
  }
  
  return {
    ios: 'instagram://app',
    android: 'instagram://app',
    fallback: url.href,
    platform: 'Instagram'
  }
}

function generateTwitterDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Tweet
  if (pathParts[1] === 'status' && pathParts[2]) {
    return {
      ios: `twitter://status?id=${pathParts[2]}`,
      android: `twitter://status?id=${pathParts[2]}`,
      fallback: url.href,
      platform: 'Twitter/X'
    }
  }
  
  // Profile
  if (pathParts.length === 1) {
    return {
      ios: `twitter://user?screen_name=${pathParts[0]}`,
      android: `twitter://user?screen_name=${pathParts[0]}`,
      fallback: url.href,
      platform: 'Twitter/X'
    }
  }
  
  return {
    ios: 'twitter://timeline',
    android: 'twitter://timeline',
    fallback: url.href,
    platform: 'Twitter/X'
  }
}

function generateTikTokDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // TikTok video
  if (pathParts[1] === 'video' && pathParts[2]) {
    return {
      ios: `tiktok://video/${pathParts[2]}`,
      android: `tiktok://video/${pathParts[2]}`,
      fallback: url.href,
      platform: 'TikTok'
    }
  }
  
  // TikTok profile
  if (pathParts[0]?.startsWith('@')) {
    return {
      ios: `tiktok://user?username=${pathParts[0].substring(1)}`,
      android: `tiktok://user?username=${pathParts[0].substring(1)}`,
      fallback: url.href,
      platform: 'TikTok'
    }
  }
  
  return {
    ios: 'tiktok://app',
    android: 'tiktok://app',
    fallback: url.href,
    platform: 'TikTok'
  }
}

function generateSpotifyDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Spotify track, album, playlist, artist
  if (['track', 'album', 'playlist', 'artist'].includes(pathParts[0]) && pathParts[1]) {
    const spotifyUri = `spotify:${pathParts[0]}:${pathParts[1]}`
    return {
      ios: spotifyUri,
      android: spotifyUri,
      fallback: url.href,
      platform: 'Spotify'
    }
  }
  
  return {
    ios: 'spotify://',
    android: 'spotify://',
    fallback: url.href,
    platform: 'Spotify'
  }
}

function generateLinkedInDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // LinkedIn profile
  if (pathParts[0] === 'in' && pathParts[1]) {
    return {
      ios: `linkedin://profile/${pathParts[1]}`,
      android: `linkedin://profile/${pathParts[1]}`,
      fallback: url.href,
      platform: 'LinkedIn'
    }
  }
  
  // LinkedIn company
  if (pathParts[0] === 'company' && pathParts[1]) {
    return {
      ios: `linkedin://company/${pathParts[1]}`,
      android: `linkedin://company/${pathParts[1]}`,
      fallback: url.href,
      platform: 'LinkedIn'
    }
  }
  
  return {
    ios: 'linkedin://',
    android: 'linkedin://',
    fallback: url.href,
    platform: 'LinkedIn'
  }
}

function generateFacebookDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Facebook profile or page
  if (pathParts.length === 1 && !['watch', 'groups', 'events'].includes(pathParts[0])) {
    return {
      ios: `fb://profile/${pathParts[0]}`,
      android: `fb://page/${pathParts[0]}`,
      fallback: url.href,
      platform: 'Facebook'
    }
  }
  
  // Facebook group
  if (pathParts[0] === 'groups' && pathParts[1]) {
    return {
      ios: `fb://group/${pathParts[1]}`,
      android: `fb://group/${pathParts[1]}`,
      fallback: url.href,
      platform: 'Facebook'
    }
  }
  
  return {
    ios: 'fb://',
    android: 'fb://',
    fallback: url.href,
    platform: 'Facebook'
  }
}

function generateRedditDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Reddit post
  if (pathParts[0] === 'r' && pathParts[2] === 'comments' && pathParts[3]) {
    return {
      ios: `reddit://reddit.com${url.pathname}`,
      android: `reddit://reddit.com${url.pathname}`,
      fallback: url.href,
      platform: 'Reddit'
    }
  }
  
  // Reddit subreddit
  if (pathParts[0] === 'r' && pathParts[1]) {
    return {
      ios: `reddit://reddit.com/r/${pathParts[1]}`,
      android: `reddit://reddit.com/r/${pathParts[1]}`,
      fallback: url.href,
      platform: 'Reddit'
    }
  }
  
  // Reddit user
  if (pathParts[0] === 'u' || pathParts[0] === 'user') {
    const username = pathParts[1]
    return {
      ios: `reddit://reddit.com/user/${username}`,
      android: `reddit://reddit.com/user/${username}`,
      fallback: url.href,
      platform: 'Reddit'
    }
  }
  
  return {
    ios: 'reddit://',
    android: 'reddit://',
    fallback: url.href,
    platform: 'Reddit'
  }
}

// Messaging & Communication Apps
function generateWhatsAppDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // WhatsApp chat link
  if (url.hostname === 'wa.me' && pathParts[0]) {
    const phoneNumber = pathParts[0]
    return {
      ios: `whatsapp://send?phone=${phoneNumber}`,
      android: `whatsapp://send?phone=${phoneNumber}`,
      fallback: url.href,
      platform: 'WhatsApp'
    }
  }
  
  return {
    ios: 'whatsapp://',
    android: 'whatsapp://',
    fallback: url.href,
    platform: 'WhatsApp'
  }
}

function generateTelegramDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Telegram channel/group
  if (pathParts.length > 0) {
    return {
      ios: `tg://resolve?domain=${pathParts[0]}`,
      android: `tg://resolve?domain=${pathParts[0]}`,
      fallback: url.href,
      platform: 'Telegram'
    }
  }
  
  return {
    ios: 'tg://',
    android: 'tg://',
    fallback: url.href,
    platform: 'Telegram'
  }
}

function generateDiscordDeepLinks(url: URL): DeepLinkConfig {
  // Discord invite
  if (url.hostname === 'discord.gg') {
    const inviteCode = url.pathname.substring(1)
    return {
      ios: `discord://discord.gg/${inviteCode}`,
      android: `discord://discord.gg/${inviteCode}`,
      fallback: url.href,
      platform: 'Discord'
    }
  }
  
  return {
    ios: 'discord://',
    android: 'discord://',
    fallback: url.href,
    platform: 'Discord'
  }
}

function generateSlackDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Slack workspace
  if (pathParts[0] && pathParts[0] !== 'signin') {
    return {
      ios: `slack://workspace?team=${pathParts[0]}`,
      android: `slack://workspace?team=${pathParts[0]}`,
      fallback: url.href,
      platform: 'Slack'
    }
  }
  
  return {
    ios: 'slack://',
    android: 'slack://',
    fallback: url.href,
    platform: 'Slack'
  }
}

// Visual Content Apps
function generatePinterestDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Pinterest pin
  if (pathParts[0] === 'pin' && pathParts[1]) {
    return {
      ios: `pinterest://pin/${pathParts[1]}`,
      android: `pinterest://pin/${pathParts[1]}`,
      fallback: url.href,
      platform: 'Pinterest'
    }
  }
  
  // Pinterest user
  if (pathParts.length === 2 && !['pin', 'board'].includes(pathParts[0])) {
    return {
      ios: `pinterest://user/${pathParts[0]}`,
      android: `pinterest://user/${pathParts[0]}`,
      fallback: url.href,
      platform: 'Pinterest'
    }
  }
  
  return {
    ios: 'pinterest://',
    android: 'pinterest://',
    fallback: url.href,
    platform: 'Pinterest'
  }
}

function generateSnapchatDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Snapchat profile
  if (pathParts[0] === 'add' && pathParts[1]) {
    return {
      ios: `snapchat://add/${pathParts[1]}`,
      android: `snapchat://add/${pathParts[1]}`,
      fallback: url.href,
      platform: 'Snapchat'
    }
  }
  
  return {
    ios: 'snapchat://',
    android: 'snapchat://',
    fallback: url.href,
    platform: 'Snapchat'
  }
}

// Streaming & Entertainment
function generateTwitchDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Twitch channel
  if (pathParts.length === 1) {
    return {
      ios: `twitch://stream/${pathParts[0]}`,
      android: `twitch://stream/${pathParts[0]}`,
      fallback: url.href,
      platform: 'Twitch'
    }
  }
  
  // Twitch video
  if (pathParts[0] === 'videos' && pathParts[1]) {
    return {
      ios: `twitch://video/${pathParts[1]}`,
      android: `twitch://video/${pathParts[1]}`,
      fallback: url.href,
      platform: 'Twitch'
    }
  }
  
  return {
    ios: 'twitch://',
    android: 'twitch://',
    fallback: url.href,
    platform: 'Twitch'
  }
}

function generateNetflixDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Netflix title
  if (pathParts[0] === 'title' && pathParts[1]) {
    return {
      ios: `nflx://www.netflix.com/title/${pathParts[1]}`,
      android: `nflx://www.netflix.com/title/${pathParts[1]}`,
      fallback: url.href,
      platform: 'Netflix'
    }
  }
  
  return {
    ios: 'nflx://',
    android: 'nflx://',
    fallback: url.href,
    platform: 'Netflix'
  }
}

function generateSoundCloudDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // SoundCloud track or user
  if (pathParts.length >= 1) {
    return {
      ios: `soundcloud://sounds:${url.pathname}`,
      android: `soundcloud://sounds:${url.pathname}`,
      fallback: url.href,
      platform: 'SoundCloud'
    }
  }
  
  return {
    ios: 'soundcloud://',
    android: 'soundcloud://',
    fallback: url.href,
    platform: 'SoundCloud'
  }
}

// Maps & Navigation
function generateGoogleMapsDeepLinks(url: URL): DeepLinkConfig {
  const query = url.searchParams.get('q') || ''
  const placeId = url.pathname.match(/place\/([^/]+)/)?.[1]
  
  if (query) {
    return {
      ios: `comgooglemaps://?q=${encodeURIComponent(query)}`,
      android: `google.navigation:q=${encodeURIComponent(query)}`,
      fallback: url.href,
      platform: 'Google Maps'
    }
  }
  
  if (placeId) {
    return {
      ios: `comgooglemaps://?q=${encodeURIComponent(placeId)}`,
      android: `google.navigation:q=${encodeURIComponent(placeId)}`,
      fallback: url.href,
      platform: 'Google Maps'
    }
  }
  
  return {
    ios: 'comgooglemaps://',
    android: 'google.navigation:',
    fallback: url.href,
    platform: 'Google Maps'
  }
}

function generateAppleMapsDeepLinks(url: URL): DeepLinkConfig {
  const query = url.searchParams.get('q') || ''
  const address = url.searchParams.get('address') || ''
  
  if (query || address) {
    const searchTerm = query || address
    return {
      ios: `maps://?q=${encodeURIComponent(searchTerm)}`,
      android: `geo:0,0?q=${encodeURIComponent(searchTerm)}`,
      fallback: url.href,
      platform: 'Apple Maps'
    }
  }
  
  return {
    ios: 'maps://',
    android: url.href,
    fallback: url.href,
    platform: 'Apple Maps'
  }
}

// E-commerce & Shopping
function generateAmazonDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Amazon product
  if (pathParts.includes('dp') || pathParts.includes('gp')) {
    const asin = pathParts[pathParts.indexOf('dp') + 1] || pathParts[pathParts.indexOf('gp') + 2]
    if (asin) {
      return {
        ios: `com.amazon.mobile.shopping://www.amazon.com/dp/${asin}`,
        android: `com.amazon.mobile.shopping://www.amazon.com/dp/${asin}`,
        fallback: url.href,
        platform: 'Amazon'
      }
    }
  }
  
  return {
    ios: 'com.amazon.mobile.shopping://',
    android: 'com.amazon.mobile.shopping://',
    fallback: url.href,
    platform: 'Amazon'
  }
}

function generateEbayDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // eBay item
  if (pathParts[0] === 'itm' && pathParts[1]) {
    return {
      ios: `ebay://launch?itm=${pathParts[1]}`,
      android: `ebay://launch?itm=${pathParts[1]}`,
      fallback: url.href,
      platform: 'eBay'
    }
  }
  
  return {
    ios: 'ebay://launch',
    android: 'ebay://launch',
    fallback: url.href,
    platform: 'eBay'
  }
}

function generateAirbnbDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Airbnb listing
  if (pathParts[0] === 'rooms' && pathParts[1]) {
    return {
      ios: `airbnb://rooms/${pathParts[1]}`,
      android: `airbnb://rooms/${pathParts[1]}`,
      fallback: url.href,
      platform: 'Airbnb'
    }
  }
  
  return {
    ios: 'airbnb://',
    android: 'airbnb://',
    fallback: url.href,
    platform: 'Airbnb'
  }
}

// Transportation
function generateUberDeepLinks(url: URL): DeepLinkConfig {
  const action = url.searchParams.get('action')
  const pickup = url.searchParams.get('pickup')
  const dropoff = url.searchParams.get('dropoff')
  
  if (action === 'setPickup' && (pickup || dropoff)) {
    const params = new URLSearchParams()
    if (pickup) params.set('pickup', pickup)
    if (dropoff) params.set('dropoff', dropoff)
    
    return {
      ios: `uber://?${params.toString()}`,
      android: `uber://?${params.toString()}`,
      fallback: url.href,
      platform: 'Uber'
    }
  }
  
  return {
    ios: 'uber://',
    android: 'uber://',
    fallback: url.href,
    platform: 'Uber'
  }
}

// Finance & Payments
function generateVenmoDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Venmo user profile
  if (pathParts.length === 1) {
    return {
      ios: `venmo://users/${pathParts[0]}`,
      android: `venmo://users/${pathParts[0]}`,
      fallback: url.href,
      platform: 'Venmo'
    }
  }
  
  return {
    ios: 'venmo://',
    android: 'venmo://',
    fallback: url.href,
    platform: 'Venmo'
  }
}

function generateCashAppDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Cash App user ($cashtag)
  if (pathParts[0]?.startsWith('$')) {
    return {
      ios: `cashapp://cash.app/${pathParts[0]}`,
      android: `cashapp://cash.app/${pathParts[0]}`,
      fallback: url.href,
      platform: 'Cash App'
    }
  }
  
  return {
    ios: 'cashapp://',
    android: 'cashapp://',
    fallback: url.href,
    platform: 'Cash App'
  }
}

function generatePayPalDeepLinks(url: URL): DeepLinkConfig {
  // PayPal.me links
  if (url.hostname === 'paypal.me') {
    const username = url.pathname.substring(1).split('/')[0]
    if (username) {
      return {
        ios: `paypal://paypalme/${username}`,
        android: `paypal://paypalme/${username}`,
        fallback: url.href,
        platform: 'PayPal'
      }
    }
  }
  
  return {
    ios: 'paypal://',
    android: 'paypal://',
    fallback: url.href,
    platform: 'PayPal'
  }
}

// Professional & Development
function generateMediumDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Medium article
  if (pathParts.length > 1) {
    return {
      ios: `medium://p/${pathParts[pathParts.length - 1]}`,
      android: `medium://p/${pathParts[pathParts.length - 1]}`,
      fallback: url.href,
      platform: 'Medium'
    }
  }
  
  return {
    ios: 'medium://',
    android: 'medium://',
    fallback: url.href,
    platform: 'Medium'
  }
}

function generateGitHubDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // GitHub repo
  if (pathParts.length >= 2) {
    const owner = pathParts[0]
    const repo = pathParts[1]
    return {
      ios: `github://github.com/${owner}/${repo}`,
      android: `github://github.com/${owner}/${repo}`,
      fallback: url.href,
      platform: 'GitHub'
    }
  }
  
  return {
    ios: 'github://',
    android: 'github://',
    fallback: url.href,
    platform: 'GitHub'
  }
}

// Video Conferencing
function generateZoomDeepLinks(url: URL): DeepLinkConfig {
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Zoom meeting
  if (pathParts[0] === 'j' && pathParts[1]) {
    const meetingId = pathParts[1]
    return {
      ios: `zoomus://zoom.us/join?confno=${meetingId}`,
      android: `zoomus://zoom.us/join?confno=${meetingId}`,
      fallback: url.href,
      platform: 'Zoom'
    }
  }
  
  return {
    ios: 'zoomus://',
    android: 'zoomus://',
    fallback: url.href,
    platform: 'Zoom'
  }
}