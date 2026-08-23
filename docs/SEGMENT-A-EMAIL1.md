# Segment A — Email 1 tracking

**Wave:** All organiser groups with an email · **Ordered:** A–Z by primary group name  
**Deduped:** **one email = one send** (multi-group contacts listed once; extra groups in `other_groups`)  
**Count:** see `data/segment-a-email1.csv`  
**Excluded:** exhibition-style names · internal/test Accounts · groups **hidden from browse** (`listing_status: unpublished` / not public)  
**Send from:** Brevo · **Reply-to:** `catherine@thenetworkeruk.com`  
**Paste HTML:** `data/email1-brevo-ready.html`  
**Subject:** The Networker’s new chapter  
**CTA:** https://www.thenetworkeruk.com/for-organisers  

### Files
| File | Use |
|------|-----|
| `data/segment-a-email1.csv` | Tracking (includes `other_groups` when one email covers several listings) |
| `data/Segment-A-Email1-Brevo-import.csv` | Brevo / Excel import — unique emails only (`Email`, `Organiser name`) |
| `data/segment-a-emails-only.txt` | Unique emails, one per line |

Email 1 has **no personal claim links**. Email 2 follows **3–5 days** later.
