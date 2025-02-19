import { gql } from '@apollo/client'

export const signInQuery = gql`
  query SignIn {
    signIn {
      createdAt
      email
      id
      name
      openid
      role
      updatedAt
      userBots {
        id
        name
        guidelines
        botIntents {
          name
          description
          isEnabled
          intentHandler {
            id
            type
            content
            guidelines
            createdAt
            updatedAt
          }
          createdAt
          id
          requiredFields
          updatedAt
        }
        createdAt
        updatedAt
        greetingMessage
        strictIntentDetection
        botQuickActions {
          id
          config
          createdAt
          updatedAt
        }
        allowedOrigin
      }
    }
  }
`
