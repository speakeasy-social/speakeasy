import React from 'react'

import * as Dialog from '#/components/Dialog'
import {DialogControlProps} from '#/components/Dialog'
import {InviteIntentDialog} from '#/components/intents/InviteIntentDialog'
import {VerifyEmailIntentDialog} from '#/components/intents/VerifyEmailIntentDialog'

interface Context {
  verifyEmailDialogControl: DialogControlProps
  verifyEmailState: {code: string} | undefined
  setVerifyEmailState: (state: {code: string} | undefined) => void
  inviteDialogControl: DialogControlProps
  inviteState: {code: string} | undefined
  setInviteState: (state: {code: string} | undefined) => void
}

const Context = React.createContext({} as Context)
export const useIntentDialogs = () => React.useContext(Context)

export function Provider({children}: {children: React.ReactNode}) {
  const verifyEmailDialogControl = Dialog.useDialogControl()
  const [verifyEmailState, setVerifyEmailState] = React.useState<
    {code: string} | undefined
  >()
  const inviteDialogControl = Dialog.useDialogControl()
  const [inviteState, setInviteState] = React.useState<
    {code: string} | undefined
  >()

  const value = React.useMemo(
    () => ({
      verifyEmailDialogControl,
      verifyEmailState,
      setVerifyEmailState,
      inviteDialogControl,
      inviteState,
      setInviteState,
    }),
    [
      verifyEmailDialogControl,
      verifyEmailState,
      setVerifyEmailState,
      inviteDialogControl,
      inviteState,
      setInviteState,
    ],
  )

  return (
    <Context.Provider value={value}>
      {children}
      <VerifyEmailIntentDialog />
      <InviteIntentDialog />
    </Context.Provider>
  )
}
