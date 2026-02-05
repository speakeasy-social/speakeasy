import {useCallback, useState} from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {Image as RNImage} from 'react-native-image-crop-picker'
import Animated, {FadeOut} from 'react-native-reanimated'
import {LinearGradient} from 'expo-linear-gradient'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {DEFAULT_PRIVATE_DESCRIPTION} from '#/lib/api/private-profiles'
import {MAX_DESCRIPTION, MAX_DISPLAY_NAME} from '#/lib/constants'
import {usePalette} from '#/lib/hooks/usePalette'
import {compressIfNeeded} from '#/lib/media/manip'
import {cleanError} from '#/lib/strings/errors'
import {enforceLen} from '#/lib/strings/helpers'
import {colors, gradients, s} from '#/lib/styles'
import {useTheme} from '#/lib/ThemeContext'
import {logger} from '#/logger'
import {isWeb} from '#/platform/detection'
import {useModalControls} from '#/state/modals'
import {
  type ProfileViewDetailedWithPrivate,
  useProfileUpdateMutation,
} from '#/state/queries/profile'
import {
  setProfilePronouns,
  useEditablePronouns,
  useSavePronounsMutation,
} from '#/state/queries/pronouns'
import {Text} from '#/view/com/util/text/Text'
import * as Toast from '#/view/com/util/Toast'
import {EditableUserAvatar} from '#/view/com/util/UserAvatar'
import {UserBanner} from '#/view/com/util/UserBanner'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Globe_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {ErrorMessage} from '../util/error/ErrorMessage'

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity)

export const snapPoints = ['fullscreen']

export function Component({
  profile,
  onUpdate,
}: {
  profile: ProfileViewDetailedWithPrivate
  onUpdate?: () => void
}) {
  const pal = usePalette('default')
  const theme = useTheme()
  const {_} = useLingui()
  const {closeModal} = useModalControls()
  const updateMutation = useProfileUpdateMutation()
  const savePronounsMutation = useSavePronounsMutation()
  const [imageError, setImageError] = useState<string>('')
  const privateProfileMeta = (profile as ProfileViewDetailedWithPrivate)
    ._privateProfile
  const [displayName, setDisplayName] = useState<string>(
    profile.displayName || '',
  )
  const [description, setDescription] = useState<string>(
    profile.description || '',
  )
  const [isPrivate, setIsPrivate] = useState(
    privateProfileMeta?.isPrivate ?? false,
  )
  const [publicDescription, setPublicDescription] = useState(() => {
    const stored = profile._privateProfile?.publicDescription
    // Show empty if it matches default, so placeholder displays instead
    if (!stored || stored === DEFAULT_PRIVATE_DESCRIPTION) return ''
    return stored
  })
  const [privateAvatarUri] = useState(profile._privateProfile?.avatarUri)
  const [privateBannerUri] = useState(profile._privateProfile?.bannerUri)
  const [userBanner, setUserBanner] = useState<string | undefined | null>(
    profile.banner,
  )
  const [userAvatar, setUserAvatar] = useState<string | undefined | null>(
    profile.avatar,
  )
  const [newUserBanner, setNewUserBanner] = useState<
    RNImage | undefined | null
  >()
  const [newUserAvatar, setNewUserAvatar] = useState<
    RNImage | undefined | null
  >()

  // Pronouns state
  const {
    pronouns,
    setPronouns,
    parsedSets,
    nativePronounsValue,
    pronounsTooLong,
  } = useEditablePronouns(profile)

  const onPressCancel = () => {
    closeModal()
  }
  const onSelectNewAvatar = useCallback(
    async (img: RNImage | null) => {
      setImageError('')
      if (img === null) {
        setNewUserAvatar(null)
        setUserAvatar(null)
        return
      }
      try {
        const finalImg = await compressIfNeeded(img, 1000000)
        setNewUserAvatar(finalImg)
        setUserAvatar(finalImg.path)
      } catch (e: any) {
        setImageError(cleanError(e))
      }
    },
    [setNewUserAvatar, setUserAvatar, setImageError],
  )

  const onSelectNewBanner = useCallback(
    async (img: RNImage | null) => {
      setImageError('')
      if (!img) {
        setNewUserBanner(null)
        setUserBanner(null)
        return
      }
      try {
        const finalImg = await compressIfNeeded(img, 1000000)
        setNewUserBanner(finalImg)
        setUserBanner(finalImg.path)
      } catch (e: any) {
        setImageError(cleanError(e))
      }
    },
    [setNewUserBanner, setUserBanner, setImageError],
  )

  const onPressSave = useCallback(async () => {
    if (pronounsTooLong) return
    setImageError('')
    try {
      await updateMutation.mutateAsync({
        profile,
        updates: existing => {
          existing = existing || {}
          existing.displayName = displayName
          existing.description = description
          if (!isPrivate) setProfilePronouns(existing, nativePronounsValue)
          return existing
        },
        newUserAvatar,
        newUserBanner,
        isPrivate,
        publicDescription: isPrivate
          ? publicDescription || undefined
          : undefined,
        existingPrivateAvatarUri: privateProfileMeta?.avatarUri,
        existingPrivateBannerUri: privateProfileMeta?.bannerUri,
        pronouns: {native: nativePronounsValue, sets: parsedSets},
        privateDisplayName: displayName,
        privateDescription: description,
      })
      if (!isPrivate) {
        await savePronounsMutation.mutateAsync({
          did: profile.did,
          sets: parsedSets,
        })
      }
      Toast.show(_(msg`Profile updated`))
      onUpdate?.()
      closeModal()
    } catch (e: any) {
      logger.error('Failed to update user profile', {message: String(e)})
    }
  }, [
    updateMutation,
    savePronounsMutation,
    profile,
    onUpdate,
    closeModal,
    displayName,
    description,
    nativePronounsValue,
    parsedSets,
    pronounsTooLong,
    isPrivate,
    publicDescription,
    privateAvatarUri,
    privateBannerUri,
    newUserAvatar,
    newUserBanner,
    setImageError,
    _,
  ])

  return (
    <KeyboardAvoidingView style={s.flex1} behavior="height">
      <ScrollView style={[pal.view]} testID="editProfileModal">
        <Text style={[styles.title, pal.text]}>
          <Trans>Edit my profile</Trans>
        </Text>
        <View style={styles.photos}>
          <UserBanner
            banner={userBanner}
            onSelectNewBanner={onSelectNewBanner}
          />
          <View style={[styles.avi, {borderColor: pal.colors.background}]}>
            <EditableUserAvatar
              size={80}
              avatar={userAvatar}
              onSelectNewAvatar={onSelectNewAvatar}
            />
          </View>
        </View>
        {updateMutation.isError && (
          <View style={styles.errorContainer}>
            <ErrorMessage message={cleanError(updateMutation.error)} />
          </View>
        )}
        {imageError !== '' && (
          <View style={styles.errorContainer}>
            <ErrorMessage message={imageError} />
          </View>
        )}
        <View style={styles.form}>
          <View style={[s.pb10]}>
            <View style={[styles.toggleContainer]}>
              <Text style={[styles.label, pal.text]}>
                <Trans>Profile Visibility</Trans>
              </Text>
              <Button
                variant="solid"
                color="secondary"
                onPress={() => setIsPrivate(!isPrivate)}
                style={[
                  styles.visibilityButton,
                  isPrivate ? styles.private : styles.public,
                ]}
                accessibilityHint={_(
                  msg`Choose to make your profile visible publicly, or only to people you trust`,
                )}
                accessibilityLabel={isPrivate ? _('Private') : _('Public')}
                label={isPrivate ? _('Private') : _('Public')}>
                <ButtonIcon icon={isPrivate ? Lock : Globe} size="sm" />
                <ButtonText style={styles.visibilityButtonText}>
                  {isPrivate ? _('Private') : _('Public')}
                </ButtonText>
              </Button>
            </View>
            <Admonition type="info">
              {isPrivate
                ? _(
                    "Only those you trust can see your name, description, avatar and banner\nAny public posts you've made and who you follow remain public",
                  )
                : _('Your profile is visible to everyone')}
            </Admonition>
          </View>
          <View>
            <Text style={[styles.label, pal.text]}>
              <Trans>Display Name</Trans>
            </Text>
            <TextInput
              testID="editProfileDisplayNameInput"
              style={[styles.textInput, pal.border, pal.text]}
              placeholder={_(msg`e.g. Alice Roberts`)}
              placeholderTextColor={colors.gray4}
              value={displayName}
              onChangeText={v =>
                setDisplayName(enforceLen(v, MAX_DISPLAY_NAME))
              }
              accessible={true}
              accessibilityLabel={_(msg`Display name`)}
              accessibilityHint={_(msg`Edit your display name`)}
            />
          </View>
          <View style={s.pb10}>
            <Text style={[styles.label, pal.text]}>
              <Trans>Description</Trans>
            </Text>
            <TextInput
              testID="editProfileDescriptionInput"
              style={[styles.textArea, pal.border, pal.text]}
              placeholder={_(msg`e.g. Artist, dog-lover, and avid reader.`)}
              placeholderTextColor={colors.gray4}
              keyboardAppearance={theme.colorScheme}
              multiline
              value={description}
              onChangeText={v => setDescription(enforceLen(v, MAX_DESCRIPTION))}
              accessible={true}
              accessibilityLabel={_(msg`Description`)}
              accessibilityHint={_(msg`Edit your profile description`)}
            />
          </View>
          <View style={s.pb10}>
            <Text style={[styles.label, pal.text]}>
              <Trans>Pronouns</Trans>
            </Text>
            <TextInput
              testID="editProfilePronounsInput"
              style={[styles.textInput, pal.border, pal.text]}
              placeholder={_(msg`e.g. she/her, they/them`)}
              placeholderTextColor={colors.gray4}
              value={pronouns}
              onChangeText={setPronouns}
              accessible={true}
              accessibilityLabel={_(msg`Pronouns`)}
              accessibilityHint={_(msg`Edit your pronouns`)}
            />
          </View>

          {isPrivate && (
            <View style={s.pb10}>
              <Text style={[styles.label, pal.text]}>
                <Trans>Public Description</Trans>
              </Text>
              <TextInput
                testID="editProfilePublicDescriptionInput"
                style={[styles.textArea, pal.border, pal.text]}
                placeholder={_(
                  msg`This profile is private and only visible on @spkeasy.social`,
                )}
                placeholderTextColor={colors.gray4}
                keyboardAppearance={theme.colorScheme}
                multiline
                value={publicDescription}
                onChangeText={setPublicDescription}
                accessible={true}
                accessibilityLabel={_(msg`Public description`)}
                accessibilityHint={_(
                  msg`A description of your profile visible to everyone`,
                )}
              />
            </View>
          )}
          {updateMutation.isPending ? (
            <View style={[styles.btn, s.mt10, {backgroundColor: colors.gray2}]}>
              <ActivityIndicator />
            </View>
          ) : (
            <TouchableOpacity
              testID="editProfileSaveBtn"
              style={s.mt10}
              onPress={onPressSave}
              accessibilityRole="button"
              accessibilityLabel={_(msg`Save`)}
              accessibilityHint={_(msg`Saves any changes to your profile`)}>
              <LinearGradient
                colors={[gradients.blueLight.start, gradients.blueLight.end]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={[styles.btn]}>
                <Text style={[s.white, s.bold]}>
                  <Trans>Save Changes</Trans>
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {!updateMutation.isPending && (
            <AnimatedTouchableOpacity
              exiting={!isWeb ? FadeOut : undefined}
              testID="editProfileCancelBtn"
              style={s.mt5}
              onPress={onPressCancel}
              accessibilityRole="button"
              accessibilityLabel={_(msg`Cancel profile editing`)}
              accessibilityHint=""
              onAccessibilityEscape={onPressCancel}>
              <View style={[styles.btn]}>
                <Text style={[s.black, s.bold, pal.text]}>
                  <Trans>Cancel</Trans>
                </Text>
              </View>
            </AnimatedTouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 24,
    marginBottom: 18,
  },
  label: {
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingBottom: 4,
    marginTop: 20,
  },
  form: {
    paddingHorizontal: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 32,
    padding: 10,
    marginBottom: 10,
  },
  avi: {
    position: 'absolute',
    top: 80,
    left: 24,
    width: 84,
    height: 84,
    borderWidth: 2,
    borderRadius: 42,
  },
  photos: {
    marginBottom: 36,
    marginHorizontal: -14,
  },
  errorContainer: {marginTop: 20},
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  visibilityButton: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 16,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
  },
  visibilityButtonText: {
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 6,
  },
  private: {},
  public: {},
})
