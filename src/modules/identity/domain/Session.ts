export interface AuthenticatedUser {
  readonly userId: string
  readonly name: string
  readonly email: string
}

export interface Session extends AuthenticatedUser {
  readonly token: string
}

export interface Credentials {
  readonly email: string
  readonly password: string
}
