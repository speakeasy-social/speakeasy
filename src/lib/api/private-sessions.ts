import {useCallback} from 'react'
import {useQueryClient} from '@tanstack/react-query'

import {useSpeakeasyApi} from '#/lib/api/speakeasy'
import {generateDEK, generateKeyPair} from '#/lib/encryption'
import {getTrustedUsers, RQKEY} from '#/state/queries/trusted'
import {useAgent} from '#/state/session'

export async function getSession(speakeasyApi: any) {
  const data = await speakeasyApi({
    api: 'social.spkeasy.graph.getSession',
  })

  return data.encryptedSessionKey
}

export async function getPublicKey(did: string, speakeasyApi: any) {
  const data = await speakeasyApi({
    api: 'social.spkeasy.user.getPublicKey',
    query: {
      did,
    },
  })

  return data.sessionKey
}

export async function getPrivateKey(speakeasyApi: any) {
  const data = await speakeasyApi({
    api: 'social.spkeasy.user.getPrivateKey',
  })

  return data.sessionKey
}

export async function updateUserKeyPair(
  {privateKey, publicKey},
  speakeasyApi: any,
) {
  const data = await speakeasyApi({
    api: 'social.spkeasy.user.rotate',
    body: {
      privateKey,
      publicKey,
    },
  })
}

async function createNewSession(myDid, myPublicKey) {
  const dek = generateDEK()

  const trustedUsers = await getTrustedUsers(myDid, call, queryClient)

  const recipientPublicKeys = await getPublicKeys(
    trustedUsers.map(user => user.recipientDid),
  )

  const allSessionUsers = [
    {recipientDid: myDid, publicKey: myPublicKey},
    ...recipientPublicKeys,
  ]

  // Fetch all trusted users
  const encryptedDeks = await Promise.all(
    allSessionUsers.map(async recipient => {
      const encryptedDek = await encryptDEK(dek, recipient.publicKey)
      return {recipientDid: recipient.did, encryptedDek}
    }),
  )

  const {sessionId} = await createSession(allSessionUsers, encryptedDeks)

  return {sessionId, encryptedDek: encryptedDeks[0].encryptedDek}
}

async function getOrCreatePublicKey(agent: any, call: any) {
  let publicKey
  let privateKey

  try {
    publicKey = await getPublicKey(agent.did!, call)
  } catch (error) {
    if (error.code === 'NotFound') {
      ;({publicKey, privateKey} = await generateKeyPair())
      await updateUserKeyPair({publicKey, privateKey}, call)
    } else {
      throw error
    }

    return {publicKey, privateKey}
  }
}

export async function getPrivateSession(agent, call, queryClient) {
  let privateKey
  let publicKey
  let encryptedDek
  let sessionId

  // Get the private key
  try {
    privateKey = await getPrivateKey(call)
  } catch (error) {
    if (error.code === 'NotFound') {
      ;({publicKey, privateKey} = await generateKeyPair())
      await updateUserKeyPair({publicKey, privateKey}, call)
    } else {
      throw error
    }
  }

  // Get the session
  try {
    ;({sessionId, encryptedDek} = await getSession(call))
  } catch (error) {
    if (error.code === 'NotFound') {
      ;({publicKey, privateKey} = await getOrCreatePublicKey(agent, call))(
        ({sessionId, encryptedDek} = await createNewSession(
          publicKey,
          queryClient,
        )),
      )
    } else {
      throw error
    }
  }

  if (!privateKey) {
    privateKey = await getPrivateKey(call)
  }

  const sessionKey = await decryptDEK(encryptedDek, privateKey)

  return {
    sessionId,
    sessionKey,
  }
}

export function usePrivateSession() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {call} = useSpeakeasyApi()

  return useCallback(async () => {
    // Get cached trusted users data
    const cachedTrusted = queryClient.getQueryData(RQKEY(agent.did!))

    if (cachedTrusted) {
      return cachedTrusted
    }

    // If not in cache, fetch fresh data
    const trustedUsers = await getTrustedUsers(agent.did!, call, queryClient)
    return trustedUsers
  }, [agent, call, queryClient])
}
