/** Mirrors an element of GET /subjects/{id}/topics `data`. Network shape, not domain shape. */
export interface TopicResponse {
  id: string
  name: string
  description: string
  position: number
}

export type TopicListResponse = TopicResponse[]
