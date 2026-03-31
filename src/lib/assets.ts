import {ImageRequireSource} from 'react-native'

// @ts-ignore we need to pretend -prf
export const DEF_AVATAR: ImageRequireSource = {uri: '/img/default-avatar.png'}
// @ts-ignore we need to pretend -prf
export const CLOUD_SPLASH: ImageRequireSource = {uri: '/img/splash.png'}

// On web, require() returns a string URL directly
export const SUPPORTERS_SOCIAL_CARD_URI: string =
  require('../../assets/speakeasy/social-card-default-gradient.png') as string
