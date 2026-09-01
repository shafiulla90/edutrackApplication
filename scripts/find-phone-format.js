const admin = require('../backend/node_modules/firebase-admin');
const path = require('path');
const fs = require('fs');

const saPath = path.join(__dirname, '..', 'backend', 'firebase-service-account.json');
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
}

const db = admin.firestore();

async function run() {
  console.log('=== SEARCHING ALL TENANTS & USERS FOR PHONE 9642402639 ===\n');

  const tenantSnap = await db.collection('tenants').get();
  console.log(`Total Tenants in Database: ${tenantSnap.size}`);
  tenantSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`Tenant ID: ${doc.id} | Name: ${data.name || data.schoolName} | AdminPhone: ${data.adminPhone} | Phone: ${data.phone} | Mobile: ${data.mobileNumber}`);
  });

  const userSnap = await db.collection('users').get();
  console.log(`\nTotal Users in Database: ${userSnap.size}`);
  userSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`User ID: ${doc.id} | Name: ${data.name} | Role: ${data.role} | Phone: ${data.phone} | Mobile: ${data.mobileNumber} | TenantId: ${data.tenantId}`);
  });
}

run().catch(console.error);
