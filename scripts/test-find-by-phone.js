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
  const phone = '9642402639';
  const portal = 'admin';
  const cleaned = (phone || '').replace(/[\s\-()]/g, '');
  const cleanNoCountry = cleaned.replace(/^\+91/, '');
  const formattedWithCountry = `+91${cleanNoCountry}`;

  console.log(`Testing lookup for ${phone}...`);

  const numClean = Number(cleanNoCountry);
  const phoneVars = Array.from(new Set([cleanNoCountry, cleaned, formattedWithCountry, isNaN(numClean) ? null : String(numClean)].filter(Boolean)));
  console.log('phoneVars:', phoneVars);

  const tenantQueries = [];
  phoneVars.forEach(p => {
    tenantQueries.push(db.collection('tenants').where('adminPhone', '==', p).limit(1).get().catch(() => null));
    tenantQueries.push(db.collection('tenants').where('phone', '==', p).limit(1).get().catch(() => null));
    tenantQueries.push(db.collection('tenants').where('mobileNumber', '==', p).limit(1).get().catch(() => null));
  });
  const tenantSnaps = await Promise.all(tenantQueries);
  let found = null;
  for (const snap of tenantSnaps) {
    if (snap && !snap.empty) {
      console.log('MATCH FOUND IN TENANT QUERY! Doc ID:', snap.docs[0].id);
      found = snap.docs[0].data();
      break;
    }
  }

  if (!found) {
    console.log('Tenant query returned empty! Testing in-memory fallback scan...');
    const allTenantsSnap = await db.collection('tenants').get();
    console.log(`Total tenants fetched: ${allTenantsSnap.size}`);
    allTenantsSnap.docs.forEach(d => {
      const data = d.data();
      console.log(`Tenant Doc ID: ${d.id} | adminPhone: "${data.adminPhone}" (type: ${typeof data.adminPhone}) | name: ${data.name}`);
    });
  }
}

run().catch(console.error);
