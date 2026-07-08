// TEMPORARY — remove after letsrevel/revel-backend#644 lands the schema rename.
//
// The backend has several `Status` TextChoices classes that all serialize to the
// same bare `Status` component in the OpenAPI spec. The new series-pass status
// enum ('pending' | 'active' | 'cancelled') currently wins that collision, so the
// generated `Status` type no longer matches what membership/whitelist requests
// actually return ('pending' | 'approved' | 'rejected'). This local alias keeps
// those surfaces typed correctly until the backend de-collides the schema names
// and the client is regenerated.
export type RequestStatus = 'pending' | 'approved' | 'rejected';
