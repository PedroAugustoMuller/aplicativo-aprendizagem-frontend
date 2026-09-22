/** Mirrors GET /auth/me `data`. `role` is a string on the wire; the repository narrows it. */
export interface CurrentUserResponse {
  id: string
  name: string
  login: string
  role: string
  must_change_password: boolean
}

/** Mirrors POST /auth/login `data`. */
export interface LoginResponse extends CurrentUserResponse {
  token: string
}
