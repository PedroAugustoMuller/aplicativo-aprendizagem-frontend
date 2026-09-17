/** Mirrors the backend's POST /auth/login `data` object. Network shape, not domain shape. */
export interface LoginResponse {
  id: string
  name: string
  email: string
  token: string
}

/** Mirrors GET /auth/me `data`. */
export interface CurrentUserResponse {
  id: string
  name: string
  email: string
}
