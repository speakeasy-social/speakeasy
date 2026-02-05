import {useCallback, useEffect, useState} from 'react'
import {Dimensions, View} from 'react-native'
import {Image as RNImage} from 'react-native-image-crop-picker'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {compressIfNeeded} from '#/lib/media/manip'
import {cleanError} from '#/lib/strings/errors'
import {useWarnMaxGraphemeCount} from '#/lib/strings/helpers'
import {logger} from '#/logger'
import {isWeb} from '#/platform/detection'
import {
  type ProfileViewDetailedWithPrivate,
  useProfileUpdateMutation,
} from '#/state/queries/profile'
import {
  PRONOUNS_MAX_GRAPHEMES,
  setProfilePronouns,
  useEditablePronouns,
  useSavePronounsMutation,
} from '#/state/queries/pronouns'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import * as Toast from '#/view/com/util/Toast'
import {EditableUserAvatar} from '#/view/com/util/UserAvatar'
import {UserBanner} from '#/view/com/util/UserBanner'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Globe_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'

const DISPLAY_NAME_MAX_GRAPHEMES = 64
const DESCRIPTION_MAX_GRAPHEMES = 256

const SCREEN_HEIGHT = Dimensions.get('window').height

export function EditProfileDialog({
  profile,
  control,
  onUpdate,
}: {
  profile: ProfileViewDetailedWithPrivate
  control: Dialog.DialogControlProps
  onUpdate?: () => void
}) {
  const {_} = useLingui()
  const cancelControl = Dialog.useDialogControl()
  const [dirty, setDirty] = useState(false)

  // 'You might lose unsaved changes' warning
  useEffect(() => {
    if (isWeb && dirty) {
      const abortController = new AbortController()
      const {signal} = abortController
      window.addEventListener('beforeunload', evt => evt.preventDefault(), {
        signal,
      })
      return () => {
        abortController.abort()
      }
    }
  }, [dirty])

  const onPressCancel = useCallback(() => {
    if (dirty) {
      cancelControl.open()
    } else {
      control.close()
    }
  }, [dirty, control, cancelControl])

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{
        preventDismiss: dirty,
        minHeight: SCREEN_HEIGHT,
      }}
      testID="editProfileModal">
      <DialogInner
        profile={profile}
        onUpdate={onUpdate}
        setDirty={setDirty}
        onPressCancel={onPressCancel}
      />

      <Prompt.Basic
        control={cancelControl}
        title={_(msg`Discard changes?`)}
        description={_(msg`Are you sure you want to discard your changes?`)}
        onConfirm={() => control.close()}
        confirmButtonCta={_(msg`Discard`)}
        confirmButtonColor="negative"
      />
    </Dialog.Outer>
  )
}

function DialogInner({
  profile,
  onUpdate,
  setDirty,
  onPressCancel,
}: {
  profile: ProfileViewDetailedWithPrivate
  onUpdate?: () => void
  setDirty: (dirty: boolean) => void
  onPressCancel: () => void
}) {
  const {_} = useLingui()
  const t = useTheme()
  const control = Dialog.useDialogContext()
  const {
    mutateAsync: updateProfileMutation,
    error: updateProfileError,
    isError: isUpdateProfileError,
    isPending: isUpdatingProfile,
  } = useProfileUpdateMutation()
  const savePronounsMutation = useSavePronounsMutation()
  const [imageError, setImageError] = useState('')
  const privateProfileMeta = (profile as ProfileViewDetailedWithPrivate)
    ._privateProfile
  const initialDisplayName = profile.displayName || ''
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const initialDescription = profile.description || ''
  const [description, setDescription] = useState(initialDescription)
  const [isPrivate, setIsPrivate] = useState(
    privateProfileMeta?.isPrivate ?? false,
  )
  const [publicDescription, setPublicDescription] = useState('')
  // Track private media URIs for migration when switching modes
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
    initialPronouns,
    parsedSets,
    nativePronounsValue,
    pronounsTooLong,
  } = useEditablePronouns(profile)

  const dirty =
    displayName !== initialDisplayName ||
    description !== initialDescription ||
    userAvatar !== profile.avatar ||
    userBanner !== profile.banner ||
    pronouns !== initialPronouns ||
    isPrivate !== (privateProfileMeta?.isPrivate ?? false) ||
    publicDescription !== ''

  useEffect(() => {
    setDirty(dirty)
  }, [dirty, setDirty])

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
    setImageError('')
    try {
      await updateProfileMutation({
        profile,
        updates: existing => {
          existing = existing || {}
          existing.displayName = displayName.trimEnd()
          existing.description = description.trimEnd()
          if (!isPrivate) setProfilePronouns(existing, nativePronounsValue)
          return existing
        },
        newUserAvatar,
        newUserBanner,
        isPrivate,
        existingPrivateAvatarUri: privateProfileMeta?.avatarUri,
        existingPrivateBannerUri: privateProfileMeta?.bannerUri,
        pronouns: {native: nativePronounsValue, sets: parsedSets},
        privateDisplayName: displayName.trimEnd(),
        privateDescription: description.trimEnd(),
      })
      if (!isPrivate) {
        await savePronounsMutation.mutateAsync({
          did: profile.did,
          sets: parsedSets,
        })
      }
      onUpdate?.()
      control.close()
      Toast.show(_(msg`Profile updated`))
    } catch (e: any) {
      logger.error('Failed to update user profile', {message: String(e)})
    }
  }, [
    updateProfileMutation,
    savePronounsMutation,
    profile,
    onUpdate,
    control,
    displayName,
    description,
    nativePronounsValue,
    parsedSets,
    isPrivate,
    privateAvatarUri,
    privateBannerUri,
    newUserAvatar,
    newUserBanner,
    setImageError,
    _,
  ])

  const displayNameTooLong = useWarnMaxGraphemeCount({
    text: displayName,
    maxCount: DISPLAY_NAME_MAX_GRAPHEMES,
  })
  const descriptionTooLong = useWarnMaxGraphemeCount({
    text: description,
    maxCount: DESCRIPTION_MAX_GRAPHEMES,
  })
  const cancelButton = useCallback(
    () => (
      <Button
        label={_(msg`Cancel`)}
        onPress={onPressCancel}
        size="small"
        color="primary"
        variant="ghost"
        style={[a.rounded_full]}
        testID="editProfileCancelBtn">
        <ButtonText style={[a.text_md]}>
          <Trans>Cancel</Trans>
        </ButtonText>
      </Button>
    ),
    [onPressCancel, _],
  )

  const saveButton = useCallback(
    () => (
      <Button
        label={_(msg`Save`)}
        onPress={onPressSave}
        disabled={
          !dirty ||
          isUpdatingProfile ||
          displayNameTooLong ||
          descriptionTooLong ||
          pronounsTooLong
        }
        size="small"
        color="primary"
        variant="ghost"
        style={[a.rounded_full]}
        testID="editProfileSaveBtn">
        <ButtonText style={[a.text_md, !dirty && t.atoms.text_contrast_low]}>
          <Trans>Save</Trans>
        </ButtonText>
      </Button>
    ),
    [
      _,
      t,
      dirty,
      onPressSave,
      isUpdatingProfile,
      displayNameTooLong,
      descriptionTooLong,
      pronounsTooLong,
    ],
  )

  return (
    <Dialog.ScrollableInner
      label={_(msg`Edit profile`)}
      style={[a.overflow_hidden]}
      contentContainerStyle={[a.px_0, a.pt_0]}
      header={
        <Dialog.Header renderLeft={cancelButton} renderRight={saveButton}>
          <Dialog.HeaderText>
            <Trans>Edit profile</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>
      }>
      <View style={[a.relative]}>
        <UserBanner banner={userBanner} onSelectNewBanner={onSelectNewBanner} />
        <View
          style={[
            a.absolute,
            {
              top: 80,
              left: 20,
              width: 84,
              height: 84,
              borderWidth: 2,
              borderRadius: 42,
              borderColor: t.atoms.bg.backgroundColor,
            },
          ]}>
          <EditableUserAvatar
            size={80}
            avatar={userAvatar}
            onSelectNewAvatar={onSelectNewAvatar}
          />
        </View>
      </View>
      {isUpdateProfileError && (
        <View style={[a.mt_xl]}>
          <ErrorMessage message={cleanError(updateProfileError)} />
        </View>
      )}
      {imageError !== '' && (
        <View style={[a.mt_xl]}>
          <ErrorMessage message={imageError} />
        </View>
      )}
      <View style={[a.mt_4xl, a.px_xl, a.gap_xl]}>
        <View>
          <TextField.LabelText>
            <Trans>Display name</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={displayNameTooLong}>
            <Dialog.Input
              defaultValue={displayName}
              onChangeText={setDisplayName}
              label={_(msg`Display name`)}
              placeholder={_(msg`e.g. Alice Lastname`)}
              testID="editProfileDisplayNameInput"
            />
          </TextField.Root>
          {displayNameTooLong && (
            <TextField.SuffixText
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_bold,
                {color: t.palette.negative_400},
              ]}
              label={_(msg`Display name is too long`)}>
              <Trans>
                Display name is too long. The maximum number of characters is{' '}
                {DISPLAY_NAME_MAX_GRAPHEMES}.
              </Trans>
            </TextField.SuffixText>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Description</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={descriptionTooLong}>
            <Dialog.Input
              defaultValue={description}
              onChangeText={setDescription}
              multiline
              label={_(msg`Display name`)}
              placeholder={_(msg`Tell us a bit about yourself`)}
              testID="editProfileDescriptionInput"
            />
          </TextField.Root>
          {descriptionTooLong && (
            <TextField.SuffixText
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_bold,
                {color: t.palette.negative_400},
              ]}
              label={_(msg`Description is too long`)}>
              <Trans>
                Description is too long. The maximum number of characters is{' '}
                {DESCRIPTION_MAX_GRAPHEMES}.
              </Trans>
            </TextField.SuffixText>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Pronouns</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={pronounsTooLong}>
            <Dialog.Input
              value={pronouns}
              onChangeText={setPronouns}
              label={_(msg`Pronouns`)}
              placeholder={_(msg`e.g. she/her, they/them`)}
              testID="editProfilePronounsInput"
            />
          </TextField.Root>
          {pronounsTooLong && (
            <TextField.SuffixText
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_bold,
                {color: t.palette.negative_400},
              ]}
              label={_(msg`Pronouns are too long`)}>
              <Trans>
                Pronouns are too long. The maximum number of characters is{' '}
                {PRONOUNS_MAX_GRAPHEMES}.
              </Trans>
            </TextField.SuffixText>
          )}
        </View>

        <View style={[a.gap_sm]}>
          <View
            style={[a.flex_row, a.align_center, a.justify_between, a.mb_sm]}>
            <TextField.LabelText>
              <Trans>Profile Visibility</Trans>
            </TextField.LabelText>
            <Button
              variant="solid"
              color="secondary"
              onPress={() => setIsPrivate(!isPrivate)}
              style={{
                borderRadius: 20,
                paddingVertical: 4,
                paddingHorizontal: 16,
                minWidth: 80,
                flexDirection: 'row',
                alignItems: 'center',
              }}
              accessibilityHint={_(
                msg`Choose to make your profile visible publicly, or only to people you trust`,
              )}
              accessibilityLabel={isPrivate ? _('Private') : _('Public')}
              label={isPrivate ? _('Private') : _('Public')}>
              <ButtonIcon icon={isPrivate ? Lock : Globe} size="sm" />
              <ButtonText
                style={{fontWeight: '600', fontSize: 15, marginLeft: 6}}>
                {isPrivate ? _('Private') : _('Public')}
              </ButtonText>
            </Button>
          </View>
          <Admonition type="info">
            {isPrivate
              ? _(
                  'Only those you trust can see your name, description, avatar and banner',
                )
              : _('Your profile is visible to everyone')}
          </Admonition>
        </View>

        {isPrivate && (
          <View>
            <TextField.LabelText>
              <Trans>Public Description</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <Dialog.Input
                value={publicDescription}
                onChangeText={setPublicDescription}
                multiline
                label={_(msg`Public description`)}
                placeholder={_(
                  msg`This profile is private and only visible on @spkeasy.social`,
                )}
                testID="editProfilePublicDescriptionInput"
              />
            </TextField.Root>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.mt_sm]}>
              <Trans>A description of your profile visible to everyone</Trans>
            </Text>
          </View>
        )}
      </View>
    </Dialog.ScrollableInner>
  )
}
