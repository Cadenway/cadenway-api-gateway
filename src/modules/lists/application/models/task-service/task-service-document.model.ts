/**
 * Type TaskServiceDocument
 *
 * @description
 * A JSON object exchanged with task-service: a query or a body the public validator accepted, or
 * an answer the client checked against the internal contract. The gateway decides nothing on its
 * members: the application relays it as it is, the client checks it against the internal contract
 * before and after the call, and the HTTP layer maps it to the public contract through the public
 * validator of the operation.
 *
 * @type {object}
 */
export type TaskServiceDocument = object;
