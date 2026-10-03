/** Mirrors an element of GET /subjects `data`. Network shape, not domain shape. */
export interface SubjectResponse {
  id: string
  name: string
  active: boolean
  /** Sent by GET /subjects only; write responses leave it out. */
  can_author?: boolean
}

export type SubjectListResponse = SubjectResponse[]
