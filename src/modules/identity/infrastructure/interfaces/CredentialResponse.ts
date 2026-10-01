/** Mirrors an element of GET /classrooms/{id}/credentials `data` (sent with no-store). */
export interface CredentialResponse {
  user_id: string
  name: string
  login: string
  temporary_password: string
}
