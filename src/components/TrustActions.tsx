import React from 'react'
import {View} from 'react-native'
// @ts-ignore no type definition
import ProgressCircle from 'react-native-progress/Circle'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {bulkTrust, bulkUntrust} from '#/lib/api/trust'
import {useAgent} from '#/state/session'
import {show as showToast} from '#/view/com/util/Toast'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Link} from '#/components/Link'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'

const BATCH_SIZE = 1000

type Props = {
  profiles: Array<any> // TODO: Add proper type
}

type CustomError = Error & {error: string; details: {max: number}}

export function TrustActions({profiles}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const agent = useAgent()
  const confirmDialogControl = Dialog.useDialogControl()
  const progressDialogControl = Dialog.useDialogControl()
  const rateLimitDialogControl = Dialog.useDialogControl()

  const [trustLimit, setTrustLimit] = React.useState<number | null>(null)
  const [progress, setProgress] = React.useState(0)
  const [lastAction, setLastAction] = React.useState<
    'trust' | 'untrust' | null
  >(null)
  const [lastProcessedDids, setLastProcessedDids] = React.useState<string[]>([])

  const handleTrustAll = React.useCallback(() => {
    setLastAction('trust')
    confirmDialogControl.open()
  }, [confirmDialogControl])

  const handleUntrustAll = React.useCallback(() => {
    setLastAction('untrust')
    confirmDialogControl.open()
  }, [confirmDialogControl])

  const processBatch = React.useCallback(
    async (
      dids: string[],
      action: 'trust' | 'untrust',
      onProgress: (progress: number) => void,
    ) => {
      const batches = []
      let processedDids: string[] = []
      for (let i = 0; i < dids.length; i += BATCH_SIZE) {
        batches.push(dids.slice(i, i + BATCH_SIZE))
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        let result
        if (action === 'trust') {
          result = await bulkTrust(agent, batch)
        } else {
          result = await bulkUntrust(agent, batch)
        }
        processedDids = processedDids.concat(result.recipientDids)
        onProgress((i + 1) / batches.length)
      }
      return processedDids
    },
    [agent],
  )

  const handleConfirm = React.useCallback(async () => {
    confirmDialogControl.close()
    progressDialogControl.open()
    setProgress(0)

    try {
      const dids = profiles.map(p => p.did)
      const processedDids = await processBatch(dids, lastAction!, progress => {
        setProgress(progress)
      })
      setLastProcessedDids(processedDids)

      // Show success toast with undo link
      showToast(
        _(
          msg`${lastAction === 'trust' ? 'Trusted' : 'Untrusted'} ${
            processedDids.length
          } users`,
        ),
        'check',
        {
          linkTitle: _(msg`Undo`),
          onLinkPress: async () => {
            try {
              // Reverse the last action
              const reverseAction = lastAction === 'trust' ? 'untrust' : 'trust'
              await processBatch(lastProcessedDids, reverseAction, () => {})
              showToast(
                _(
                  msg`Undid ${
                    lastAction === 'trust' ? 'trusting' : 'untrusting'
                  } ${lastProcessedDids.length} users`,
                ),
                'check',
              )
            } catch (err) {
              showToast(
                _(
                  msg`Failed to undo ${
                    lastAction === 'trust' ? 'trust' : 'untrust'
                  } action`,
                ),
                'exclamation',
              )
            }
          },
        },
      )
    } catch (err) {
      const error = err as CustomError
      if (error.error === 'RateLimitError') {
        setTrustLimit(error.details.max)
        rateLimitDialogControl.open()
      } else {
        showToast(
          _(
            msg`Failed to ${
              lastAction === 'trust' ? 'trust' : 'untrust'
            } all users`,
          ),
          'exclamation',
        )
      }
    } finally {
      progressDialogControl.close()
    }
  }, [
    confirmDialogControl,
    progressDialogControl,
    lastAction,
    processBatch,
    profiles,
    _,
    rateLimitDialogControl,
    lastProcessedDids,
  ])

  const baseUrl = 'https://about.speakeasy.com/donate'

  const params = new URLSearchParams({
    utm_source: 'app',
    utm_medium: 'modal',
    utm_campaign: 'trust_rate_limit',
  })

  const donateUrl = `${baseUrl}?${params.toString()}`

  return (
    <>
      <Button
        variant="solid"
        color="secondary"
        size="small"
        label={_(msg`Untrust All`)}
        onPress={handleUntrustAll}>
        <ButtonText>Untrust All</ButtonText>
      </Button>
      <Button
        variant="solid"
        color="primary"
        size="small"
        label={_(msg`Trust All`)}
        onPress={handleTrustAll}>
        <ButtonText>Trust All</ButtonText>
      </Button>

      <Prompt.Basic
        control={confirmDialogControl}
        title={_(
          msg`${lastAction === 'trust' ? 'Trust' : 'Untrust'} All Users`,
        )}
        description={_(
          msg`You are about to ${
            lastAction === 'trust' ? 'trust' : 'untrust'
          } ${profiles.length} people.`,
        )}
        confirmButtonCta={_(msg`Continue`)}
        onConfirm={handleConfirm}
      />

      <Dialog.Outer control={progressDialogControl}>
        <Dialog.Handle />
        <Dialog.ScrollableInner label={_(msg`Processing`)}>
          <View style={[a.align_center, a.gap_md, a.p_xl]}>
            <ProgressCircle
              size={60}
              progress={progress}
              color={t.palette.primary_500}
              borderWidth={0}
              unfilledColor={t.palette.contrast_50}
            />
            <Text style={[a.text_lg, a.font_bold]}>
              {lastAction === 'trust' ? 'Trusting' : 'Untrusting'}{' '}
              {profiles.length} people
            </Text>
            <Button
              variant="ghost"
              color="secondary"
              size="small"
              label={_(msg`Cancel`)}
              onPress={() => {
                progressDialogControl.close()
                setProgress(0)
              }}>
              <ButtonText>Cancel</ButtonText>
            </Button>
          </View>
        </Dialog.ScrollableInner>
      </Dialog.Outer>

      <Dialog.Outer control={rateLimitDialogControl}>
        <Dialog.Handle />
        <Dialog.ScrollableInner label={_(msg`Rate Limit Reached`)}>
          <View style={[a.gap_md, a.p_xl]}>
            <Text style={[a.text_lg]}>Daily Trust Limit Reached</Text>
            <Text style={[a.text_md]}>
              To keep our community funded services responsive for everyone,
              there is a limit of trusting {trustLimit} people per day.
            </Text>
            <Text style={[a.text_md]}>
              We will increase this limit as more people commit a{' '}
              <Link to={donateUrl} label="Make a recurring contribution">
                <Text style={[a.text_md, {color: t.palette.primary_500}]}>
                  recurring contribution
                </Text>
              </Link>{' '}
              to support the running of Speakeasy
            </Text>
            <Button
              variant="solid"
              color="primary"
              size="small"
              label={_(msg`Close`)}
              onPress={() => rateLimitDialogControl.close()}>
              <ButtonText>Close</ButtonText>
            </Button>
          </View>
        </Dialog.ScrollableInner>
      </Dialog.Outer>
    </>
  )
}
