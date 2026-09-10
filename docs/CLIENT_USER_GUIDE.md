# SALT PRINTS — Staff User Guide

A plain-language guide to using the Production Board / CRM day-to-day.

## 1. Logging In

Go to the app's web address and sign in with your email and password. If
you're a new staff member, your admin will have created your account and
given you a temporary password to sign in with the first time.

## 2. First Login / Changing Your Password

The first time you sign in with a temporary password (or after an admin
resets your password), you'll be taken straight to a "Change Your
Password" screen and won't be able to use the rest of the app until you
set a new one. You can't reuse the temporary password — choose a new one
at least 8 characters long. Once it's set, you're in.

## 3. Dashboard

Your home screen after logging in. Shows at a glance:

- **Active Orders**, **Overdue**, **Due Today**, **Urgent Orders**
- **Awaiting Artwork**, **Ready for Production**, **Completed This Week**
- **Production Status Breakdown** — how many orders are in each stage
- **Average Turnaround** — how many days orders typically take from
  creation to completion
- **Staff Workload** — how many active orders each person is carrying
- **Orders Requiring Attention** and **Upcoming Deadlines**
- **Recent Activity** — the latest changes across all orders

## 4. Customers

The Customers list shows everyone you've done work for. Click a customer
to see their contact details, order history, and notes.

## 5. Creating a Customer

From the Customers page, click **Add Customer** and fill in their name,
company (if any), email, and phone. You can also add a new customer
directly from the New Order form if they don't exist yet.

## 6. Creating an Order

Click **New Order**. Pick or create the customer, then fill in the job
details: garments, services, turnaround, delivery method, priority, due
date, and who's handling it (assignee). You don't have to fill everything
in one pass — the form saves your progress automatically as a draft while
you work, and only checks that required fields are filled in when you
actually try to save or create the order.

## 7. Garments and Quantities

Add each garment type, brand, and colour, then enter quantities per size
(adult and/or youth sizing). You can add as many garment lines as the job
needs.

## 8. Services

Tick which services apply to this job (e.g. Screen Printing, Embroidery,
Graphic Design). At least one service is required to finalize an order.

## 9. Artwork Upload

Upload the customer's artwork files directly on the order. Image files
(PNG, JPG, etc.) show a preview; other file types (like PDFs) are stored
safely even though they can't be previewed inline. You can keep working on
other parts of the form while a file uploads.

## 10. Creating Mockups

Once artwork is uploaded, open the **Mockup Studio** from the order's
Artwork & Mockups tab. Choose the garment type and colour to preview the
artwork on, then position it on the garment by dragging, resizing, or
rotating it directly on the canvas.

## 11. Print Locations

Pick where the print goes — Left Chest, Full Front, Full Back, Left
Sleeve, and so on. Each location has its own guide zone showing roughly
where a print of that type usually sits.

## 12. Print Size

Set the exact width in millimetres — the height follows automatically to
keep the artwork's proportions correct. You can also resize by dragging on
the canvas; the width/height fields update to match. Switching to a
different print location keeps the same physical size — only how it looks
relative to the new zone's guide changes.

## 13. Multiple Prints

Add more than one print position to the same order (e.g. a chest print and
a back print) using different artwork for each if needed. Each print
position keeps its own artwork, position, size, colour, and approval note
independently — switching between them doesn't mix anything up, and
removing one doesn't affect the others.

If artwork is sized larger than its guide zone, you'll see a warning, but
you can still save — the app never forces a resize or crops anything for
you. Use your judgement (or check with the customer) on whether the size
is intentional.

## 14. Saving Drafts

Your order autosaves as you work. You can also click **Save Draft**
explicitly at any point and come back to it later from the **Drafts**
view — everything you'd entered, including mockup positioning, will be
exactly as you left it.

## 15. Creating / Finalizing Orders

When everything's ready, click **Create Order** (or **Save Changes** if
editing). This assigns the order its official number (e.g. `SP-1042`),
generates clean preview images of every mockup, and makes it visible on
the Production Board and in the customer's order history.

## 16. Assigning Staff

Use the assignee field (on the order form, Order Detail, or directly from
the Production Board) to set who's responsible for a job. You can only
assign to currently active staff members — if someone assigned to an
order later leaves or is deactivated, their name still shows on that
order (marked inactive) so the history stays accurate, but they can't be
newly assigned to anything else.

## 17. Production Board

Your main working view of all active orders — filter, search, and sort
them by due date, priority, or **Queue Priority** (a smart ranking that
puts Overdue first, then Same Day turnaround, then Urgent/Due Today, then
Due Tomorrow, then everything else). Switch between table and card view
depending on your screen.

## 18. My Orders

A quick filter showing only the orders assigned to you.

## 19. Unassigned

A quick filter showing orders nobody has been assigned to yet — useful for
catching anything that's fallen through the cracks.

## 20. Queue Priority

Sort the Production Board by urgency instead of just due date. This never
stops you from opening or working on any order regardless of its rank —
it's just a suggested working order, not a lock.

## 21. Artwork Approval

Track artwork through its own stages independently of production:
Mockup Required, Awaiting Approval, Approved, Completed. Each print
position can carry its own approval note (e.g. "customer confirmed
colours by phone 10/9").

## 22. Production Readiness

An order shows as **Ready for Production** once its artwork is Approved
and garments are Received (or not required) — production itself just
hasn't started yet. If something's blocking readiness, the Production
Board flags it so you know what's still outstanding.

## 23. Updating Production Status

Move an order through its stages (New → Ready → Queued → In Production →
Quality Check → Ready for Collection → Out for Delivery → Completed, or
On Hold) directly from the Production Board or the order's Production
tab.

## 24. Order Detail

Click any order to see its full record: Overview, the original Order
Form, Garments, Artwork & Mockups, Production, Files, and a full Activity
timeline of everything that's happened on that order.

## 25. Reordering

Found on both the Order Detail page and a customer's order history — click
**Reorder** to start a brand-new order pre-filled with the same customer,
garments, services, and artwork as a previous job. It's a genuinely new
order (its own order number, its own copy of the artwork, fresh statuses)
— the original order is never changed or affected by reordering from it.
You'll want to set a new due date and re-check anything that's changed
since the original job (quantities, colours, etc.) before finalizing.

## 26. Customer History

A customer's page lists every order they've placed, with quantity,
garments, artwork, and current production status at a glance, plus a
one-click Reorder button on each past order.

## 27. Reporting

The Dashboard's reporting section (Production Status Breakdown, Average
Turnaround, Staff Workload) gives you a running operational picture
without needing to build a report manually.

## 28. User Management (Admin)

Admins only: Settings → Users. Search, view, and manage every staff
account from one screen.

## 29. Creating Staff

Settings → Users → **Add User**. Enter their name, email, and role
(Staff or Admin). They'll sign in for the first time with a temporary
password and be required to set their own password immediately.

## 30. Resetting Passwords

Settings → Users → find the person → **Reset Password**. They'll need to
sign in with the temporary password again and choose a new one before
they can use the CRM.

## 31. Deactivating Staff

Settings → Users → find the person → **Deactivate**. They immediately
lose the ability to sign in, and can no longer be newly assigned to
orders — but their name stays visible on any order they were already
working on, so nothing in the history disappears. Reactivate the same way
at any time.

## 32. Common Problems

- **"I can't save my order"** — check that at least one garment line and
  one service are filled in; these are required before an order can be
  finalized (drafts don't need this).
- **"My artwork won't upload"** — check your internet connection and try
  again; very large files may take longer than expected.
- **"I was signed out unexpectedly"** — this happens if your account was
  deactivated, or your session simply expired after a long period of
  inactivity; sign back in normally.
- **"I can't see User Management"** — that section is admin-only; ask an
  admin if you need an account change.
- **"An assignee I expected to see isn't in the list"** — only currently
  active staff can be newly assigned; if someone's missing, check whether
  their account has been deactivated.

## 33. Getting Help / Troubleshooting Basics

If something looks wrong and reloading the page doesn't fix it, note down
what you were doing, which order (if any) was involved, and any message
that appeared on screen, then contact your admin or the app's developer
with those details — that's the fastest way to get it resolved.
