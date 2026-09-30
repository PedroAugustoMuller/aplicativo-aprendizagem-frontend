/** Mirrors GET /auth/me `data`. Network shape, not domain shape. */
export interface CurrentUserResponse {
  id: string
  name: string
  login: string
  role: string
  must_change_password: boolean
}

/** Mirrors the backend's POST /auth/login `data` object. */
export interface LoginResponse extends CurrentUserResponse {
  token: string
}
