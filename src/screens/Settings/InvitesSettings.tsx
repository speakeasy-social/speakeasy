import {View} from 'react-native'
import {setStringAsync} from 'expo-clipboard'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {NativeStackScreenProps} from '@react-navigation/native-stack'

import {CommonNavigatorParams} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {SPEAKEASY_APP_HOST} from '#/lib/strings/url-helpers'
import {
  canCreateInvite,
  daysUntilCanCreateInvite,
  useCreateSpeakeasyInviteMutation,
  useSpeakeasyInvitesQuery,
} from '#/state/queries/speakeasy-invites'
import * as Toast from '#/view/com/util/Toast'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {LimitedBetaModal} from '#/components/dialogs/LimitedBetaModal'
import {Ticket_Stroke2_Corner0_Rounded as TicketIcon} from '#/components/icons/Ticket'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'InvitesSettings'>

export function InvitesSettingsScreen({}: Props) {
  const {_} = useLingui()
  const t = useTheme()

  const {data: inviteCodes, isLoading, error} = useSpeakeasyInvitesQuery()
  const createInviteMutation = useCreateSpeakeasyInviteMutation()
  const privatePostsDialogControl = useDialogControl()
  const inviteCodeRedemptionDialogControl = useDialogControl()

  // Get the most recent invite code (already sorted newest first)
  const invite = inviteCodes?.[0] ?? null

  const handleCopyCode = () => {
    if (invite?.code) {
      setStringAsync(invite.code)
      Toast.show(_(msg`Copied to clipboard`), 'clipboard-check')
    }
  }

  const handleCopyLink = () => {
    if (invite?.code) {
      const link = `${SPEAKEASY_APP_HOST}/intent/invite?code=${invite.code}`
      setStringAsync(link)
      Toast.show(_(msg`Copied to clipboard`), 'clipboard-check')
    }
  }

  const handleCreateCode = async () => {
    try {
      await createInviteMutation.mutateAsync()
      Toast.show(_(msg`Invite code created!`))
    } catch (err: any) {
      // Handle FeatureNotGranted error - open modal instead of toast
      if (err?.code === 'FeatureNotGranted') {
        privatePostsDialogControl.open()
        return
      }
      // Handle rate limit error (429)
      if (err?.status === 429 || err?.code === 'RateLimitExceeded') {
        Toast.show(
          _(msg`You can only create one invite code per week`),
          'xmark',
        )
      } else {
        const errorMessage = cleanError(
          err?.message || err?.toString() || 'Failed to create invite code',
        )
        Toast.show(_(msg`${errorMessage}`), 'xmark')
      }
    }
  }

  const canCreate = canCreateInvite(invite)
  const daysRemaining = invite ? daysUntilCanCreateInvite(invite) : 0
  const isCreating = createInviteMutation.isPending

  return (
    <Layout.Screen>
      <LimitedBetaModal
        control={privatePostsDialogControl}
        featureDescription={_(
          msg`We're rolling out private posts to make your post access to our community.`,
        )}
        featureName={_(msg`Private Post to Trusted Communities`)}
        utmParams={{
          source: 'invites_settings',
          medium: 'create_invite',
          campaign: 'groups_beta',
        }}
        onSuccess={() => {
          // Feature was activated, user can try creating invite code again
        }}
      />
      <LimitedBetaModal
        control={inviteCodeRedemptionDialogControl}
        featureDescription={_(
          msg`We're rolling out private posts to make your post access to our community.`,
        )}
        featureName={_(msg`Private Post to Trusted Communities`)}
        utmParams={{
          source: 'invites_settings',
          medium: 'redeem_invite',
          campaign: 'groups_beta',
        }}
        initialShowInviteCode={true}
        onSuccess={() => {
          // Feature was activated via invite code redemption
        }}
      />
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Invites</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          {isLoading ? (
            <View style={[a.p_xl, a.align_center]}>
              <Loader size="lg" />
            </View>
          ) : error ? (
            <View style={[a.p_xl, a.align_center, a.gap_md]}>
              <Text style={[a.text_center, t.atoms.text_contrast_medium]}>
                <Trans>Failed to load invite codes</Trans>
              </Text>
            </View>
          ) : invite ? (
            <>
              <SettingsList.Group iconInset={false}>
                <SettingsList.ItemIcon icon={TicketIcon} />
                <SettingsList.ItemText>
                  <Trans>Your Invite Code</Trans>
                </SettingsList.ItemText>
              </SettingsList.Group>

              <View style={[a.px_xl, a.py_md]}>
                <View
                  style={[
                    a.p_lg,
                    a.rounded_md,
                    t.atoms.bg_contrast_25,
                    a.flex_row,
                    a.align_center,
                    a.justify_between,
                  ]}>
                  <View style={[a.flex_1]}>
                    <Text style={[a.text_xl, a.font_bold, t.atoms.text]}>
                      {invite.code}
                    </Text>
                    <Text
                      style={[
                        a.text_sm,
                        t.atoms.text_contrast_medium,
                        a.mt_xs,
                      ]}>
                      <Trans>
                        {invite.remainingUses} of {invite.totalUses} uses
                        remaining
                      </Trans>
                    </Text>
                  </View>
                  <View style={[a.gap_sm, a.flex_row]}>
                    <Button
                      variant="solid"
                      color="secondary"
                      size="small"
                      label={_(msg`Copy invite code`)}
                      onPress={handleCopyCode}>
                      <ButtonText>
                        <Trans>Copy Code</Trans>
                      </ButtonText>
                    </Button>
                    <Button
                      variant="solid"
                      color="secondary"
                      size="small"
                      label={_(msg`Copy invite link`)}
                      onPress={handleCopyLink}>
                      <ButtonText>
                        <Trans>Copy Link</Trans>
                      </ButtonText>
                    </Button>
                  </View>
                </View>
              </View>

              {!canCreate && (
                <View style={[a.px_xl, a.pb_md]}>
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    <Trans>
                      You can create a new code in {daysRemaining} days
                    </Trans>
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={[a.p_xl, a.align_center, a.gap_md]}>
              <TicketIcon size="xl" style={[t.atoms.text_contrast_low]} />
              <Text
                style={[
                  a.text_center,
                  t.atoms.text_contrast_medium,
                  a.text_md,
                ]}>
                <Trans>
                  You don't have an invite code yet. Create one to invite
                  friends to post privately on Speakeasy!
                </Trans>
              </Text>
            </View>
          )}

          <SettingsList.Divider />

          <View style={[a.px_xl, a.py_md, a.gap_md]}>
            <Button
              variant="solid"
              color="primary"
              size="large"
              label={_(msg`Create invite code`)}
              onPress={handleCreateCode}
              disabled={!canCreate || isCreating}>
              <ButtonText>
                {isCreating ? (
                  <Trans>Creating...</Trans>
                ) : (
                  <Trans>Create Invite Code</Trans>
                )}
              </ButtonText>
            </Button>
            <Button
              variant="ghost"
              color="secondary"
              size="large"
              label={_(msg`I have an invite code`)}
              onPress={() => inviteCodeRedemptionDialogControl.open()}>
              <ButtonText>
                <Trans>Redeem an Invite Code</Trans>
              </ButtonText>
            </Button>
          </View>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}
