import React from 'react'

import {Provider as AltTextRequiredProvider} from './alt-text-required'
import {Provider as AutoplayProvider} from './autoplay'
import {Provider as DisableHapticsProvider} from './disable-haptics'
import {Provider as ExternalEmbedsProvider} from './external-embeds-prefs'
import {Provider as HiddenPostsProvider} from './hidden-posts'
import {Provider as ImageLayoutProvider} from './image-layout'
import {Provider as InAppBrowserProvider} from './in-app-browser'
import {Provider as KawaiiProvider} from './kawaii'
import {Provider as LanguagesProvider} from './languages'
import {Provider as LargeAltBadgeProvider} from './large-alt-badge'
import {Provider as LeaveOptionsProvider} from './leave-options'
import {Provider as ShowInteractionNumbersProvider} from './show-interaction-numbers'
import {Provider as SubtitlesProvider} from './subtitles'
import {Provider as TrendingSettingsProvider} from './trending'
import {Provider as UsedStarterPacksProvider} from './used-starter-packs'

export {
  useRequireAltTextEnabled,
  useSetRequireAltTextEnabled,
} from './alt-text-required'
export {useAutoplayDisabled, useSetAutoplayDisabled} from './autoplay'
export {useHapticsDisabled, useSetHapticsDisabled} from './disable-haptics'
export {
  useExternalEmbedsPrefs,
  useSetExternalEmbedPref,
} from './external-embeds-prefs'
export * from './hidden-posts'
export {useGridLayoutEnabled, useSetGridLayoutEnabled} from './image-layout'
export {useInAppBrowser, useSetInAppBrowser} from './in-app-browser'
export {useLabelDefinitions} from './label-defs'
export {useLanguagePrefs, useLanguagePrefsApi} from './languages'
export {
  useLargeAltBadgeEnabled,
  useSetLargeAltBadgeEnabled,
} from './large-alt-badge'
export {useLeaveOptions, useSetLeaveOptions} from './leave-options'
export {
  useSetShowInteractionNumbers,
  useShowInteractionNumbers,
} from './show-interaction-numbers'
export {useSetSubtitlesEnabled, useSubtitlesEnabled} from './subtitles'

export function Provider({children}: React.PropsWithChildren<{}>) {
  return (
    <LanguagesProvider>
      <AltTextRequiredProvider>
        <LargeAltBadgeProvider>
          <ExternalEmbedsProvider>
            <HiddenPostsProvider>
              <InAppBrowserProvider>
                <DisableHapticsProvider>
                  <AutoplayProvider>
                    <UsedStarterPacksProvider>
                      <SubtitlesProvider>
                        <TrendingSettingsProvider>
                          <KawaiiProvider>
                            <ShowInteractionNumbersProvider>
                              <LeaveOptionsProvider>
                                <ImageLayoutProvider>
                                  {children}
                                </ImageLayoutProvider>
                              </LeaveOptionsProvider>
                            </ShowInteractionNumbersProvider>
                          </KawaiiProvider>
                        </TrendingSettingsProvider>
                      </SubtitlesProvider>
                    </UsedStarterPacksProvider>
                  </AutoplayProvider>
                </DisableHapticsProvider>
              </InAppBrowserProvider>
            </HiddenPostsProvider>
          </ExternalEmbedsProvider>
        </LargeAltBadgeProvider>
      </AltTextRequiredProvider>
    </LanguagesProvider>
  )
}
