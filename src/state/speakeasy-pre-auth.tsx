import {useEffect} from 'react'

import {callSpeakeasyApiWithAgent} from '#/lib/api/speakeasy'
import {useAgent} from '#/state/session'

export function useSpeakeasyPreAuth() {
  const agent = useAgent()
  const did = agent.did

  useEffect(() => {
    if (!did) return

    // Send pre-auth request. This enables Speakeasy to briefly cache the
    // session authorisation and subsequent initial requests for
    // private posts, etc. will be faster.
    callSpeakeasyApiWithAgent(agent, {
      api: 'social.spkeasy.privatePost.preAuth',
    }).catch(error => {
      // Only log if it's not a NotFoundError (which is expected for new users)
      if (error.error !== 'NotFoundError') {
        console.error('Failed to pre-auth with Speakeasy:', error)
      }
    })
  }, [did, agent])
}
