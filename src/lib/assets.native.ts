import {Image, ImageRequireSource} from 'react-native'

export const DEF_AVATAR: ImageRequireSource = require('../../assets/default-avatar.png')
export const CLOUD_SPLASH: ImageRequireSource = require('../../assets/splash.png')

// On native, require() returns a number — resolve to a fetchable URI
export const SUPPORTERS_SOCIAL_CARD_URI: string = Image.resolveAssetSource(
  require('../../assets/speakeasy/social-card-default-gradient.png'),
).uri
