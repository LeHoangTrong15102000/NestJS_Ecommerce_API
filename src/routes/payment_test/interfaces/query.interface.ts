// Query interfaces for CQRS pattern
export interface IQuery<TResponse> {
  readonly _queryBrand?: never
}

export interface IQueryHandler<TQuery extends IQuery<TResponse>, TResponse> {
  handle(query: TQuery): Promise<TResponse>
}
