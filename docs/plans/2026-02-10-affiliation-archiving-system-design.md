# Affiliation Archiving System - Design Document

**Date:** 2026-02-10
**Status:** Approved
**Author:** Claude (via Brainstorming)

---

## Problem Statement

The kanban board for affiliations displays all sub-processes grouped by status. As affiliations are completed, the COMPLETED column becomes increasingly large and difficult to navigate. This degrades the user experience for managers who need to focus on active work.

**Key insight:** Completed processes are not important to display because when all sub-processes of an affiliation are completed, an email is sent to the client and the affiliation is finished.

---

## Proposed Solution

Implement an **affiliation lifecycle system** with three states: ACTIVE, SENT, and ARCHIVED. When a manager sends a completed affiliation to the client, it is immediately archived and removed from the kanban.

---

## Design Overview

### 1. Data Model Changes

#### New Enum: AffiliationStatus

```prisma
enum AffiliationStatus {
  ACTIVE      // In progress (default)
  SENT        // Sent to client
  ARCHIVED    // Archived (permanent)
}
```

#### Updated Affiliation Model

```prisma
model Affiliation {
  id       String @id @default(cuid())
  clientId String
  client   Client @relation(fields: [clientId], references: [id])

  // Status tracking (NEW)
  status      AffiliationStatus @default(ACTIVE)
  sentAt      DateTime?         // When sent
  sentById    String?           // Manager who sent
  sentBy      User?             @relation("AffiliationSentBy", fields: [sentById], references: [id], onDelete: SetNull)
  archivedAt  DateTime?         // When archived

  // Audit trail
  createdById String
  createdBy   User   @relation("AffiliationCreatedBy", fields: [createdById], references: [id])

  // Soft delete (kept for compatibility)
  isActive Boolean @default(true)

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  subProcesses AffiliationSubProcess[]

  @@index([status])        // NEW
  @@index([clientId])
  @@index([createdById])
  @@map("affiliations")
}
```

**New Fields:**
- `status`: Primary status of the affiliation
- `sentAt` + `sentById`: Audit trail of who and when sent
- `archivedAt`: Timestamp of archival
- `isActive`: Maintained for backward compatibility

---

### 2. Workflow and State Transitions

```
ACTIVE → SENT → ARCHIVED
  ↓       ↓
(working) (sent to client + auto-archived)
```

#### State Transition: ACTIVE → SENT/ARCHIVED

**Trigger:** Manual action by manager
**Precondition:** All sub-processes must have `status = COMPLETED`
**Actions:**
1. Validate permissions (MANAGER or ADMIN only)
2. Verify all sub-processes are COMPLETED
3. Update affiliation in single transaction:
   - `status = SENT`
   - `sentAt = now()`
   - `sentById = currentUserId`
   - `status = ARCHIVED` (immediate)
   - `archivedAt = now()`
4. Send email to client with affiliation details
5. Revalidate kanban routes

**Result:** Affiliation and all its sub-processes disappear from kanban immediately.

---

### 3. User Interface Changes

#### Kanban Board Filtering

**Current behavior:** Shows all sub-processes regardless of affiliation status
**New behavior:** Only show sub-processes where `affiliation.status = ACTIVE`

```typescript
// In getSubProcessesForKanban()
where: {
  affiliation: {
    isActive: true,
    status: AffiliationStatus.ACTIVE  // NEW filter
  }
}
```

#### Affiliation Detail Page (`/dashboard/affiliations/[id]`)

**New Elements:**

1. **Status Badge**
   - ACTIVE: Blue badge "En Progreso"
   - SENT: Green badge "Enviada"
   - ARCHIVED: Gray badge "Archivada"

2. **Send Button**
   - **Label:** "Enviar Afiliación al Cliente"
   - **Visibility:** Only when `status = ACTIVE` AND all sub-processes are COMPLETED
   - **Position:** Header, next to existing actions
   - **Confirmation:** Dialog asking "¿Enviar afiliación al cliente? Esto archivará la afiliación y enviará el correo."

3. **Completion Indicator**
   - If all COMPLETED: Green badge "✓ Lista para enviar"
   - If incomplete: Gray badge "X de 4 completados"

4. **Sent Information** (when status = SENT or ARCHIVED)
   - Show: "Enviada el {date} por {manager name}"
   - Show: "Archivada el {date}"

#### New Route: Archived Affiliations (`/dashboard/affiliations/archived`)

**Purpose:** View historical archived affiliations

**Features:**
- Table with columns: Client, Sent Date, Sent By, Actions
- Search by client name
- "View Details" button (readonly view)
- **No unarchive option** (archival is permanent)
- Pagination for large archives

---

### 4. Technical Implementation

#### Files to Create

**1. Server Action: `sendAffiliation()`**
- **File:** `lib/actions/affiliation.actions.ts`
- **Responsibilities:**
  - Permission validation (MANAGER/ADMIN)
  - Verify all sub-processes are COMPLETED
  - Update affiliation status (SENT + ARCHIVED)
  - Send email to client
  - Revalidate routes

**2. Archived Affiliations Page**
- **File:** `app/dashboard/affiliations/archived/page.tsx`
- **Component:** Server component fetching archived affiliations
- **Client:** `archived-affiliations-client.tsx` for table

**3. Send Button Component**
- **File:** `components/dashboard/affiliations/send-affiliation-button.tsx`
- **Props:** `affiliationId`, `allCompleted`, `currentStatus`
- **Features:** Confirmation dialog, loading states, error handling

**4. Query: `getArchivedAffiliations()`**
- **File:** `lib/actions/affiliation.actions.ts`
- **Returns:** List of archived affiliations with client and sender info
- **Filters:** Search, pagination

#### Files to Modify

**1. Prisma Schema** (`prisma/schema.prisma`)
- Add `AffiliationStatus` enum
- Modify `Affiliation` model
- Add index on `status`
- Add `sentBy` relation to User

**2. TypeScript Types** (`lib/types/affiliation.types.ts`)
- Export `AffiliationStatus` from Prisma
- Add `AffiliationStatusLabels` record
- Update interfaces to include new fields

**3. Existing Queries**
- `getSubProcessesForKanban()`: Add `status = ACTIVE` filter
- `getAffiliations()`: Include status information
- `getAffiliationById()`: Include sent/archived fields
- `getAffiliationStats()`: Consider only ACTIVE affiliations

**4. Affiliation Detail Page** (`app/dashboard/affiliations/[id]/page.tsx`)
- Add status badge
- Add "Send Affiliation" button
- Display sent/archived information
- Conditionally render based on status

**5. Sidebar Navigation** (`components/dashboard/app-sidebar.tsx`)
- Add link to "Afiliaciones Archivadas"

---

### 5. Data Migration

#### Migration Strategy

**Step 1: Create migration**
```bash
pnpm prisma migrate dev --name add_affiliation_status
```

**Step 2: Migrate existing data**
```typescript
// scripts/migrate-affiliation-status.ts
async function migrateAffiliationStatus() {
  console.log('🔍 Migrando estados de afiliaciones...')

  // All existing affiliations → ACTIVE
  const activeCount = await prisma.affiliation.updateMany({
    where: { status: null },
    data: { status: 'ACTIVE' }
  })
  console.log(`✅ ${activeCount.count} afiliaciones marcadas como ACTIVE`)

  // Optional: Archive old inactive affiliations
  const oldInactive = await prisma.affiliation.findMany({
    where: {
      isActive: false,
      updatedAt: { lt: new Date('2025-01-01') }
    }
  })

  if (oldInactive.length > 0) {
    await prisma.affiliation.updateMany({
      where: { id: { in: oldInactive.map(a => a.id) } },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date()
      }
    })
    console.log(`✅ ${oldInactive.length} afiliaciones antiguas archivadas`)
  }

  console.log('✨ Migración completada')
}
```

**Step 3: Run migration**
```bash
npx tsx scripts/migrate-affiliation-status.ts
```

---

### 6. Testing Plan

#### Functional Tests

**Test 1: Complete Workflow**
1. Create new affiliation → status should be ACTIVE
2. Complete all sub-processes → button "Enviar" should appear
3. Click "Enviar Afiliación"
4. Verify affiliation disappears from kanban
5. Verify affiliation appears in `/affiliations/archived`
6. Verify email was sent

**Test 2: Validation Tests**
- Attempt to send with incomplete sub-processes → should fail with error
- Attempt to send as USER role (not manager) → should fail with permission error
- Verify confirmation dialog works correctly

**Test 3: Edge Cases**
- Affiliation with 0 sub-processes
- Affiliation with mix of COMPLETED and RETURNED
- Multiple managers viewing same affiliation

#### Regression Tests

**Verify existing functionality:**
- ACTIVE affiliations work identically to before
- `isActive: false` soft delete still works
- Statistics update correctly
- Kanban filters work with new status field
- Search and sorting still work

---

## Benefits

✅ **Clean Kanban:** Always shows only relevant active work
✅ **Clear Workflow:** ACTIVE → SENT → ARCHIVED matches business process
✅ **Full Audit Trail:** Track who sent affiliations and when
✅ **Data Preservation:** All historical data maintained in archive
✅ **Scalable:** Performance doesn't degrade with more completed affiliations
✅ **User-Friendly:** Managers explicitly send affiliations when ready

---

## Trade-offs

⚠️ **Cannot Undo:** Archiving is permanent (by design)
⚠️ **Migration Required:** One-time data migration needed
⚠️ **New Complexity:** Adds state management to affiliations

**Mitigation:** Clear UI indicators and confirmation dialogs prevent accidental sends

---

## Future Considerations

**Potential Enhancements (Not in Scope):**
- Bulk archive operations
- Archive search with advanced filters
- Export archived affiliations to PDF/Excel
- Automatic reminders when all sub-processes complete
- Analytics on time-to-complete by affiliation type

---

## Implementation Checklist

### Phase 1: Database & Types
- [ ] Create `AffiliationStatus` enum in Prisma
- [ ] Add fields to `Affiliation` model
- [ ] Add `sentBy` relation
- [ ] Generate migration
- [ ] Create migration script
- [ ] Run migration on dev database
- [ ] Update TypeScript types
- [ ] Add status labels

### Phase 2: Server Actions
- [ ] Implement `sendAffiliation()` action
- [ ] Update `getSubProcessesForKanban()` filter
- [ ] Implement `getArchivedAffiliations()` query
- [ ] Update `getAffiliationById()` to include new fields
- [ ] Update stats queries

### Phase 3: UI Components
- [ ] Create `SendAffiliationButton` component
- [ ] Add status badge to detail page
- [ ] Add completion indicator
- [ ] Create confirmation dialog
- [ ] Update detail page with send button

### Phase 4: Archive View
- [ ] Create `/affiliations/archived` route
- [ ] Create archived affiliations table
- [ ] Add search functionality
- [ ] Add pagination
- [ ] Add sidebar link

### Phase 5: Testing & Polish
- [ ] Test complete workflow
- [ ] Test validations
- [ ] Test edge cases
- [ ] Run regression tests
- [ ] Update documentation
- [ ] Create user guide for managers

---

## Success Metrics

**Before Implementation:**
- Kanban COMPLETED column: Unbounded growth
- Time to find active work: Increases over time

**After Implementation:**
- Kanban only shows ACTIVE affiliations
- Constant performance regardless of archive size
- Clear workflow completion path for managers

---

## Conclusion

This design solves the kanban scalability problem by introducing a clear affiliation lifecycle with automatic archiving. The solution aligns with the existing business process (send email when complete) and provides full audit trails while maintaining clean, performant UI.

**Recommended Next Steps:**
1. Review and approve design
2. Create implementation plan
3. Begin Phase 1 (Database & Types)
