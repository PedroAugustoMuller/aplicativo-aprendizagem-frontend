/** Mirrors an element of GET /teachers `data`. Network shape, not domain shape. */
export interface AccountSummaryResponse {
  id: string
  name: string
  login: string
  must_change_password: boolean
  active: boolean
}

/** Mirrors the `data` of POST /teachers, /reset-password, /deactivate and /reactivate. */
export interface AccountDetailResponse extends AccountSummaryResponse {
  role: string
  temporary_password: string | null
}

/** Mirrors an element of GET /classrooms/{id}/credentials `data`. */
export interface CredentialSlipResponse {
  user_id: string
  name: string
  login: string
  temporary_password: string
}
