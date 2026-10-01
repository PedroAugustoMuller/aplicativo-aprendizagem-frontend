/** Mirrors an element of GET /teachers and GET /classrooms/{id}/students `data`. */
export interface AccountListItemResponse {
  id: string
  name: string
  login: string
  must_change_password: boolean
  active: boolean
}

/** Mirrors the account returned by create / reset-password / (de)activate. */
export interface AccountResponse extends AccountListItemResponse {
  role: string
  temporary_password: string | null
}
