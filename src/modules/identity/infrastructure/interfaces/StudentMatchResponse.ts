/** Mirrors an element of GET /students?search= `data`. */
export interface StudentMatchResponse {
  id: string
  name: string
  login: string
  classrooms: { id: string; name: string }[]
}
