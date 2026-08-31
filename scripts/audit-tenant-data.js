/**
 * Read-Only Tenant Data Isolation Audit Diagnostic Script
 * 
 * IMPORTANT:
 * - Read-only operation.
 * - DOES NOT modify, delete, or migrate any Firestore document.
 * - Reports orphan documents or missing tenantId fields.
 */

const admin = require('firebase-admin');
const fs = require('fs');

if (admin.apps.length === 0) {
  // Initialize Admin SDK using default credentials or env var
  admin.initializeApp();
}

const db = admin.firestore();

async function auditTenantData() {
  console.log('=== EDUTRACK MULTI-TENANT DATA AUDIT (READ-ONLY) ===\n');

  // 1. Audit Tenants
  const tenantSnap = await db.collection('tenants').get();
  console.log(`[Tenants] Found ${tenantSnap.size} tenant documents:`);
  const tenantIds = new Set();
  tenantSnap.docs.forEach(doc => {
    tenantIds.add(doc.id);
    console.log(`  - Tenant ID: ${doc.id} | Name: ${doc.data().name || doc.data().schoolName || 'N/A'}`);
  });

  // 2. Audit Student Profiles
  console.log('\n[Student Profiles] Auditing studentProfiles collection:');
  const studentSnap = await db.collection('studentProfiles').get();
  let studentMissingTenant = 0;
  studentSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.tenantId) {
      studentMissingTenant++;
      console.warn(`  - [MISSING TENANTID] Student Profile ID: ${doc.id}`);
    } else if (!tenantIds.has(data.tenantId)) {
      console.warn(`  - [UNMATCHED TENANTID] Student Profile ID: ${doc.id} | Tenant ID: ${data.tenantId}`);
    }
  });
  console.log(`  Summary: ${studentSnap.size} profiles checked. ${studentMissingTenant} missing tenantId.`);

  // 3. Audit Staff Profiles
  console.log('\n[Staff Profiles] Auditing staffProfiles collection:');
  const staffSnap = await db.collection('staffProfiles').get();
  let staffMissingTenant = 0;
  staffSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.tenantId) {
      staffMissingTenant++;
      console.warn(`  - [MISSING TENANTID] Staff Profile ID: ${doc.id}`);
    } else if (!tenantIds.has(data.tenantId)) {
      console.warn(`  - [UNMATCHED TENANTID] Staff Profile ID: ${doc.id} | Tenant ID: ${data.tenantId}`);
    }
  });
  console.log(`  Summary: ${staffSnap.size} staff profiles checked. ${staffMissingTenant} missing tenantId.`);

  // 4. Audit Users
  console.log('\n[Users] Auditing users collection:');
  const userSnap = await db.collection('users').get();
  let userMissingTenant = 0;
  userSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.tenantId && data.role !== 'SUPER_ADMIN') {
      userMissingTenant++;
      console.warn(`  - [MISSING TENANTID] User ID: ${doc.id} | Role: ${data.role}`);
    }
  });
  console.log(`  Summary: ${userSnap.size} users checked. ${userMissingTenant} missing tenantId.`);

  console.log('\n=== AUDIT COMPLETE ===');
}

auditTenantData().catch(err => {
  console.error('Audit execution error:', err.message);
});
