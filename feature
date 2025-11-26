The backend now exposes:
- A POST endpoint /organizations/ to create an organization. The endpoint is only available to users with a verified email. A user with an unverified email should have the button disabled and with a warning
- the update organization endpoint does not have the contact_email field anymore
- a /update-contact-email that accepts a {email: EmailStr} and sends an email with a verification token that points to /org/{organization_slug}/verify-contact-email?token={token}
- the latter returns a organization schema. If this already has the email verified, it means that no email is going to be sent (e.g., it's the same as the user's). Otherwise tell the user that an email is sent. This endpoint doubles as a resend verification email (just resend with the same email)
- the FE should behave similarly to the user email verification flow in this case.
- a /verify-contact-email is also available to verify the token.
- for all, handle errors gracefully

A user is only allowed to have 1 organization as owner. So, if from the /my-permissions endpoint you see the user has an org as owner already, do not even show the CTA (you already access this endpoint elsewhere)

The create flow should follow a similar Wizard pattern as the event creation. The simplest solution would be that after succesful creation the user is redirected to /admin/settings

The CTA to become an organizer should be:
- in the home page: "Request beta access to test Revel as an organizer and provide valuable feedback" should be a direct CTA without needing to request.
- in the dashboard: if the user is not an owner or a staff member: where the "admin" CTA would be.
- in the user menu: if the user is not an owner, after "my organizations"

Check the updated openapi for more info.

Ask if you need more info or context.