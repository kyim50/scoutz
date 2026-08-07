# Sending Cite's auth email from joincite.com

Everything the app emails — signup confirmation, password reset — is sent by
**Supabase Auth**, not by this backend. Nothing in `backend/src` opens an SMTP
connection. So all of this is dashboard and DNS; there is no code to change.

Supabase's built-in sender exists to get you started and is rate limited to a
handful of messages an hour, from an address you do not control. Custom SMTP
replaces it.

## 1. Pick a sender

Any SMTP provider works. [Resend](https://resend.com) is the easiest fit here —
3,000 emails a month free, and its domain setup is three DNS records. SendGrid,
Postmark and Amazon SES are all fine alternatives; SES is cheapest at volume and
the most work to set up.

The rest of this assumes Resend. The shape is the same everywhere: verify the
domain, then hand Supabase the credentials.

## 2. Verify joincite.com

In Resend → **Domains** → **Add Domain**, enter `joincite.com`. It returns three
records to add wherever joincite.com's DNS lives — Vercel's dashboard if the
nameservers point there, otherwise the registrar.

| Type | Name | Purpose |
| --- | --- | --- |
| MX | `send` | Bounce and complaint handling |
| TXT | `send` | SPF — authorises the provider to send as you |
| TXT | `resend._domainkey` | DKIM — signs each message |

**Copy the values from Resend rather than from anywhere else.** The DKIM key is
unique to your domain and the SPF host varies by region.

Worth adding a fourth by hand, which Resend does not require but every inbox
provider likes:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@joincite.com` |

`p=none` only asks for reports; it rejects nothing. Move to `p=quarantine` once
you have seen a few weeks of clean reports.

Propagation is usually minutes. Resend shows the domain as Verified when it is
done — do not continue until it does, because Supabase will accept bad
credentials silently and simply fail to send.

## 3. Point Supabase at it

Resend → **API Keys** → create one with **Sending access**. That key is the SMTP
password; the username is the literal string `resend`.

Supabase Dashboard → **Project Settings** → **Authentication** → **SMTP Settings**:

| Field | Value |
| --- | --- |
| Enable Custom SMTP | on |
| Sender email | `no-reply@joincite.com` |
| Sender name | `Cite` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the `re_…` API key |

The sender address does not need a mailbox behind it — nothing is delivered to
it. If you would rather people could reply, use an address you actually read.

While you are in Authentication, two things that are easy to miss:

- **Rate Limits** → raise the email limit. It is set low for the built-in
  sender and stays low after you switch, which looks exactly like SMTP being
  broken.
- **URL Configuration** → `cite://auth/callback` must be in Redirect URLs. The
  scheme changed with the rename; links pointing at the old one are dead.

## 4. Paste the templates

**Authentication** → **Email Templates**. Two of the templates in this folder
replace the defaults:

- `confirm-signup.html` → **Confirm signup**
- `reset-password.html` → **Reset password**

Both are table-based with inline CSS, which is what survives Outlook, and both
are deliberately light — a dark email in a light inbox reads as a screenshot of
something rather than a message.

## 5. Prove it works

Sign up with a real address on a provider you can inspect. Then check:

- It arrives, and not in spam.
- Gmail: **Show original** → `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`. Anything
  else means a DNS record is wrong or has not propagated.
- The button opens the app rather than a browser error — that is the redirect
  URL from step 3.

If it never arrives, Resend → **Logs** shows whether the message left at all.
Nothing there means Supabase never connected: wrong port, wrong password, or the
domain is not verified yet.
