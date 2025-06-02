import React from 'react'
import {View} from 'react-native'
// @ts-ignore no type definition
import ProgressCircle from 'react-native-progress/Circle'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {bulkTrust, bulkUntrust, getDailyTrustedQuota} from '#/lib/api/trust'
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
  loadAllProfiles: (
    cursor?: string | undefined,
  ) => Promise<{dids: string[]; nextCursor: string | undefined}>
  hideTrustAll?: boolean
}

type CustomError = Error & {error: string; details: {max: number}}

export function TrustActions({loadAllProfiles, hideTrustAll}: Props) {
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
  const isCancelledRef = React.useRef(false)
  const [_isUndo, setIsUndo] = React.useState<boolean>(false)
  const [progressText, setProgressText] = React.useState<string>('')
  const [totalProcessed, setTotalProcessed] = React.useState(0)
  const [lastTrustCount, setLastTrustCount] = React.useState(0)
  const showToastFnRef = React.useRef<(() => void) | null>(null)

  const handleTrustAll = React.useCallback(() => {
    setLastAction('trust')
    confirmDialogControl.open()
  }, [confirmDialogControl])

  const handleUntrustAll = React.useCallback(() => {
    setLastAction('untrust')
    confirmDialogControl.open()
  }, [confirmDialogControl])

  const processBatches = React.useCallback(
    async (
      loadProfileDids: (
        cursor?: string,
      ) => Promise<{dids: string[]; nextCursor?: string}>,
      action: 'trust' | 'untrust',
      limit?: number,
    ) => {
      const dids: string[] = []
      let loadProfilesPromise
      let cursor: string | undefined = 'NEXT'
      let loadError: Error | null = null
      const batchSize = limit ? Math.min(limit, BATCH_SIZE) : BATCH_SIZE

      let processedDids: string[] = []
      let i = 0
      do {
        if (isCancelledRef.current) break

        if (!loadProfilesPromise && cursor) {
          loadProfilesPromise = loadProfileDids(
            cursor === 'NEXT' ? undefined : cursor,
          )
            .then(res => {
              loadProfilesPromise = null
              cursor = res.nextCursor
              dids.push(...res.dids)
            })
            .catch(err => {
              loadError = err
            })
        }

        if (i + batchSize > dids.length && cursor) {
          await loadProfilesPromise
          if (loadError) throw loadError
        } else {
          // Do we hav a full batch or are at the end?
          let batchEnd = limit
            ? Math.min(i + batchSize, i + limit - processedDids.length)
            : i + batchSize
          const batch = dids.slice(i, batchEnd)
          if (batch.length === 0) break
          let result
          if (action === 'trust') {
            result = await bulkTrust(agent, batch)
          } else {
            result = await bulkUntrust(agent, batch)
          }
          processedDids = processedDids.concat(result.recipientDids)
          i += batch.length
          setTotalProcessed(processedDids.length)
          setProgress(i / dids.length)
          // setProgress(processedDids.length / (processedDids.length + Math.max(1, dids.length - i)))
        }
      } while (
        ((!limit || processedDids.length < limit) && i < dids.length) ||
        !cursor
      )
      // Let last actions finish so we have a complete picture of what was done
      if (loadProfilesPromise) await loadProfilesPromise
      return {processedDids, moreRemain: cursor || i < dids.length}
    },
    [agent],
  )

  const handleConfirm = React.useCallback(async () => {
    confirmDialogControl.close()
    progressDialogControl.open()
    setProgress(0)
    setTotalProcessed(0)
    isCancelledRef.current = false
    let maxDaily: number | null = null
    let allProcessedDids: string[] = []
    setIsUndo(false)
    setProgressText(lastAction === 'trust' ? 'Trusting' : 'Untrusting')

    const showToastFn = () => {
      // Show success toast with undo link
      showToast(
        _(
          msg`${lastAction === 'trust' ? 'Trusted' : 'Untrusted'} ${
            allProcessedDids.length
          } users`,
        ),
        'check',
        {
          linkTitle: _(msg`Undo`),
          onLinkPress: undoFn,
        },
      )
    }
    showToastFnRef.current = showToastFn

    const undoFn = async () => {
      if (allProcessedDids.length === 0) {
        return
      }
      try {
        isCancelledRef.current = false
        progressDialogControl.open()
        setIsUndo(true)
        setProgressText(
          lastAction === 'trust' ? 'Undoing trust of' : 'Undoing untrust of',
        )

        // Reverse the last action
        const reverseAction = lastAction === 'trust' ? 'untrust' : 'trust'

        // Pause before starting the undo to give them time to cancel
        await new Promise(resolve => setTimeout(resolve, 3000))

        const res = await processBatches(
          () => Promise.resolve({dids: allProcessedDids}),
          reverseAction,
        )
        if (res.processedDids.length) {
          showToast(
            _(
              msg`Undid ${lastAction === 'trust' ? 'trusting' : 'untrusting'} ${
                res.processedDids.length
              } users`,
            ),
            'check',
          )
        }
      } catch (err) {
        showToast(
          _(
            msg`Failed to undo ${
              lastAction === 'trust' ? 'trust' : 'untrust'
            } action`,
          ),
          'exclamation',
        )
      } finally {
        progressDialogControl.close()
      }
    }

    try {
      const quotaRes = await getDailyTrustedQuota(agent)
      const remaining = quotaRes.remaining
      maxDaily = quotaRes.maxDaily

      const res = await processBatches(
        loadAllProfiles,
        lastAction!,
        lastAction === 'trust' ? remaining : undefined,
      )
      allProcessedDids = res.processedDids

      if (isCancelledRef.current) {
        // Let this function finish first and close the progress dialog so
        // it doesn't race with the open dialog
        setTimeout(undoFn, 0)
      } else if (res.moreRemain) {
        setLastTrustCount(allProcessedDids.length)
        const err = new Error('Exceeded daily trust limit') as CustomError
        err.error = 'RateLimitError'
        throw err
      } else {
        showToastFn()
      }
    } catch (err) {
      const error = err as CustomError
      if (error.message === 'UserCancelledError') {
        undoFn()
        return
      }
      if (error.error === 'RateLimitError') {
        setTrustLimit(error.details?.max || maxDaily)
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
    agent,
    confirmDialogControl,
    progressDialogControl,
    lastAction,
    processBatches,
    loadAllProfiles,
    _,
    rateLimitDialogControl,
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
      {!hideTrustAll && (
        <Button
          variant="solid"
          color="primary"
          size="small"
          label={_(msg`Trust All`)}
          onPress={handleTrustAll}>
          <ButtonText>Trust All</ButtonText>
        </Button>
      )}

      <Prompt.Basic
        control={confirmDialogControl}
        title={_(
          msg`${lastAction === 'trust' ? 'Trust' : 'Untrust'} All Users`,
        )}
        description={_(
          msg`You are about to ${
            lastAction === 'trust' ? 'trust' : 'untrust'
          } all people. ${
            lastAction === 'trust' ? 'This may take a while.' : ''
          }`,
        )}
        admonition={
          lastAction === 'untrust'
            ? {
                type: 'warning',
                content: _(
                  msg`Warning: You may not be able to undo this action.`,
                ),
              }
            : undefined
        }
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
              {progressText} {totalProcessed} people
            </Text>
            {!isCancelledRef.current && (
              <Button
                variant="ghost"
                color="secondary"
                size="small"
                label={_(msg`Cancel`)}
                onPress={() => {
                  progressDialogControl.close()
                  setProgress(0)
                  isCancelledRef.current = true
                }}>
                <ButtonText>Cancel</ButtonText>
              </Button>
            )}
          </View>
        </Dialog.ScrollableInner>
      </Dialog.Outer>

      <Dialog.Outer control={rateLimitDialogControl}>
        <Dialog.Handle />
        <Dialog.ScrollableInner label={_(msg`Rate Limit Reached`)}>
          <View style={[a.gap_md, a.p_xl]}>
            <Text style={[a.text_lg]}>Daily Trust Limit Reached</Text>
            <Text style={[a.text_md]}>
              Added {lastTrustCount} trusted people.
            </Text>
            <Text style={[a.text_md]}>
              To keep our community funded services responsive for everyone,
              there is a limit of trusting {trustLimit} people per day.
            </Text>
            <Text style={[a.text_md]}>
              We will increase this limit as more people are able to{' '}
              <Link to={donateUrl} label="Make a recurring contribution">
                <Text style={[a.text_md, {color: t.palette.primary_500}]}>
                  support the running of Speakeasy
                </Text>
              </Link>
              .
            </Text>
            <Button
              variant="solid"
              color="primary"
              size="small"
              label={_(msg`Close`)}
              onPress={() => {
                rateLimitDialogControl.close()
                showToastFnRef.current?.()
              }}>
              <ButtonText>Close</ButtonText>
            </Button>
          </View>
        </Dialog.ScrollableInner>
      </Dialog.Outer>
    </>
  )
}
