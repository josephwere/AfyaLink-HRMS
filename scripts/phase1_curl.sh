#!/usr/bin/env bash
set -euo pipefail
API='http://127.0.0.1:5000'
TMP=/tmp/afya_phase1
mkdir -p "$TMP"

echo 'Logging in as super@afya.demo'
curl -s -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d '{"identifier":"super@afya.demo","password":"AfyaDemo@2026!"}' -o "$TMP/login.json" -w "HTTP_CODE:%{http_code}\n"
cat "$TMP/login.json"

TOKEN=$(jq -r '.accessToken // empty' "$TMP/login.json" 2>/dev/null || grep -Po '"accessToken"\s*:\s*"\K[^"]+' "$TMP/login.json" || true)
echo "TOKEN=$TOKEN"
if [ -z "$TOKEN" ]; then echo 'No token, aborting' && exit 1; fi

echo '\nListing hospitals (super-admin)'
curl -s -H "Authorization: Bearer $TOKEN" "$API/api/super-admin/hospitals?limit=50" -o "$TMP/hospitals.json"
cat "$TMP/hospitals.json" | jq '.items | length, .[]?.name' 2>/dev/null || cat "$TMP/hospitals.json"

HOSPITAL_ID=$(jq -r '.items[0]._id // empty' "$TMP/hospitals.json" 2>/dev/null || true)
if [ -z "$HOSPITAL_ID" ]; then HOSPITAL_ID=$(grep -Po '"_id"\s*:\s*"\K[^"]+' "$TMP/hospitals.json" | head -1 || true); fi
if [ -z "$HOSPITAL_ID" ]; then echo 'No hospital id found, aborting' && exit 1; fi

echo "Selected hospital id: $HOSPITAL_ID"

echo '\nCreating branch'
curl -s -X POST "$API/api/branches" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"hospitalId\":\"$HOSPITAL_ID\",\"name\":\"AfyaLink Demo - West Wing\",\"location\":\"Demo Wing\"}" -o "$TMP/branch.json" -w "HTTP_CODE:%{http_code}\n"
cat "$TMP/branch.json" | jq . 2>/dev/null || cat "$TMP/branch.json"

echo '\nRegistering hospital admin'
curl -s -X POST "$API/api/super-admin/register-hospital-admin" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"name\":\"Hospital Admin Auto\",\"email\":\"hospital.admin+auto@afyalink.demo\",\"password\":\"AfyaDemo@2026!\",\"hospitalId\":\"$HOSPITAL_ID\"}" -o "$TMP/admin.json" -w "HTTP_CODE:%{http_code}\n"
cat "$TMP/admin.json" | jq . 2>/dev/null || cat "$TMP/admin.json"

echo '\nCreating finance staff'
for e in cfo+auto@afyalink.demo finance.manager+auto@afyalink.demo accountant+auto@afyalink.demo; do
  name=$(echo $e | sed 's/@.*//')
  echo "Creating $e"
  curl -s -X POST "$API/api/hospital-admin/register-staff" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"name\":\"$name\",\"email\":\"$e\",\"password\":\"AfyaDemo@2026!\",\"role\":\"FINANCE\",\"hospitalId\":\"$HOSPITAL_ID\"}" -o "$TMP/staff_$(echo $e | sed 's/[^a-zA-Z0-9]/_/g').json" -w "HTTP_CODE:%{http_code}\n"
  cat "$TMP/staff_$(echo $e | sed 's/[^a-zA-Z0-9]/_/g').json" | jq . 2>/dev/null || cat "$TMP/staff_$(echo $e | sed 's/[^a-zA-Z0-9]/_/g').json"
done

echo '\nDone'
